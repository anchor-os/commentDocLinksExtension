// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { mapDiagnostic, mapDiagnostics } from "../../src/lint/LintDiagnosticMapper.js";

const RAW = {
  rule: "no-native-map",
  message: "Use Immutable.js Map instead of native Map.",
  severity: "error",
  range: {
    start: { line: 1, column: 7 },
    end: { line: 1, column: 14 },
  },
  fix: {
    kind: "safe",
    title: "Apply safe fix",
    edits: [
      { start: { line: 1, column: 7 }, end: { line: 1, column: 14 }, text: "Immutable.Map()" },
    ],
  },
  suppression: {
    title: "Suppress no-native-map",
    edits: [
      {
        start: { line: 1, column: 0 },
        end: { line: 1, column: 0 },
        text: "// custom-biome-ignore-next-line no-native-map\n",
      },
    ],
  },
};

test("maps 1-based line to 0-based and keeps column", () => {
  const descriptor = mapDiagnostic(RAW);

  assert.deepEqual(descriptor.range, {
    startLine: 0,
    startChar: 7,
    endLine: 0,
    endChar: 14,
  });
});

test("maps severity, code and source", () => {
  const descriptor = mapDiagnostic(RAW);

  assert.equal(descriptor.severity, "error");
  assert.equal(descriptor.code, "no-native-map");
  assert.equal(descriptor.source, "custom-biome-lint");
});

test("builds a message that names the rule", () => {
  const descriptor = mapDiagnostic(RAW);

  assert.equal(
    descriptor.message,
    "Use Immutable.js Map instead of native Map.\n\ncustom-biome-lint/no-native-map",
  );
});

test("maps warn severity", () => {
  assert.equal(mapDiagnostic({ ...RAW, severity: "warn" }).severity, "warn");
});

test("preserves fix and suppression", () => {
  const descriptor = mapDiagnostic(RAW);

  assert.ok(descriptor.fix);
  assert.equal(descriptor.fix.kind, "safe");
  assert.ok(descriptor.suppression);
});

test("falls back to the central documentation URL", () => {
  const descriptor = mapDiagnostic(RAW);

  assert.equal(
    descriptor.docsUrl,
    "https://github.com/anchor-os/custom-biome-lint/blob/main/docs/rules/no-native-map.md",
  );
});

test("prefers an explicit docsUrl from the diagnostic", () => {
  const descriptor = mapDiagnostic({ ...RAW, docsUrl: "https://example.com/no-native-map" });

  assert.equal(descriptor.docsUrl, "https://example.com/no-native-map");
});

test("mapDiagnostics maps every diagnostic", () => {
  const descriptors = mapDiagnostics({ diagnostics: [RAW, { ...RAW, rule: "no-for-statement" }] });

  assert.equal(descriptors.length, 2);
  assert.equal(descriptors[1].code, "no-for-statement");
});
