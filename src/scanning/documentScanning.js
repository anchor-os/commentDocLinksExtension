// @ts-check

import { targetsReferencedBy } from "../diagnostics/referenceDependencyIndex.js";
import { getLanguageIdFromExtension } from "../parsers/languageSupport.js";
import { documentFromText } from "../references/document.js";
import { fileVersionAsync } from "./fileVersion.js";

import { PRIORITY } from "./scanScheduler.js";

/**
 * @typedef {object} ScannerDocument
 * @property {{ fsPath: string }} uri
 * @property {number} version
 * @property {string} languageId
 * @property {number} lineCount
 * @property {(index: number) => { text: string }} lineAt
 */

/**
 * @typedef {object} DocumentScanningDependencies
 * @property {import("../diagnostics/referenceDependencyIndex.js").ReferenceDependencyIndex} dependencyIndex
 * @property {import("./scanScheduler.js").ScanScheduler} scanner
 * @property {(fsPath: string) => import("../references/resolver.js").ReferenceContext} contextFor
 * @property {(fsPath: string) => ScannerDocument|undefined} openDocumentByPath
 * @property {(fsPath: string) => Promise<Uint8Array|string>} readFile
 * @property {(document: ScannerDocument) => void} updateDiagnostics
 * @property {(targetPath: string) => void} refreshDependents
 * @property {() => ScannerDocument[]} openDocuments
 * @property {() => ScannerDocument|undefined} activeDocument
 */

/**
 * Orchestration of lazy background document scanning.
 *
 * Everything here is testable outside the VS Code extension host: the
 * filesystem is injected (`readFile`), open documents are injected
 * (`openDocumentByPath`/`openDocuments`/`activeDocument`), and the reference
 * context plus the diagnostics hooks are injected as callbacks. The only
 * job of the caller is to wire those to `vscode`.
 *
 * @param {DocumentScanningDependencies} deps
 */
export function createDocumentScanner(deps) {
  const {
    dependencyIndex,
    scanner,
    contextFor,
    openDocumentByPath,
    readFile,
    updateDiagnostics,
    refreshDependents,
    openDocuments,
    activeDocument,
  } = deps;

  const indexDocument = (fsPath, document, version = document.version) => {
    dependencyIndex.set(fsPath, targetsReferencedBy(document, contextFor(fsPath)), version);
  };

  const refreshDocument = (document) => {
    indexDocument(document.uri.fsPath, document);
    updateDiagnostics(document);
  };

  /**
   * Queue an on-disk (possibly not open) document for background
   * scanning. Reads are asynchronous; parsing stays on the lightweight
   * custom parser. Diagnostics are only published for documents that are
   * actually open — for everything else this just warms the dependency
   * index and the scan cache.
   *
   * @param {string} fsPath
   * @param {number} priority
   */
  const queueDocumentAtPath = (fsPath, priority) => {
    scanner.enqueue({
      key: fsPath,
      priority,
      run: async () => {
        const document = openDocumentByPath(fsPath);

        if (document) {
          await scanOpenDocument(document, priority);
          return;
        }

        const version = await fileVersionAsync(fsPath);

        if (version === null || dependencyIndex.isCurrent(fsPath, version)) {
          return;
        }

        const text = await readFile(fsPath);

        // The file can be rewritten while it is being read, in
        // which case the text above would be cached under a version
        // token that no longer describes it. Drop the torn read; the
        // next scan of a document that references this path queues
        // it again.
        if ((await fileVersionAsync(fsPath)) !== version) {
          return;
        }

        indexDocument(
          fsPath,
          documentFromText(
            typeof text === "string" ? text : Buffer.from(text).toString("utf8"),
            getLanguageIdFromExtension(fsPath) ?? "markdown",
          ),
          version,
        );
      },
    });
  };

  /**
   * Scan a document (index its targets, refresh its diagnostics, queue
   * its referenced targets) unless it was already scanned at the current
   * version. A stale enqueued job re-checks here and aborts.
   *
   * @param {ScannerDocument} document
   * @param {number} priority
   */
  const scanOpenDocument = async (document, _priority) => {
    if (dependencyIndex.isCurrent(document.uri.fsPath, document.version)) {
      return;
    }

    refreshDocument(document);

    refreshDependents(document.uri.fsPath);

    queueReferencedTargetsOfPath(document.uri.fsPath);
  };

  /**
   * Queue the files a scanned source document references so they are
   * parsed (and their own targets indexed) shortly after the document
   * that uses them. Referenced targets outrank unrelated open documents
   * in the queue.
   *
   * @param {string} sourcePath
   */
  const queueReferencedTargetsOfPath = (sourcePath) => {
    for (const targetPath of dependencyIndex.targetsOf(sourcePath)) {
      queueDocumentAtPath(targetPath, PRIORITY.TARGET);
    }
  };

  /**
   * @param {ScannerDocument} document
   */
  const queueReferencedTargets = (document) => {
    queueReferencedTargetsOfPath(document.uri.fsPath);
  };

  /**
   * Queue an open document for background scanning at the given priority.
   *
   * @param {ScannerDocument} document
   * @param {number} priority
   */
  const queueOpenDocument = (document, priority) => {
    const fsPath = document.uri.fsPath;

    if (dependencyIndex.isCurrent(fsPath, document.version)) {
      return;
    }

    scanner.enqueue({
      key: fsPath,
      priority,
      run: () => scanOpenDocument(document, priority),
    });
  };

  /**
   * Queue every open document, active editor first. Runs during
   * activation and after configuration changes; the scheduler defers the
   * first batch so nothing here blocks startup.
   */
  const queueAllOpenDocuments = () => {
    const active = activeDocument();
    const activePath = active?.uri.fsPath;
    const open = openDocuments();

    if (active && open.some((document) => document.uri.fsPath === activePath)) {
      queueOpenDocument(active, PRIORITY.ACTIVE);
    }

    for (const document of open) {
      if (document.uri.fsPath !== activePath) {
        queueOpenDocument(document, PRIORITY.OPEN);
      }
    }
  };

  return {
    queueOpenDocument,
    queueDocumentAtPath,
    scanOpenDocument,
    queueReferencedTargets,
    queueAllOpenDocuments,
  };
}
