// @ts-check

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { mapDiagnostics } from "../../src/lint/LintDiagnosticMapper.js";
import { parseLintResult } from "../../src/lint/LintResultParser.js";
import { editToUtf16Range } from "../../src/lint/lintUtf16.js";

/**
 * Adapter-level v1 parity test. Drives the REAL adapter parsing/mapping code
 * (`parseLintResult` + `mapDiagnostics` + `editToUtf16Range`) against the
 * authoritative fixture (test/fixtures/cbl-v1-parity-fixture.json) whose
 * `editor.startChar` / `editor.endChar` are the acceptance oracle. This proves
 * the VSX adapter reproduces the same byte->UTF-16 coordinates the JetBrains
 * adapter and the fixture agree on.
 */

const FIXTURE_PATH = fileURLToPath(
  new URL("../fixtures/cbl-v1-parity-fixture.json", import.meta.url),
);
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

for (const c of fixture.cases) {
  test(`[${c.filename}] adapter maps violation byte columns to editor coords`, () => {
    const result = parseLintResult(JSON.stringify(c.expectedStdout));
    const descriptors = mapDiagnostics(result, c.source);

    // mapDiagnostics preserves file/violation order.
    assert.equal(descriptors.length, c.violations.length);

    c.violations.forEach((expected, i) => {
      const d = descriptors[i];
      assert.equal(d.rule, expected.rule);
      assert.equal(d.range.startLine, expected.editor.line0);
      assert.equal(d.range.startChar, expected.editor.startChar);
      assert.equal(d.range.endLine, expected.editor.line0);

      if (expected.contract.lineOnly) {
        // Line-only rule: adapter highlights the whole line.
        const lineText = c.source.split("\n")[expected.editor.line0] ?? "";
        assert.equal(d.range.endChar, lineText.length);
      } else {
        assert.equal(d.range.endChar, expected.editor.endChar);
      }
    });
  });

  test(`[${c.filename}] adapter converts fix/suppression edits to editor coords`, () => {
    const result = parseLintResult(JSON.stringify(c.expectedStdout));
    const descriptors = mapDiagnostics(result, c.source);

    c.violations.forEach((expected, i) => {
      const d = descriptors[i];
      const sourceLines = c.source.split("\n");
      const compareActions = (actions, expectedActions, kind) => {
        const exp = expectedActions ?? [];
        if (actions.length === 0 && exp.length === 0) return;
        assert.equal(actions.length, exp.length, `${kind} action count`);
        actions.forEach((action, idx) => {
          const editorEdits = expectedActions[idx].edits;
          assert.equal(action.edits.length, editorEdits.length, `${kind}[${idx}] edit count`);
          action.edits.forEach((edit, j) => {
            const editorEdit = editorEdits[j];
            const r = editToUtf16Range(edit, (line0) => sourceLines[line0] ?? "");
            assert.equal(r.startLine, editorEdit.editor.startLine0);
            assert.equal(r.startChar, editorEdit.editor.startChar);
            assert.equal(r.endLine, editorEdit.editor.endLine0);
            assert.equal(r.endChar, editorEdit.editor.endChar);
          });
        });
      };
      compareActions(d.fixes, expected.suggestions.fixes, "fixes");
      compareActions(d.suppressions, expected.suggestions.suppressions, "suppressions");
    });
  });
}
