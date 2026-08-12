// @ts-check

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { resolveInRoot }
    from "../../src/services/pathResolution.js";

import { documentFromText }
    from "../../src/references/document.js";

import { scanDocumentForReferences }
    from "../../src/references/documentScanner.js";

import { collectBrokenReferences }
    from "../../src/diagnostics/brokenReferenceScanner.js";

import { targetsReferencedBy }
    from "../../src/diagnostics/referenceDependencyIndex.js";

import {
    ReferenceDependencyIndex
} from "../../src/diagnostics/referenceDependencyIndex.js";

import {
    ScanScheduler,
    PRIORITY
} from "../../src/scanning/scanScheduler.js";

import { fileVersion }
    from "../../src/scanning/fileVersion.js";

import { getLanguageIdFromExtension }
    from "../../src/parsers/languageSupport.js";

import { WORKSPACE_SIZES, createWorkspace, removeWorkspace }
    from "./workspace.js";

const ITERATIONS = 5;

/**
 * Build the same kind of resolution context the extension creates
 * (`createReferenceContext`), but against a plain root with a real
 * filesystem shim. Mirrors the current synchronous `createFileSystem`.
 *
 * @param {string} root
 */
function referenceContext(root) {
    return {
        resolveTargetPath(relativePath) {
            return resolveInRoot(root, relativePath);
        },
        fs: {
            exists(targetPath) {
                return fs.existsSync(targetPath);
            },
            readText(targetPath) {
                try {
                    return fs.readFileSync(targetPath, "utf8");
                } catch {
                    return null;
                }
            }
        }
    };
}

/**
 * The exact per-document work `extension.js` performs today for each open
 * document: index its referenced targets and collect its broken references.
 *
 * @param {string} filePath
 * @param {string} root
 */
function refreshDocumentWorkload(filePath, root) {
    const languageId =
        getLanguageIdFromExtension(filePath) ?? "markdown";

    const document = documentFromText(
        fs.readFileSync(filePath, "utf8"),
        languageId
    );

    const context = referenceContext(root);

    targetsReferencedBy(document, context);
    collectBrokenReferences(
        document,
        context,
        path.relative(root, filePath)
    );
}

/**
 * Scan-only workload: the parser the link provider, hover and decorations
 * share. No filesystem access.
 *
 * @param {string[]} files
 */
function scanOnlyWorkload(files) {
    for (const filePath of files) {
        const languageId =
            getLanguageIdFromExtension(filePath) ?? "markdown";

        const document = documentFromText(
            fs.readFileSync(filePath, "utf8"),
            languageId
        );

        scanDocumentForReferences(document);
    }
}

/**
 * @param {string} filePath
 * @param {string} root
 */
function firstDocumentWorkload(filePath, root) {
    refreshDocumentWorkload(filePath, root);
    scanOnlyWorkload([filePath]);
}

/**
 * @param {() => void} fn
 * @returns {{ medianMs: number, minMs: number, heapDeltaMb: number }}
 */
function measure(fn) {
    const samples = [];

    for (let i = 0; i < ITERATIONS; i++) {
        const beforeHeap = process.memoryUsage().heapUsed;
        const start = process.hrtime.bigint();

        fn();

        const elapsedMs =
            Number(process.hrtime.bigint() - start) / 1e6;

        const heapDeltaMb =
            (process.memoryUsage().heapUsed - beforeHeap) /
            (1024 * 1024);

        samples.push({ elapsedMs, heapDeltaMb });
    }

    samples.sort((a, b) => a.elapsedMs - b.elapsedMs);

    const median = samples[Math.floor(samples.length / 2)];

    return {
        medianMs: Number(median.elapsedMs.toFixed(2)),
        minMs: Number(samples[0].elapsedMs.toFixed(2)),
        heapDeltaMb: Number(median.heapDeltaMb.toFixed(2))
    };
}

/**
 * How late a 20 ms timer fires while `during` is running. When the running
 * work never yields (synchronous scan loop) the delay equals the whole
 * workload; when the work is cooperative the delay stays near the nominal
 * timer duration.
 *
 * @param {() => Promise<void>} during
 * @returns {Promise<number>} Actual timer delay in milliseconds.
 */
async function measureResponsiveDelay(during) {
    const started = process.hrtime.bigint();

    const timer = new Promise((resolve) => {
        setTimeout(() => {
            resolve(
                Number(process.hrtime.bigint() - started) / 1e6
            );
        }, 20);
    });

    await during();

    return timer;
}

/**
 * Baseline mode: the exact synchronous per-open-document scan every event
 * performs today (`updateAllDiagnostics`), measured as one blocking unit.
 *
 * @param {string} sizeKey
 * @returns {Promise<object>}
 */
async function measureBaseline(sizeKey) {
    const layout = createWorkspace(sizeKey);

    try {
        const { sourceFiles, docFiles, root } = layout;

        const openFiles = [...sourceFiles, ...docFiles];

        const activation = measure(() => {
            for (const file of openFiles) {
                refreshDocumentWorkload(file, root);
            }
        });

        const scanThroughput = measure(() =>
            scanOnlyWorkload(sourceFiles)
        );

        const firstDocument = measure(() =>
            firstDocumentWorkload(sourceFiles[0], root)
        );

        const responsiveDelay =
            await awaitResponsiveDelaySync(
                () => {
                    for (const file of openFiles) {
                        refreshDocumentWorkload(file, root);
                    }
                }
            );

        const scanCount = sourceFiles.length;
        const bytes = openFiles.reduce(
            (sum, file) =>
                sum + fs.statSync(file).size,
            0
        );

        const rssMb = Number(
            (
                process.memoryUsage().rss /
                (1024 * 1024)
            ).toFixed(2)
        );

        return {
            tag: "baseline",
            size: sizeKey,
            fileCount: openFiles.length,
            scanCount,
            bytes,
            activationMs: activation.medianMs,
            activationMsMin: activation.minMs,
            activationHeapDeltaMb: activation.heapDeltaMb,
            scanThroughputMs: scanThroughput.medianMs,
            scanThroughputMsMin: scanThroughput.minMs,
            firstDocumentMs: firstDocument.medianMs,
            firstDocumentMsMin: firstDocument.minMs,
            responsiveDelayMs: responsiveDelay,
            rssMb
        };
    } finally {
        removeWorkspace(layout.root);
    }
}

/**
 * Timer delay while a synchronous workload runs (single measurement). The
 * workload is invoked inside the promise executor, so it blocks the event
 * loop until it returns; the 20 ms timer fires immediately afterwards and
 * the measured delay therefore equals the workload duration.
 *
 * @param {() => void} workload
 * @returns {Promise<number>}
 */
function awaitResponsiveDelaySync(workload) {
    const started = process.hrtime.bigint();

    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(
                Number(
                    process.hrtime.bigint() - started
                ) / 1e6
            );
        }, 20);

        workload();
    });
}

/**
 * Build a fresh lazy-scanning pipeline over the workspace layout, mirroring
 * `extension.js`: a shared dependency index + scan cache, a bounded
 * scheduler, and the same priorities (active, open, referenced targets).
 *
 * @param {object} layout
 * @param {string[]} openFiles
 * @param {string} activePath
 */
function buildPipeline(layout, openFiles, activePath) {
    const { root } = layout;

    const index = new ReferenceDependencyIndex();
    const scanner = new ScanScheduler({ concurrency: 3 });

    /** @type {Map<string, number>} */
    const openVersion = new Map(
        openFiles.map((file, version) => [file, version])
    );

    const readDocument = (filePath) =>
        documentFromText(
            fs.readFileSync(filePath, "utf8"),
            getLanguageIdFromExtension(filePath) ??
                "markdown"
        );

    const refreshOpenDocument = async (filePath) => {
        const version = openVersion.get(filePath);

        if (
            version === undefined ||
            index.isCurrent(filePath, version)
        ) {
            return;
        }

        const document = readDocument(filePath);
        const context = referenceContext(root);

        index.set(
            filePath,
            targetsReferencedBy(document, context),
            version
        );

        collectBrokenReferences(
            document,
            context,
            path.relative(root, filePath)
        );

        for (const target of index.targetsOf(filePath)) {
            queueDiskDocument(target);
        }
    };

    const queueDiskDocument = (targetPath) => {
        scanner.enqueue({
            key: targetPath,
            priority: PRIORITY.TARGET,
            run: async () => {
                if (openVersion.has(targetPath)) {
                    await refreshOpenDocument(targetPath);
                    return;
                }

                const version = fileVersion(targetPath);

                if (
                    version === null ||
                    index.isCurrent(targetPath, version)
                ) {
                    return;
                }

                index.set(
                    targetPath,
                    targetsReferencedBy(
                        readDocument(targetPath),
                        referenceContext(root)
                    ),
                    version
                );
            }
        });
    };

    let activeResolve;

    const activeReady = new Promise((resolve) => {
        activeResolve = resolve;
    });

    const queueAllOpen = () => {
        const start = process.hrtime.bigint();

        for (const [filePath, version] of openVersion) {
            if (index.isCurrent(filePath, version)) {
                continue;
            }

            scanner.enqueue({
                key: filePath,
                priority:
                    filePath === activePath
                        ? PRIORITY.ACTIVE
                        : PRIORITY.OPEN,
                run: async () => {
                    await refreshOpenDocument(filePath);

                    if (filePath === activePath) {
                        activeResolve();
                    }
                }
            });
        }

        return Number(
            (process.hrtime.bigint() - start) / 1000000n
        ).toFixed(2);
    };

    return {
        queueAllOpen,
        activeReady,
        idle: () => scanner.idle(),
        isIdle: () => scanner.isIdle()
    };
}

/**
 * After mode: the lazy pipeline. `activate` only enqueues; the active
 * document is scanned on the next tick; the rest of the open documents and
 * their referenced targets drain through a bounded-concurrency queue. The
 * scan cache skips anything already scanned at the current version.
 *
 * @param {string} sizeKey
 * @returns {Promise<object>}
 */
async function measureAfter(sizeKey) {
    const layout = createWorkspace(sizeKey);

    try {
        const { sourceFiles, docFiles } = layout;

        const openFiles = [...sourceFiles, ...docFiles];

        const activePath = sourceFiles[0];

        const activationSyncSamples = [];
        const activeDocSamples = [];
        const drainSamples = [];
        const rescanSamples = [];
        let responsiveDelayMs = 0;

        for (let i = 0; i < 3; i++) {
            const pipeline = buildPipeline(
                layout,
                openFiles,
                activePath
            );

            const activateStart = process.hrtime.bigint();

            activationSyncSamples.push(
                Number(pipeline.queueAllOpen())
            );

            await pipeline.activeReady;

            activeDocSamples.push(
                Number(
                    process.hrtime.bigint() - activateStart
                ) / 1e6
            );

            let timerPromise = null;

            if (i === 0) {
                const timerStart = process.hrtime.bigint();

                timerPromise = new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(
                            Number(
                                process.hrtime.bigint() -
                                    timerStart
                            ) / 1e6
                        );
                    }, 20);
                });
            }

            const drainStart = process.hrtime.bigint();

            await pipeline.idle();

            drainSamples.push(
                Number(
                    process.hrtime.bigint() - drainStart
                ) / 1e6
            );

            if (timerPromise) {
                responsiveDelayMs = await timerPromise;
            }

            const rescanStart = process.hrtime.bigint();

            pipeline.queueAllOpen();
            await pipeline.idle();

            rescanSamples.push(
                Number(
                    process.hrtime.bigint() - rescanStart
                ) / 1e6
            );
        }

        const median = (samples) => {
            const sorted = [...samples].sort((a, b) => a - b);
            return Number(
                sorted[Math.floor(sorted.length / 2)].toFixed(2)
            );
        };

        const min = (samples) =>
            Number(Math.min(...samples).toFixed(2));

        const scanThroughput = measure(() =>
            scanOnlyWorkload(sourceFiles)
        );

        const firstDocument = measure(() =>
            firstDocumentWorkload(sourceFiles[0], layout.root)
        );

        const scanCount = sourceFiles.length;
        const bytes = openFiles.reduce(
            (sum, file) =>
                sum + fs.statSync(file).size,
            0
        );

        const rssMb = Number(
            (
                process.memoryUsage().rss /
                (1024 * 1024)
            ).toFixed(2)
        );

        return {
            tag: "after",
            size: sizeKey,
            fileCount: openFiles.length,
            scanCount,
            bytes,
            activationMs: median(activeDocSamples),
            activationMsMin: min(activeDocSamples),
            activationSyncMs: median(activationSyncSamples),
            activationHeapDeltaMb: 0,
            scanThroughputMs: scanThroughput.medianMs,
            scanThroughputMsMin: scanThroughput.minMs,
            firstDocumentMs: firstDocument.medianMs,
            firstDocumentMsMin: firstDocument.minMs,
            drainMs: median(drainSamples),
            rescanMs: median(rescanSamples),
            responsiveDelayMs,
            rssMb
        };
    } finally {
        removeWorkspace(layout.root);
    }
}

/**
 * @param {string} sizeKey
 * @param {string} tag
 * @returns {Promise<object>}
 */
async function measureSize(sizeKey, tag) {
    if (tag === "after") {
        return measureAfter(sizeKey);
    }

    return measureBaseline(sizeKey);
}

function writeResult(result) {
    const resultsDir = path.join(
        path.dirname(
            fileURLToPath(import.meta.url)
        ),
        "results"
    );

    fs.mkdirSync(resultsDir, { recursive: true });

    const resultPath = path.join(
        resultsDir,
        `${result.tag}-${result.size}.json`
    );

    fs.writeFileSync(
        resultPath,
        JSON.stringify(result, null, 2) + "\n",
        "utf8"
    );
}

/**
 * @param {object[]} results
 */
function printTable(results) {
    for (const result of results) {
        const extra =
            result.drainMs !== undefined
                ? `  drain=${result.drainMs}ms` +
                  `  rescan=${result.rescanMs}ms`
                : "";

        console.log(
            `[${result.tag}] ${result.size} ` +
            `(${result.fileCount} files): ` +
            `activation=${result.activationMs}ms` +
            (result.activationSyncMs !== undefined
                ? ` (sync=${result.activationSyncMs}ms)`
                : "") +
            ` firstDoc=${result.firstDocumentMs}ms` +
            ` scan=${result.scanThroughputMs}ms` +
            ` respDelay=${result.responsiveDelayMs}ms` +
            ` rss=${result.rssMb}MB` +
            extra
        );
    }
}

/**
 * Print the before/after comparison table and return the markdown for the
 * notes file.
 *
 * @param {object[]} baselineResults
 * @param {object[]} afterResults
 * @returns {string}
 */
function compare(baselineResults, afterResults) {
    const bySize = (results) =>
        new Map(results.map((r) => [r.size, r]));

    const before = bySize(baselineResults);
    const after = bySize(afterResults);

    const rows = [
        "| Metric | Size | Before | After | Change |",
        "|---|---|---|---|---|"
    ];

    const metricSpecs = [
        {
            label: "Startup block (all open docs)",
            get: (r) => r.activationMs,
            unit: "ms"
        },
        {
            label: "First document ready",
            get: (r) => r.firstDocumentMs,
            unit: "ms"
        },
        {
            label: "Total background scan",
            get: (r) => r.drainMs ?? r.activationMs,
            unit: "ms"
        },
        {
            label: "Timer delay during scan (20 ms nominal)",
            get: (r) => r.responsiveDelayMs,
            unit: "ms"
        },
        {
            label: "Duplicate re-scan (same version)",
            get: (r) => r.rescanMs,
            unit: "ms"
        }
    ];

    for (const spec of metricSpecs) {
        for (const sizeKey of Object.keys(WORKSPACE_SIZES)) {
            const b = before.get(sizeKey);
            const a = after.get(sizeKey);

            const bValue = spec.get(b);
            const aValue = spec.get(a);

            if (bValue === undefined && aValue === undefined) {
                continue;
            }

            const change =
                bValue === undefined || aValue === undefined
                    ? "—"
                    : bValue === 0
                      ? "—"
                      : `${((aValue / bValue) * 100).toFixed(0)}%`;

            rows.push(
                `| ${spec.label} | ${sizeKey} | ` +
                `${format(bValue, spec.unit)} | ` +
                `${format(aValue, spec.unit)} | ${change} |`
            );
        }
    }

    rows.push("");

    console.log(rows.join("\n"));

    return rows.join("\n");
}

function format(value, unit) {
    if (value === undefined) {
        return "—";
    }

    return `${value.toFixed(2)} ${unit}`;
}

/**
 * @param {object[]} results
 */
function renderResults(results) {
    const lines = results.map((result) => {
        const fields = [
            result.size,
            `files=${result.fileCount}`,
            `activation=${result.activationMs}ms`,
            `sync=${result.activationSyncMs ?? "—"}ms`,
            `firstDoc=${result.firstDocumentMs}ms`,
            `scan=${result.scanThroughputMs}ms`,
            `drain=${result.drainMs ?? "—"}ms`,
            `rescan=${result.rescanMs ?? "—"}ms`,
            `respDelay=${result.responsiveDelayMs}ms`,
            `rss=${result.rssMb}MB`
        ];

        return `- ${result.tag}: ${fields.join(", ")}`;
    });

    return lines.join("\n");
}

async function main() {
    const command = process.argv[2];

    if (command === "compare") {
        const sizes = Object.keys(WORKSPACE_SIZES);

        const baseline = sizes.map((sizeKey) =>
            JSON.parse(
                fs.readFileSync(
                    path.join(
                        path.dirname(
                            fileURLToPath(import.meta.url)
                        ),
                        "results",
                        `baseline-${sizeKey}.json`
                    ),
                    "utf8"
                )
            )
        );

        const after = sizes.map((sizeKey) =>
            JSON.parse(
                fs.readFileSync(
                    path.join(
                        path.dirname(
                            fileURLToPath(import.meta.url)
                        ),
                        "results",
                        `after-${sizeKey}.json`
                    ),
                    "utf8"
                )
            )
        );

        const table = compare(baseline, after);

        const notesPath = path.join(
            path.dirname(
                fileURLToPath(import.meta.url)
            ),
            "..",
            "..",
            "PERFORMANCE.md"
        );

        const notes = fs.readFileSync(notesPath, "utf8");

        const heading = "## Comparison";

        const before = notes.slice(
            0,
            notes.indexOf(heading) === -1
                ? notes.length
                : notes.indexOf(heading)
        );

        const rendered = renderResults([
            ...baseline,
            ...after
        ]);

        fs.writeFileSync(
            notesPath,
            `${before}${heading}\n\n` +
            `Generated from \`test/performance/measure.js\`.\n\n` +
            `${table}\n\n` +
            `## Raw results\n\n${rendered}\n`,
            "utf8"
        );

        return;
    }

    const tag = command;

    if (!tag) {
        console.error(
            "Usage: node test/performance/measure.js <baseline|after|compare>"
        );
        process.exit(1);
    }

    const results = [];

    for (const sizeKey of Object.keys(WORKSPACE_SIZES)) {
        const result = await measureSize(sizeKey, tag);
        writeResult(result);
        results.push(result);
    }

    printTable(results);
}

await main();
