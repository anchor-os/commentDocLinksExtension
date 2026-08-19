// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { LintParseError, parseLintResult, parseRules } from "../../src/lint/LintResultParser.js";

test("parses the v1 envelope with violations", () => {
  const json = JSON.stringify({
    version: 1,
    files: [
      {
        path: "/ws/a.js",
        violations: [
          {
            rule: "no-native-map",
            message: "Use Immutable.js Map.",
            severity: "error",
            line: 1,
            col: 7,
            startLine: 1,
            startColumn: 7,
            endLine: 1,
            endColumn: 14,
            fixes: [{ kind: "safe", title: "Replace with Immutable.Map", edits: [] }],
            suppressions: [],
          },
        ],
      },
    ],
    summary: {
      errors: 1,
      warnings: 0,
      filesWithViolations: 1,
      filesChecked: 1,
      filesCacheSkipped: 0,
      elapsedMs: 12,
      clean: false,
    },
  });

  const result = parseLintResult(json);
  assert.equal(result.version, 1);
  assert.equal(result.files.length, 1);
  assert.equal(result.files[0].path, "/ws/a.js");
  assert.equal(result.files[0].violations.length, 1);

  const v = result.files[0].violations[0];
  assert.equal(v.rule, "no-native-map");
  assert.equal(v.severity, "error");
  assert.equal(v.startLine, 1);
  assert.equal(v.startColumn, 7);
  assert.equal(v.endLine, 1);
  assert.equal(v.endColumn, 14);
  assert.equal(v.fixes.length, 1);
  assert.equal(v.fixes[0].kind, "safe");
  assert.equal(v.fixes[0].edits.length, 0);
  assert.equal(v.suppressions.length, 0);

  assert.equal(result.summary?.errors, 1);
  assert.equal(result.summary?.clean, false);
});

test("plural fixes and suppressions are both parsed", () => {
  const json = JSON.stringify({
    version: 1,
    files: [
      {
        path: "a.js",
        violations: [
          {
            rule: "r",
            message: "m",
            severity: "warning",
            startLine: 3,
            startColumn: 1,
            endLine: 3,
            endColumn: 4,
            fixes: [
              {
                kind: "safe",
                title: "Fix A",
                edits: [
                  { startLine: 3, startColumn: 1, endLine: 3, endColumn: 4, replacement: "A" },
                ],
              },
              {
                kind: "unsafe",
                title: "Fix B",
                edits: [
                  { startLine: 3, startColumn: 1, endLine: 3, endColumn: 4, replacement: "B" },
                ],
              },
            ],
            suppressions: [
              {
                kind: "suppress",
                title: "Suppress",
                edits: [
                  {
                    startLine: 3,
                    startColumn: 1,
                    endLine: 3,
                    endColumn: 1,
                    replacement: "// skip\n",
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    summary: null,
  });

  const v = parseLintResult(json).files[0].violations[0];
  assert.equal(v.severity, "warning");
  assert.equal(v.fixes.length, 2);
  assert.equal(v.fixes[0].edits[0].replacement, "A");
  assert.equal(v.fixes[1].kind, "unsafe");
  assert.equal(v.suppressions.length, 1);
  assert.equal(v.suppressions[0].edits[0].replacement, "// skip\n");
});

test("line-only violation (no endLine/endColumn) still parses", () => {
  const json = JSON.stringify({
    version: 1,
    files: [
      {
        path: "a.js",
        violations: [{ rule: "r", message: "m", severity: "error", line: 2, col: 1 }],
      },
    ],
    summary: null,
  });

  const v = parseLintResult(json).files[0].violations[0];
  assert.equal(v.startLine, null);
  assert.equal(v.endLine, null);
});

test("replacement text with an edit is captured", () => {
  const json = JSON.stringify({
    version: 1,
    files: [
      {
        path: "a.js",
        violations: [
          {
            rule: "r",
            message: "m",
            severity: "error",
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 4,
            fixes: [
              {
                kind: "safe",
                title: "t",
                edits: [
                  { startLine: 1, startColumn: 1, endLine: 1, endColumn: 4, replacement: "new" },
                ],
              },
            ],
            suppressions: [],
          },
        ],
      },
    ],
    summary: null,
  });
  const edit = parseLintResult(json).files[0].violations[0].fixes[0].edits[0];
  assert.equal(edit.replacement, "new");
});

test("unknown severity normalizes to error", () => {
  const json = JSON.stringify({
    version: 1,
    files: [
      {
        path: "a.js",
        violations: [
          {
            rule: "r",
            message: "m",
            severity: "info",
            startLine: 1,
            startColumn: 1,
            endLine: 1,
            endColumn: 2,
            fixes: [],
            suppressions: [],
          },
        ],
      },
    ],
    summary: null,
  });
  assert.equal(parseLintResult(json).files[0].violations[0].severity, "error");
});

test("rejects a non-v1 version", () => {
  assert.throws(() => parseLintResult(JSON.stringify({ version: 0, files: [] })), LintParseError);
  assert.throws(() => parseLintResult(JSON.stringify({ files: [] })), LintParseError);
});

test("rejects valid JSON missing the files array", () => {
  assert.throws(() => parseLintResult(JSON.stringify({ version: 1 })), LintParseError);
});

test("rejects non-JSON stdout", () => {
  assert.throws(() => parseLintResult("not json at all"), LintParseError);
});

test("empty stdout yields an empty v1 result", () => {
  const result = parseLintResult("");
  assert.equal(result.version, 1);
  assert.deepEqual(result.files, []);
  assert.equal(result.summary, null);
});

test("parseRules handles a top-level array", () => {
  const rules = parseRules(
    JSON.stringify([
      {
        name: "no-native-map",
        description: "d",
        defaultSeverity: "error",
        enabledByDefault: true,
        supportedExtensions: [".js"],
      },
    ]),
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0].name, "no-native-map");
  assert.equal(rules[0].defaultSeverity, "error");
  assert.deepEqual(rules[0].supportedExtensions, [".js"]);
});

test("parseRules handles an object with a rules array", () => {
  const rules = parseRules(
    JSON.stringify({
      version: 1,
      rules: [
        {
          name: "r",
          description: "d",
          defaultSeverity: "warning",
          enabledByDefault: false,
          supportedExtensions: [],
        },
      ],
    }),
  );
  assert.equal(rules.length, 1);
  assert.equal(rules[0].enabledByDefault, false);
});

test("parseRules returns [] for empty stdout", () => {
  assert.deepEqual(parseRules(""), []);
});
