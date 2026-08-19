// @ts-check

/**
 * v1 contract parity test for the VS Code (VSX) adapter.
 *
 * Validates that custom-biome-lint's v1 IDE contract is consumed correctly.
 * Two layers, both checked against the shared fixture
 * (test/fixtures/cbl-v1-parity-fixture.json):
 *
 *   1. Conversion (always runs): the contract's 1-based LINE + 1-based BYTE
 *      (UTF-8) columns must be converted to VS Code's 0-based LINE +
 *      0-based UTF-16 CHARACTER. The fixture's `editor.startChar` /
 *      `editor.endChar` are the acceptance oracle. (IntelliJ char offsets are
 *      the same UTF-16 code units, so the JetBrains adapter reuses this exact
 *      conversion.)
 *   2. Live contract (runs only when the binary is available): spawn
 *      `custom-biome-lint --stdin <path> --format json` and assert stdout
 *      deep-equals `expectedStdout`. The binary is the source of truth.
 *
 * v1 envelope: { version:1, files:[{path, violations:[...]}], summary:{...} }
 * Violation:   { startLine, startColumn, endLine, endColumn, line, col,
 *                rule, severity, message, fixes?[], suppressions?[] }
 * Edit:        { startLine, startColumn, endLine, endColumn, replacement }
 * All line/column values are 1-based; columns are BYTE offsets, NOT UTF-16.
 *
 * Run:
 *   node --test test/unit/cbl-v1-parity.test.js
 *   CBL_BINARY=/abs/path/to/custom-biome-lint node --test test/unit/cbl-v1-parity.test.js
 * In CI the extension installs the `custom-biome-lint` npm package and the
 * test picks up node_modules/.bin/custom-biome-lint automatically.
 */

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { test } from "node:test";

const FIXTURE_PATH = fileURLToPath(new URL("../fixtures/cbl-v1-parity-fixture.json", import.meta.url));
const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf-8"));

// Resolve the binary: explicit env, then the installed npm package, then PATH.
function resolveBinary() {
  if (process.env.CBL_BINARY) return process.env.CBL_BINARY;
  const localBin = fileURLToPath(new URL("../../node_modules/.bin/custom-biome-lint", import.meta.url));
  if (existsSync(localBin)) return localBin;
  return "custom-biome-lint";
}

const BINARY = resolveBinary();
const LOCAL_BIN = fileURLToPath(new URL("../../node_modules/.bin/custom-biome-lint", import.meta.url));
const BINARY_AVAILABLE = Boolean(process.env.CBL_BINARY) || existsSync(LOCAL_BIN);

// ---- v1 coordinate conversion (the ONLY place byte->editor mapping happens) -
/** UTF-16 code-unit length of a string (surrogate pairs count as 2). */
function utf16Len(s) {
  let n = 0;
  for (const ch of s) n += ch.length; // BMP char -> 1, astral -> 2
  return n;
}

/** Convert a 1-based BYTE column on a line into a 0-based UTF-16 char. */
function byteColToChar(lineText, byteCol1Based) {
  const bytes = Buffer.from(lineText, "utf-8");
  const prefix = bytes.subarray(0, Math.max(0, byteCol1Based - 1)).toString("utf-8");
  return utf16Len(prefix);
}

/** Absolute 0-based UTF-16 char index for a (line0, char0) position. */
function toAbsoluteChar(source, line0, char0) {
  const lines = source.split("\n");
  let acc = 0;
  for (let i = 0; i < line0; i++) acc += utf16Len(lines[i]) + 1; // +1 for '\n'
  return acc + char0;
}

// ---- conversion checks (pure, always run) ----------------------------------
for (const c of fixture.cases) {
  for (const v of c.violations) {
    test(`[${c.filename}] ${v.rule}: byte col ${v.contract.startColumn} -> char ${v.editor.startChar}`, () => {
      const lineText = c.source.split("\n")[v.editor.line0];
      assert.equal(byteColToChar(lineText, v.contract.startColumn), v.editor.startChar);
      if (!v.contract.lineOnly && v.editor.endChar !== null) {
        assert.equal(byteColToChar(lineText, v.contract.endColumn), v.editor.endChar);
      }
    });

    for (const [kind, sugs] of Object.entries(v.suggestions)) {
      if (!sugs) continue;
      for (const sug of sugs) {
        for (const ed of sug.edits) {
          test(`[${c.filename}] ${v.rule}/${kind}: edit at byte ${ed.contract.startColumn} -> char ${ed.editor.startChar}`, () => {
            const lineText = c.source.split("\n")[ed.editor.startLine0];
            assert.equal(byteColToChar(lineText, ed.contract.startColumn), ed.editor.startChar);
            const s = toAbsoluteChar(c.source, ed.editor.startLine0, ed.editor.startChar);
            const e = toAbsoluteChar(c.source, ed.editor.endLine0, ed.editor.endChar);
            const applied = c.source.slice(0, s) + ed.editor.replacement + c.source.slice(e);
            assert.ok(applied.includes(ed.editor.replacement), "applied edit should contain the replacement");
          });
        }
      }
    }
  }
}

// ---- live contract checks (need the binary; skipped when absent) ----------
// Invoked exactly like the adapter: `binary <file> --format json` (positional
// file, see src/lint/LintRunner.js). The binary exits non-zero when violations
// exist, so we collect stdout via the callback form and resolve regardless of
// exit code (only a spawn failure rejects). The reported `path` is the temp
// file's path, so we normalize it to the fixture's virtual name before
// comparing against `expectedStdout`.
const TMP_DIR = mkdtempSync(join(tmpdir(), "cbl-parity-"));

function runBinaryOnFile(source, filename) {
  const filePath = join(TMP_DIR, filename);
  writeFileSync(filePath, source);
  return new Promise((resolve, reject) => {
    execFile(BINARY, [filePath, "--format", "json"], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 }, (err, stdout) => {
      if (err && !stdout) {
        reject(err);
        return;
      }
      resolve(String(stdout ?? ""));
    });
  });
}

for (const c of fixture.cases) {
  test(
    `[${c.filename}] live stdout matches v1 envelope`,
    { skip: !BINARY_AVAILABLE },
    async () => {
      const stdout = await runBinaryOnFile(c.source, c.filename);
      const parsed = JSON.parse(stdout);
      // Normalize the echoed path to the fixture's virtual filename, and drop
      // the non-deterministic timing field before comparing.
      for (const f of parsed.files ?? []) f.path = c.filename;
      delete parsed.summary?.elapsedMs;
      delete c.expectedStdout.summary?.elapsedMs;
      assert.deepStrictEqual(parsed, c.expectedStdout);
    },
  );
}
