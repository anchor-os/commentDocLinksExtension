// @ts-check

import { parseMarkdownHeading }
    from "../parsers/markdownParser.js";

import { scanDocumentForReferences }
    from "../references/documentScanner.js";

import { resolveReference }
    from "../references/resolver.js";

import {
    REFERENCE_TYPE
} from "../references/referenceTypes.js";

/**
 * Session-only index of which source documents reference which target
 * files.
 *
 * Two maps keep the invariant consistent:
 *
 *   sourcePath → Set<targetPath>   (forward)
 *   targetPath → Set<sourcePath>   (reverse)
 *
 * Target paths are the FINAL resolved absolute paths produced by the shared
 * resolver, so two worktrees that both contain `documentation/api.md` stay
 * isolated. The index is never persisted and only ever holds documents that
 * have actually been scanned during this session.
 */
export class ReferenceDependencyIndex {

    /** @type {Map<string, Set<string>>} */
    #sources = new Map();

    /** @type {Map<string, Set<string>>} */
    #targets = new Map();

    /**
     * Version token the document was last scanned at. The index is the
     * single scan cache: a source is only re-scanned when its version moves
     * on, which is how duplicate background work is avoided.
     *
     * @type {Map<string, unknown>}
     */
    #versions = new Map();

    /**
     * Replace the dependency entries of a source document and record the
     * version it was scanned at.
     *
     * @param {string} sourcePath
     * @param {Iterable<string>} targetPaths
     * @param {unknown} [version]
     *   Opaque content version (for example the document version, or a
     *   file mtime/size token for on-disk documents).
     */
    set(sourcePath, targetPaths, version = null) {
        this.remove(sourcePath);

        const targets = new Set(targetPaths);

        if (targets.size === 0) {
            this.#versions.set(sourcePath, version);
            return;
        }

        this.#sources.set(sourcePath, targets);

        for (const target of targets) {
            const dependents =
                this.#targets.get(target) ?? new Set();

            dependents.add(sourcePath);
            this.#targets.set(target, dependents);
        }

        this.#versions.set(sourcePath, version);
    }

    /**
     * True when the source document is already scanned at the given
     * version. Consumers skip re-scanning in that case.
     *
     * @param {string} sourcePath
     * @param {unknown} version
     * @returns {boolean}
     */
    isCurrent(sourcePath, version) {
        return this.#versions.get(sourcePath) === version;
    }

    /**
     * Targets a source document references, from its last scan.
     *
     * @param {string} sourcePath
     * @returns {string[]}
     */
    targetsOf(sourcePath) {
        return [...(this.#sources.get(sourcePath) ?? [])];
    }

    /**
     * Drop every dependency entry of a source document.
     *
     * @param {string} sourcePath
     */
    remove(sourcePath) {
        this.#versions.delete(sourcePath);

        const targets = this.#sources.get(sourcePath);

        if (!targets) {
            return;
        }

        for (const target of targets) {
            const dependents = this.#targets.get(target);

            if (!dependents) {
                continue;
            }

            dependents.delete(sourcePath);

            if (dependents.size === 0) {
                this.#targets.delete(target);
            }
        }

        this.#sources.delete(sourcePath);
    }

    /**
     * Indexed source documents that reference the given target.
     *
     * @param {string} targetPath
     * @returns {string[]}
     */
    dependentsOf(targetPath) {
        return [...(this.#targets.get(targetPath) ?? [])];
    }

    /**
     * Drop every entry. Used when a configuration change requires a full
     * refresh.
     */
    reset() {
        this.#sources.clear();
        this.#targets.clear();
        this.#versions.clear();
    }

    /**
     * @returns {number} Number of indexed source documents.
     */
    sourceCount() {
        return this.#sources.size;
    }

    /**
     * @returns {number} Number of distinct tracked targets.
     */
    targetCount() {
        return this.#targets.size;
    }
}

/**
 * Resolved absolute paths of every target a document references.
 *
 * Uses the same scanners and the same centralized resolver as every other
 * feature. Resolution is I/O-free: a reference to a not-yet-existing file
 * still records its resolved path, so creating that file later can trigger
 * invalidation of the referencing document.
 *
 * @param {import("../references/documentScanner.js").DocumentLike} document
 * @param {import("../references/resolver.js").ReferenceContext} context
 * @returns {Set<string>}
 */
export function targetsReferencedBy(document, context) {
    const targets = new Set();

    if (document.languageId === "markdown") {
        for (let i = 0; i < document.lineCount; i++) {
            const parsed = parseMarkdownHeading(
                document.lineAt(i).text
            );

            if (!parsed) {
                continue;
            }

            const target =
                context.resolveTargetPath(parsed.source);

            if (target !== null) {
                targets.add(target);
            }
        }

        return targets;
    }

    for (const { reference } of
        scanDocumentForReferences(document)) {
        if (reference.type !== REFERENCE_TYPE.DOCUMENTATION) {
            continue;
        }

        const resolution = resolveReference(reference, context);

        if (resolution.kind === "file") {
            targets.add(resolution.targetPath);
        }
    }

    return targets;
}

/**
 * Open documents whose diagnostics must be refreshed when a document
 * changes: the changed document itself plus every indexed source that
 * references it. Unrelated open documents are never included.
 *
 * @param {ReferenceDependencyIndex} index
 * @param {string} changedPath
 * @param {Set<string>} openDocumentPaths
 * @returns {string[]}
 */
export function documentsToRefresh(
    index,
    changedPath,
    openDocumentPaths
) {
    const refreshed = new Set();

    if (openDocumentPaths.has(changedPath)) {
        refreshed.add(changedPath);
    }

    for (const dependent of index.dependentsOf(changedPath)) {
        if (openDocumentPaths.has(dependent)) {
            refreshed.add(dependent);
        }
    }

    return [...refreshed];
}
