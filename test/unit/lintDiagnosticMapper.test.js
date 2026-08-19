// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { mapDiagnostic, mapDiagnostics } from "../../src/lint/LintDiagnosticMapper.js";

/**
 * @param {Partial<import("../../src/lint/LintResultParser.js").LintViolation>} v
 * @returns {import("../../src/lint/LintResultParser.js").LintViolation}
 */
function violation(v) {
  return {
    rule: "no-native-map",
    message: "Use Immutable.js Map.",
    severity: "error",
    line: null,
    col: null,
    startLine: 1,
    startColumn: 7,
    endLine: 1,
    endColumn: 14,
    fixes: [],
    suppressions: [],
    ...v,
  };
}

test("maps an ASCII violation to 0-based UTF-16 coords", () => {
  const d = mapDiagnostic(
    violation({ startLine: 1, startColumn: 7, endLine: 1, endColumn: 14 }),
    "const m = new Map();",
  );
  assert.equal(d.rule, "no-native-map");
  assert.equal(d.severity, "error");
  assert.equal(d.code, "no-native-map");
  assert.deepEqual(d.range, { startLine: 0, startChar: 6, endLine: 0, endChar: 13 });
  assert.equal(d.source, "custom-biome-lint");
});

test("byte->UTF-16 conversion resolves non-ASCII content BEFORE the diagnostic", () => {
  // Line: "你x" — 你 is 3 UTF-8 bytes (char 0), x is byte 4 (char 1).
  const line = "你x";
  const d = mapDiagnostic(
    violation({ startLine: 1, startColumn: 4, endLine: 1, endColumn: 5 }),
    line,
  );
  assert.deepEqual(d.range, { startLine: 0, startChar: 1, endLine: 0, endChar: 2 });
});

test("é (2-byte) byte column converts to the correct UTF-16 char", () => {
  // "aéb": a=byte1, é=bytes2-3 (char1), b=byte4 (char2); exclusive end byte 4 -> char 2
  const line = "aéb";
  const d = mapDiagnostic(
    violation({ startLine: 1, startColumn: 2, endLine: 1, endColumn: 4 }),
    line,
  );
  assert.deepEqual(d.range, { startLine: 0, startChar: 1, endLine: 0, endChar: 2 });
});

test("astral 😀 byte column converts to the correct UTF-16 span", () => {
  // "a😀b": a=byte1, 😀=bytes2-5 (chars1-2), b=byte6 (char3); exclusive end byte 6 -> char 3
  const line = "a😀b";
  const d = mapDiagnostic(
    violation({ startLine: 1, startColumn: 2, endLine: 1, endColumn: 6 }),
    line,
  );
  assert.deepEqual(d.range, { startLine: 0, startChar: 1, endLine: 0, endChar: 3 });
});

test("line-only violation highlights the whole line", () => {
  const line = "const x = 1;";
  const d = mapDiagnostic(
    violation({
      line: 1,
      col: 1,
      startLine: null,
      startColumn: null,
      endLine: null,
      endColumn: null,
    }),
    line,
  );
  assert.deepEqual(d.range, { startLine: 0, startChar: 0, endLine: 0, endChar: line.length });
});

test("warning severity is preserved", () => {
  const d = mapDiagnostic(violation({ severity: "warning" }), "const m = new Map();");
  assert.equal(d.severity, "warning");
});

test("fix and suppression descriptors carry edits and titles", () => {
  const d = mapDiagnostic(
    violation({
      fixes: [
        {
          kind: "safe",
          title: "Apply safe fix",
          edits: [
            {
              startLine: 1,
              startColumn: 7,
              endLine: 1,
              endColumn: 14,
              replacement: "Immutable.Map",
            },
          ],
        },
      ],
      suppressions: [
        {
          kind: "suppress",
          title: "Suppress no-native-map",
          edits: [
            { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1, replacement: "// skip\n" },
          ],
        },
      ],
    }),
    "const m = new Map();",
  );
  assert.equal(d.fix?.title, "Apply safe fix");
  assert.equal(d.fix?.edits[0].replacement, "Immutable.Map");
  assert.equal(d.suppression?.title, "Suppress no-native-map");
  assert.equal(d.suppression?.edits[0].replacement, "// skip\n");
});

test("absent fixes/suppressions produce null descriptors", () => {
  const d = mapDiagnostic(violation({ fixes: [], suppressions: [] }), "x");
  assert.equal(d.fix, null);
  assert.equal(d.suppression, null);
});

test("docsUrl falls back to the configured rule URL", () => {
  const d = mapDiagnostic(violation({}), "x");
  assert.equal(
    d.docsUrl,
    "https://github.com/anchor-os/custom-biome-lint/blob/main/docs/rules/no-native-map.md",
  );
});

test("mapDiagnostics flattens all files/violations", () => {
  const result = {
    version: 1,
    files: [
      { path: "a.js", violations: [violation({ rule: "r1", message: "m1" })] },
      {
        path: "b.js",
        violations: [
          violation({ rule: "r2", message: "m2" }),
          violation({ rule: "r3", message: "m3" }),
        ],
      },
    ],
    summary: null,
  };
  const descriptors = mapDiagnostics(result, "");
  assert.equal(descriptors.length, 3);
  assert.equal(descriptors[0].code, "r1");
  assert.equal(descriptors[2].code, "r3");
});

test("message is suffixed with the canonical rule link", () => {
  const d = mapDiagnostic(violation({}), "x");
  assert.equal(d.message, "Use Immutable.js Map.\n\ncustom-biome-lint/no-native-map");
});
