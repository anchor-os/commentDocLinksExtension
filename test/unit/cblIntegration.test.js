// @ts-check

import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { mapDiagnostics } from "../../src/lint/LintDiagnosticMapper.js";
import { runLint, runRules } from "../../src/lint/LintRunner.js";
import { byteColumnToUtf16Char } from "../../src/lint/lintUtf16.js";

/**
 * Locate a real `custom-biome-lint` binary. The only binary present in this
 * repo (`test/fixtures/lint-workspace/.../custom-biome-lint`) is a fake
 * placeholder, so we probe each candidate with `--rules` and accept only one
 * whose output parses to a v1 rule catalog. Returns null when no real binary
 * is available — callers must skip the suite in that case.
 *
 * @returns {Promise<string|null>}
 */
async function resolveRealBinary() {
  /** @type {string[]} */
  const candidates = [
    "custom-biome-lint",
    join(process.cwd(), "node_modules", ".bin", "custom-biome-lint"),
  ];
  for (const candidate of candidates) {
    try {
      const { stdout } = await new Promise((resolve, reject) =>
        execFile(candidate, ["--rules"], { windowsHide: true }, (err, out, errOut) => {
          if (err && !(err.stdout ?? out)) reject(err);
          else resolve({ stdout: String(out ?? ""), stderr: String(errOut ?? "") });
        }),
      );
      const trimmed = stdout.trim();
      if (trimmed.startsWith("[") || trimmed.startsWith("{")) return candidate;
    } catch {
      // not this one
    }
  }
  return null;
}

/**
 * @param {string} binary
 * @param {string} source
 * @returns {{ version: number, files: any[], summary: any }}
 */
async function lintFixture(binary, source) {
  const dir = mkdtempSync(join(tmpdir(), "cbl-int-"));
  const file = join(dir, "sample.js");
  writeFileSync(file, source, "utf8");
  try {
    return await runLint({ executable: binary, file, cwd: dir, text: source });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("real binary: v1 envelope + byte->UTF-16 coordinate consistency", async (t) => {
  const binary = await resolveRealBinary();
  if (!binary) {
    t.skip("no real custom-biome-lint binary on PATH / node_modules; skipping integration");
    return;
  }

  // Non-ASCII content BEFORE the diagnostic exercises the byte->UTF-16 mapping.
  const source = ["const emoji = '😀';", "const m = new Map();", "export const x = m;", ""].join(
    "\n",
  );

  const result = await lintFixture(binary, source);

  assert.equal(result.version, 1);
  assert.ok(Array.isArray(result.files));

  // Raw violations carry the binary's byte columns; descriptors carry our
  // converted UTF-16 offsets. mapDiagnostics preserves file/violation order,
  // so we zip them and prove our conversion reproduces the binary's intent.
  const rawViolations = result.files.flatMap((f) => f.violations);
  const descriptors = mapDiagnostics(result, source);
  assert.equal(descriptors.length, rawViolations.length);

  for (let i = 0; i < descriptors.length; i++) {
    const d = descriptors[i];
    const v = rawViolations[i];
    const lineText = source.split("\n")[d.range.startLine] ?? "";
    const expectedStartChar = byteColumnToUtf16Char(lineText, v.startColumn ?? 1);
    assert.equal(d.range.startChar, expectedStartChar, `startChar mismatch for ${d.rule}`);
    assert.ok(d.range.startChar >= 0, "startChar within bounds");
    assert.ok(
      d.range.endLine !== d.range.startLine || d.range.endChar <= lineText.length,
      "endChar within bounds",
    );
  }
});

test("real binary: --rules returns a catalog", async (t) => {
  const binary = await resolveRealBinary();
  if (!binary) {
    t.skip("no real custom-biome-lint binary; skipping integration");
    return;
  }
  const rules = await runRules({ executable: binary, cwd: process.cwd() });
  assert.ok(Array.isArray(rules));
  assert.ok(rules.length > 0, "rule catalog is non-empty");
  assert.ok(rules[0].name.length > 0);
  assert.ok(Array.isArray(rules[0].supportedExtensions));
});
