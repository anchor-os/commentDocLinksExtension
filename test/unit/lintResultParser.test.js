// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { LintParseError, parseLintResult } from "../../src/lint/LintResultParser.js";

const ERROR_DIAGNOSTIC = {
  rule: "no-native-map",
  message: "Use Immutable.js Map instead of native Map.",
  severity: "error",
  range: {
    start: { line: 1, column: 7 },
    end: { line: 1, column: 14 },
  },
};

test("parses an empty result", () => {
  assert.deepEqual(parseLintResult(""), { diagnostics: [] });
  assert.deepEqual(parseLintResult("  "), { diagnostics: [] });
});

test("parses a single error diagnostic with positions", () => {
  const result = parseLintResult(JSON.stringify({ diagnostics: [ERROR_DIAGNOSTIC] }));

  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].rule, "no-native-map");
  assert.equal(result.diagnostics[0].severity, "error");
  assert.deepEqual(result.diagnostics[0].range.start, { line: 1, column: 7 });
});

test("parses warn severity", () => {
  const result = parseLintResult(
    JSON.stringify({
      diagnostics: [{ ...ERROR_DIAGNOSTIC, severity: "warn" }],
    }),
  );

  assert.equal(result.diagnostics[0].severity, "warn");
});

test("normalizes unknown severity to error", () => {
  const result = parseLintResult(
    JSON.stringify({
      diagnostics: [{ ...ERROR_DIAGNOSTIC, severity: "fatal" }],
    }),
  );

  assert.equal(result.diagnostics[0].severity, "error");
});

test("parses a safe fix", () => {
  const result = parseLintResult(
    JSON.stringify({
      diagnostics: [
        {
          ...ERROR_DIAGNOSTIC,
          fix: {
            kind: "safe",
            title: "Apply safe fix",
            edits: [
              {
                start: { line: 1, column: 7 },
                end: { line: 1, column: 14 },
                text: "Immutable.Map()",
              },
            ],
          },
        },
      ],
    }),
  );

  const fix = result.diagnostics[0].fix;

  assert.ok(fix);
  assert.equal(fix.kind, "safe");
  assert.equal(fix.edits.length, 1);
  assert.equal(fix.edits[0].text, "Immutable.Map()");
});

test("parses a suppression edit", () => {
  const result = parseLintResult(
    JSON.stringify({
      diagnostics: [
        {
          ...ERROR_DIAGNOSTIC,
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
        },
      ],
    }),
  );

  const suppression = result.diagnostics[0].suppression;

  assert.ok(suppression);
  assert.equal(suppression.edits[0].text, "// custom-biome-ignore-next-line no-native-map\n");
});

test("drops fix/suppression when edits are missing", () => {
  const result = parseLintResult(
    JSON.stringify({
      diagnostics: [{ ...ERROR_DIAGNOSTIC, fix: { kind: "safe", title: "x" }, suppression: {} }],
    }),
  );

  assert.equal(result.diagnostics[0].fix, null);
  assert.equal(result.diagnostics[0].suppression, null);
});

test("throws on invalid JSON", () => {
  assert.throws(() => parseLintResult("{ not json"), LintParseError);
});

test("throws when diagnostics array is missing", () => {
  assert.throws(() => parseLintResult(JSON.stringify({})), LintParseError);
});

test("throws when a diagnostic is malformed", () => {
  assert.throws(
    () =>
      parseLintResult(
        JSON.stringify({
          diagnostics: [{ rule: "x", message: "y", range: { start: {}, end: {} } }],
        }),
      ),
    LintParseError,
  );
});
