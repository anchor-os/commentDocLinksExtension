// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveLintConfig } from "../../src/lint/LintConfig.js";
import { isLintableLanguage, LintManager } from "../../src/lint/LintManager.js";
import { LintProvider } from "../../src/lint/LintProvider.js";
import { LintExecutionError } from "../../src/lint/LintRunner.js";

/**
 * @param {import("../../src/lint/LintConfig.js").ResolvedLintConfig} [config]
 */
function makeHost(config = resolveLintConfig()) {
  /** @type {Array<{ document: any, descriptors: any[] }>} */
  const setCalls = [];
  /** @type {any[]} */
  const cleared = [];
  /** @type {string[]} */
  const logs = [];

  return {
    config,
    getConfig() {
      return this.config;
    },
    setDiagnostics(document, descriptors) {
      setCalls.push({ document, descriptors });
    },
    clearDiagnostics(document) {
      cleared.push(document);
    },
    log(message) {
      logs.push(message);
    },
    _setCalls: setCalls,
    _cleared: cleared,
    _logs: logs,
  };
}

/**
 * @param {string} fsPath
 * @param {string} [languageId]
 */
function doc(fsPath, languageId = "javascript") {
  return { uri: { fsPath }, languageId, version: 1 };
}

class ResultProvider extends LintProvider {
  /**
   * @param {import("../../src/lint/LintResultParser.js").LintResult} result
   * @param {boolean} [available]
   */
  constructor(result, available = true) {
    super();
    this.result = result;
    this.available = available;
    this.calls = 0;
    this.cacheCleared = 0;
  }

  isAvailable() {
    return this.available;
  }

  async lint() {
    this.calls += 1;
    return this.result;
  }

  clearCache() {
    this.cacheCleared += 1;
  }
}

const RAW = {
  rule: "no-native-map",
  message: "Use Immutable.js Map instead of native Map.",
  severity: "error",
  range: { start: { line: 1, column: 7 }, end: { line: 1, column: 14 } },
};

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("isLintableLanguage restricts to JS/JSX", () => {
  assert.equal(isLintableLanguage("javascript"), true);
  assert.equal(isLintableLanguage("javascriptreact"), true);
  assert.equal(isLintableLanguage("typescript"), false);
  assert.equal(isLintableLanguage("markdown"), false);
});

test("clears diagnostics when the package is not installed", async () => {
  const host = makeHost();
  const manager = new LintManager({
    host,
    provider: new ResultProvider({ diagnostics: [RAW] }, false),
  });

  manager.lintDocument(doc("/ws/a.js"), { immediate: true });
  await flush();

  assert.equal(host._cleared.length, 1);
  assert.equal(host._setCalls.length, 0);
  assert.equal(manager.statusFor("/ws/a.js"), "NOT_INSTALLED");
});

test("publishes mapped diagnostics when available", async () => {
  const host = makeHost();
  const manager = new LintManager({ host, provider: new ResultProvider({ diagnostics: [RAW] }) });

  manager.lintDocument(doc("/ws/a.js"), { immediate: true });
  await flush();

  assert.equal(host._setCalls.length, 1);
  assert.equal(host._setCalls[0].descriptors[0].code, "no-native-map");
  assert.equal(manager.statusFor("/ws/a.js"), "AVAILABLE");
});

test("never lints unsupported languages", async () => {
  const host = makeHost();
  const provider = new ResultProvider({ diagnostics: [RAW] });
  const manager = new LintManager({ host, provider });

  manager.lintDocument(doc("/ws/a.md", "markdown"), { immediate: true });
  await flush();

  assert.equal(provider.calls, 0);
  assert.equal(host._cleared.length, 1);
});

test("debounces rapid change events into a single run", async () => {
  const host = makeHost();
  const provider = new ResultProvider({ diagnostics: [RAW] });
  const manager = new LintManager({ host, provider, debounceMs: 20 });

  manager.lintDocument(doc("/ws/a.js"));
  manager.lintDocument(doc("/ws/a.js"));
  manager.lintDocument(doc("/ws/a.js"));

  await new Promise((resolve) => setTimeout(resolve, 60));

  assert.equal(provider.calls, 1);
  assert.equal(host._setCalls.length, 1);
});

test("drops stale results in favor of the latest request", async () => {
  const host = makeHost();

  /** @type {Array<(r: any) => void>} */
  const pending = [];

  const provider = new LintProvider();
  provider.isAvailable = () => true;
  provider.lint = () => new Promise((resolve) => pending.push(resolve));

  const manager = new LintManager({ host, provider });

  const older = {
    rule: "old-rule",
    message: "old",
    severity: "error",
    range: { start: { line: 1, column: 0 }, end: { line: 1, column: 1 } },
  };
  const newer = {
    rule: "new-rule",
    message: "new",
    severity: "warn",
    range: { start: { line: 2, column: 0 }, end: { line: 2, column: 1 } },
  };

  manager.lintDocument(doc("/ws/a.js"), { immediate: true });
  manager.lintDocument(doc("/ws/a.js"), { immediate: true });

  assert.equal(pending.length, 2);

  pending[0]({ diagnostics: [older] });
  await flush();

  // Older result must be ignored.
  assert.equal(host._setCalls.length, 0);

  pending[1]({ diagnostics: [newer] });
  await flush();

  assert.equal(host._setCalls.length, 1);
  assert.equal(host._setCalls[0].descriptors[0].code, "new-rule");
});

test("reports ERROR and clears stale diagnostics on execution failure", async () => {
  const host = makeHost();
  const provider = new LintProvider();
  provider.isAvailable = () => true;
  provider.lint = () => {
    throw new LintExecutionError("boom");
  };

  const manager = new LintManager({ host, provider });

  manager.lintDocument(doc("/ws/a.js"), { immediate: true });
  await flush();

  assert.equal(manager.statusFor("/ws/a.js"), "ERROR");
  assert.equal(manager.lastErrorFor("/ws/a.js"), "boom");
  assert.equal(host._logs.length, 1);
  assert.equal(host._cleared.length, 1);
});

test("restart clears the provider cache and re-lints", async () => {
  const host = makeHost();
  const provider = new ResultProvider({ diagnostics: [RAW] });
  const manager = new LintManager({ host, provider });

  manager.restart([doc("/ws/a.js")]);
  await flush();

  assert.equal(provider.cacheCleared, 1);
  assert.equal(host._setCalls.length, 1);
});

test("clearDocument removes diagnostics and aborts in-flight runs", async () => {
  const host = makeHost();

  /** @type {Array<(r: any) => void>} */
  const pending = [];
  const provider = new LintProvider();
  provider.isAvailable = () => true;
  provider.lint = () => new Promise((resolve) => pending.push(resolve));

  const manager = new LintManager({ host, provider });

  manager.lintDocument(doc("/ws/a.js"), { immediate: true });
  manager.clearDocument(doc("/ws/a.js"));

  assert.equal(host._cleared.length, 1);
  assert.equal(pending.length, 1);
});
