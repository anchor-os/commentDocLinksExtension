// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createDocumentScanner }
    from "../../src/scanning/documentScanning.js";

import {
    ScanScheduler
} from "../../src/scanning/scanScheduler.js";

import {
    ReferenceDependencyIndex
} from "../../src/diagnostics/referenceDependencyIndex.js";

import {
    documentFromText
} from "../../src/references/document.js";

import {
    getLanguageIdFromExtension
} from "../../src/parsers/languageSupport.js";

import { fileVersion }
    from "../../src/scanning/fileVersion.js";

import { resolveInRoot }
    from "../../src/services/pathResolution.js";

/** @type {string} */
let root;

test.before(() => {
    root = fs.realpathSync(
        fs.mkdtempSync(
            path.join(os.tmpdir(), "doc-scanning-")
        )
    );
});

test.after(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

/**
 * @param {string} relativePath
 * @param {string} content
 */
function writeFixture(relativePath, content) {
    const fullPath = path.join(root, relativePath);

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, "utf8");

    return fullPath;
}

/**
 * A document-like object with the fields the scanner orchestration reads
 * from a VS Code document.
 *
 * @param {string} fullPath
 * @param {string} languageId
 * @param {string} content
 */
function documentAt(fullPath, languageId, content) {
    return {
        uri: { fsPath: fullPath },
        version: 1,
        ...documentFromText(content, languageId)
    };
}

/**
 * Build the scanner orchestration against the fixture workspace, returning
 * the scanner and the dependency index so tests can observe what was
 * indexed.
 *
 * @param {{ open: string[], active?: string }} state
 */
function harness(state) {
    const dependencyIndex = new ReferenceDependencyIndex();
    const scanner = new ScanScheduler({ concurrency: 3 });

    /** @type {string[]} */
    const diagnosed = [];

    /** @type {string[]} */
    const refreshed = [];

    const openDocuments = new Map();

    for (const relativePath of state.open) {
        const fullPath = path.join(root, relativePath);
        const languageId =
            getLanguageIdFromExtension(relativePath) ??
            "markdown";
        const content = fs.readFileSync(fullPath, "utf8");

        openDocuments.set(
            fullPath,
            documentAt(fullPath, languageId, content)
        );
    }

    const documentScanner = createDocumentScanner({
        dependencyIndex,
        scanner,
        contextFor: (fsPath) => ({
            resolveTargetPath(relativePath) {
                return resolveInRoot(root, relativePath);
            }
        }),
        openDocumentByPath: (fsPath) =>
            openDocuments.get(fsPath),
        readFile: async (fsPath) =>
            fs.promises.readFile(fsPath, "utf8"),
        updateDiagnostics: (document) =>
            diagnosed.push(document.uri.fsPath),
        refreshDependents: (fsPath) => refreshed.push(fsPath),
        openDocuments: () => [...openDocuments.values()],
        activeDocument: () =>
            state.active
                ? openDocuments.get(path.join(root, state.active))
                : undefined
    });

    return {
        documentScanner,
        dependencyIndex,
        scanner,
        diagnosed,
        refreshed
    };
}

test("open documents publish diagnostics; disk-only scans never do", async () => {
    const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
    const bPath = writeFixture(
        "documentation/b.md",
        "## src/c.js — anchorC\n"
    );

    const { documentScanner, dependencyIndex, scanner, diagnosed } =
        harness({ open: ["src/a.js"], active: "src/a.js" });

    documentScanner.queueOpenDocument(
        documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n"),
        0
    );
    await scanner.idle();

    assert.deepEqual(
        diagnosed,
        [aPath],
        "only the open source must publish diagnostics"
    );

    assert.deepEqual(
        dependencyIndex.targetsOf(bPath),
        [path.join(root, "src", "c.js")],
        "the disk-only target must still be indexed"
    );
});

test("disk-only scans never publish diagnostics for the closed target", async () => {
    const bPath = writeFixture(
        "documentation/b.md",
        "## src/c.js — anchorC\n"
    );

    const { documentScanner, dependencyIndex, scanner, diagnosed } =
        harness({ open: [] });

    documentScanner.queueDocumentAtPath(bPath, 2);
    await scanner.idle();

    assert.deepEqual(
        diagnosed,
        [],
        "a closed document must not publish diagnostics"
    );
    assert.equal(
        dependencyIndex.isCurrent(bPath, fileVersion(bPath)),
        true,
        "the closed target must still be indexed for later use"
    );
});

test("scanning a source refreshes the dependents of its own file", async () => {
    const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
    writeFixture(
        "documentation/b.md",
        "## src/c.js — anchorC\n"
    );

    const { documentScanner, scanner, refreshed } =
        harness({ open: ["src/a.js"], active: "src/a.js" });

    documentScanner.queueOpenDocument(
        documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n"),
        0
    );
    await scanner.idle();

    assert.deepEqual(
        refreshed,
        [aPath],
        "scanning a source must refresh the dependents of that source file"
    );
});

test("referenced targets are pre-scanned and their own targets indexed", async () => {
    const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
    const bPath = writeFixture(
        "documentation/b.md",
        "## src/c.js — anchorC\n"
    );
    const cPath = writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");

    const { documentScanner, dependencyIndex, scanner } =
        harness({ open: ["src/a.js"], active: "src/a.js" });

    const aDoc = documentAt(aPath, "javascript", "// see documentation/b.md#anchorA\n");

    documentScanner.queueOpenDocument(aDoc, 0);
    await scanner.idle();

    assert.deepEqual(
        dependencyIndex.targetsOf(aPath),
        [bPath],
        "the source must be indexed with its target"
    );

    assert.deepEqual(
        dependencyIndex.targetsOf(bPath),
        [cPath],
        "the referenced target must have been pre-scanned and indexed"
    );

    assert.equal(
        dependencyIndex.isCurrent(bPath, fileVersion(bPath)),
        true,
        "the pre-scanned target must carry its file version"
    );

    assert.deepEqual(
        dependencyIndex.dependentsOf(bPath),
        [aPath],
        "b.md must record the scanned source that references it"
    );
});

test("queueDocumentAtPath indexes a target that is not open", async () => {
    writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
    const bPath = writeFixture(
        "documentation/b.md",
        "## src/c.js — anchorC\n"
    );
    const cPath = writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");

    const { documentScanner, dependencyIndex, scanner } =
        harness({ open: [] });

    documentScanner.queueDocumentAtPath(bPath, 2);
    await scanner.idle();

    assert.deepEqual(
        dependencyIndex.targetsOf(bPath),
        [cPath],
        "the on-disk target must be parsed and indexed"
    );

    assert.equal(
        dependencyIndex.isCurrent(bPath, fileVersion(bPath)),
        true,
        "the on-disk target must carry its file version"
    );

    assert.deepEqual(
        dependencyIndex.dependentsOf(cPath),
        [bPath],
        "b.md is a dependent of c.js (its heading references it)"
    );

    assert.equal(
        dependencyIndex.isCurrent(cPath, fileVersion(cPath)),
        false,
        "c.js must not be scanned: only the queued target is indexed"
    );
});

test("the same document version is never scanned twice", async () => {
    const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
    const bPath = writeFixture("documentation/b.md", "## src/c.js — anchorC\n");
    writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");

    let bReads = 0;

    const dependencyIndex = new ReferenceDependencyIndex();
    const scanner = new ScanScheduler({ concurrency: 3 });

    const aDoc = documentAt(
        aPath,
        "javascript",
        "// see documentation/b.md#anchorA\n"
    );

    const documentScanner = createDocumentScanner({
        dependencyIndex,
        scanner,
        contextFor: (fsPath) => ({
            resolveTargetPath(relativePath) {
                return resolveInRoot(root, relativePath);
            }
        }),
        openDocumentByPath: (fsPath) =>
            fsPath === aPath ? aDoc : undefined,
        readFile: async (fsPath) => {
            if (fsPath === bPath) {
                bReads++;
            }

            return fs.promises.readFile(fsPath, "utf8");
        },
        updateDiagnostics: () => {},
        refreshDependents: () => {},
        openDocuments: () => [aDoc],
        activeDocument: () => aDoc
    });

    documentScanner.queueOpenDocument(aDoc, 0);
    await scanner.idle();

    assert.equal(dependencyIndex.isCurrent(aPath, 1), true);

    const targetsAfterFirstScan =
        dependencyIndex.targetsOf(aPath);

    documentScanner.queueOpenDocument(aDoc, 0);
    documentScanner.queueOpenDocument(aDoc, 1);
    documentScanner.queueOpenDocument(aDoc, 2);

    await scanner.idle();

    assert.deepEqual(
        dependencyIndex.targetsOf(aPath),
        targetsAfterFirstScan
    );
    assert.equal(
        bReads,
        1,
        "b.md must only be read once across the duplicate enqueues"
    );
});

test("queueAllOpenDocuments scans active first and every other open document", async () => {
    const aPath = writeFixture("src/a.js", "// see documentation/b.md#anchorA\n");
    const bPath = writeFixture(
        "documentation/b.md",
        "## src/c.js — anchorC\n"
    );
    const cPath = writeFixture("src/c.js", "// see documentation/b.md#anchorA\n");
    const dPath = writeFixture("src/d.js", "// see documentation/missing.md\n");

    const { documentScanner, dependencyIndex, scanner } =
        harness({
            open: ["src/d.js", "src/a.js", "src/c.js"],
            active: "src/a.js"
        });

    documentScanner.queueAllOpenDocuments();
    await scanner.idle();

    assert.deepEqual(dependencyIndex.targetsOf(aPath), [bPath]);
    assert.deepEqual(dependencyIndex.targetsOf(cPath), [bPath]);
    assert.deepEqual(
        dependencyIndex.targetsOf(bPath),
        [cPath],
        "b.md must be pre-scanned from whichever open source referenced it"
    );
    assert.deepEqual(dependencyIndex.targetsOf(dPath), [
        path.join(root, "documentation", "missing.md")
    ]);
});
