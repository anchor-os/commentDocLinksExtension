// @ts-check

import { lintActive } from "./LintConfig.js";
import { mapDiagnostics } from "./LintDiagnosticMapper.js";

/**
 * Orchestrates linting for the extension. Talks only to an injected
 * {@link LintHost} (IDE plumbing) and a {@link LintProvider} (the linter),
 * so it is fully unit-testable without `vscode`.
 *
 * Responsibilities:
 *  - gate on configured languages (JS/JSX only) and availability,
 *  - debounce document changes,
 *  - drop stale results (only the latest request per file is published),
 *  - track per-file status (NOT_INSTALLED / AVAILABLE / RUNNING / ERROR),
 *  - clean up timers and in-flight runs on dispose.
 */

/**
 * @typedef {"NOT_INSTALLED"|"AVAILABLE"|"RUNNING"|"ERROR"} LintStatus
 */

/**
 * @typedef {object} LintDocument A minimal document shape.
 * @property {{ fsPath: string }} uri
 * @property {string} languageId
 * @property {number} version
 */

/**
 * @typedef {object} LintHost IDE-side plumbing injected by extension.js.
 * @property {() => import("./LintConfig.js").ResolvedLintConfig} getConfig
 * @property {(document: LintDocument, descriptors: import("./LintDiagnosticMapper.js").DiagnosticDescriptor[]) => void} setDiagnostics
 * @property {(document: LintDocument) => void} clearDiagnostics
 * @property {(message: string) => void} [log]
 * @property {(document: LintDocument) => string} [getDocumentText]
 *   Optional source-text lookup used for byte->UTF-16 coordinate conversion.
 */

export const LINT_LANGUAGES = new Set(["javascript", "javascriptreact"]);

/**
 * @param {string} languageId
 * @returns {boolean}
 */
export function isLintableLanguage(languageId) {
  return LINT_LANGUAGES.has(languageId);
}

/**
 * @param {LintDocument} document
 * @returns {string}
 */
function fsPathOf(document) {
  return document.uri.fsPath;
}

export class LintManager {
  /**
   * @param {{
   *   host: LintHost,
   *   provider: import("./LintProvider.js").LintProvider,
   *   debounceMs?: number,
   * }} options
   */
  constructor({ host, provider, debounceMs = 250 }) {
    this.host = host;
    this.provider = provider;
    this.debounceMs = debounceMs;

    /** @type {Map<string, ReturnType<typeof setTimeout>>} */
    this.#timers = new Map();

    /** @type {Map<string, number>} latest request id per file */
    this.#latestRequestId = new Map();

    /** @type {Map<string, AbortController>} active controller per file */
    this.#controllers = new Map();

    /** @type {Map<string, LintStatus>} */
    this.#status = new Map();

    /** @type {Map<string, string>} last error message per file */
    this.#errors = new Map();
  }

  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  #timers;

  /** @type {Map<string, number>} */
  #latestRequestId;

  /** @type {Map<string, AbortController>} */
  #controllers;

  /** @type {Map<string, LintStatus>} */
  #status;

  /** @type {Map<string, string>} */
  #errors;

  /**
   * Request a lint pass. Debounced unless `immediate` (open / save /
   * explicit command).
   *
   * @param {LintDocument} document
   * @param {{ immediate?: boolean }} [options]
   */
  lintDocument(document, { immediate = false } = {}) {
    const fsPath = fsPathOf(document);

    if (!isLintableLanguage(document.languageId)) {
      // Never lint non-JS/JSX files; clear any stale diagnostics.
      this.#clearTimer(fsPath);
      this.host.clearDiagnostics(document);
      return;
    }

    if (immediate) {
      this.#clearTimer(fsPath);
      void this.#run(document);
      return;
    }

    this.#clearTimer(fsPath);

    const timer = setTimeout(() => {
      this.#timers.delete(fsPath);
      void this.#run(document);
    }, this.debounceMs);

    this.#timers.set(fsPath, timer);
  }

  /**
   * Clear diagnostics for a closed/removed document.
   *
   * @param {LintDocument} document
   */
  clearDocument(document) {
    const fsPath = fsPathOf(document);

    this.#clearTimer(fsPath);
    this.#controllers.get(fsPath)?.abort();
    this.#controllers.delete(fsPath);
    // Bump the request id so any in-flight result fails the stale guard and
    // cannot publish diagnostics onto a document that was just cleared/closed.
    this.#latestRequestId.set(fsPath, (this.#latestRequestId.get(fsPath) ?? 0) + 1);
    this.host.clearDiagnostics(document);
  }

  /**
   * Restart: drop caches and re-lint the supplied open documents.
   *
   * @param {LintDocument[]} documents
   */
  restart(documents) {
    this.provider.clearCache?.();
    this.#status.clear();
    this.#errors.clear();

    for (const document of documents) {
      if (isLintableLanguage(document.languageId)) {
        this.lintDocument(document, { immediate: true });
      }
    }
  }

  /**
   * @param {string} fsPath
   * @returns {LintStatus}
   */
  statusFor(fsPath) {
    return this.#status.get(fsPath) ?? "NOT_INSTALLED";
  }

  /**
   * @param {string} fsPath
   * @returns {string|null}
   */
  lastErrorFor(fsPath) {
    return this.#errors.get(fsPath) ?? null;
  }

  /**
   * @param {LintDocument} document
   */
  async #run(document) {
    const fsPath = fsPathOf(document);
    const config = this.host.getConfig();

    const installed = this.provider.isAvailable(fsPath);

    if (!lintActive(config, installed)) {
      // Feature disabled or package not installed: clear any stale
      // diagnostics and stay silent (no error, no notification).
      this.host.clearDiagnostics(document);
      this.#status.set(fsPath, "NOT_INSTALLED");
      return;
    }

    // Cancel any still-running lint for this file; only the newest wins.
    this.#controllers.get(fsPath)?.abort();

    const controller = new AbortController();

    this.#controllers.set(fsPath, controller);

    const requestId = (this.#latestRequestId.get(fsPath) ?? 0) + 1;

    this.#latestRequestId.set(fsPath, requestId);
    this.#status.set(fsPath, "RUNNING");

    try {
      const text = this.host?.getDocumentText ? this.host.getDocumentText(document) : undefined;
      const result = await this.provider.lint({
        file: fsPath,
        text,
        signal: controller.signal,
      });

      // Stale guard: a newer request started while we were running.
      if (this.#latestRequestId.get(fsPath) !== requestId) {
        return;
      }

      const descriptors = mapDiagnostics(result, text ?? "");

      this.host.setDiagnostics(document, descriptors);
      this.#status.set(fsPath, "AVAILABLE");
      this.#errors.delete(fsPath);
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) {
        return;
      }

      if (this.#latestRequestId.get(fsPath) !== requestId) {
        return;
      }

      const message = error instanceof Error ? error.message : String(error);

      this.#errors.set(fsPath, message);
      this.#status.set(fsPath, "ERROR");
      this.host.log?.(`custom-biome-lint: ${message}`);
      // Do not leave stale diagnostics from a previous successful run.
      this.host.clearDiagnostics(document);
    } finally {
      if (this.#controllers.get(fsPath) === controller) {
        this.#controllers.delete(fsPath);
      }
    }
  }

  /**
   * @param {string} fsPath
   */
  #clearTimer(fsPath) {
    const timer = this.#timers.get(fsPath);

    if (timer !== undefined) {
      clearTimeout(timer);
      this.#timers.delete(fsPath);
    }
  }

  dispose() {
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }

    this.#timers.clear();

    for (const controller of this.#controllers.values()) {
      controller.abort();
    }

    this.#controllers.clear();
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isAbortError(error) {
  return error instanceof Error && (error.name === "AbortError" || error.name === "CanceledError");
}
