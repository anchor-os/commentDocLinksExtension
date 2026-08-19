// @ts-check
// Fixture emulating `custom-biome-lint --stdin <file> --format json` (v1).
// Spawned for real by LintRunner's defaultExecutor through a real Node runtime
// so the production execution path (node -> cli.js -> v1 JSON -> parse) is
// exercised end to end, not mocked.

import { readFileSync } from "node:fs";

let source = "";
const stdinIdx = process.argv.indexOf("--stdin");
if (stdinIdx >= 0) {
  try {
    source = readFileSync(0, "utf8");
  } catch {
    // No stdin provided; treat as empty source.
  }
} else {
  const fileArg = process.argv.find((a) => !a.startsWith("--") && a !== process.argv[1]);
  if (fileArg) {
    try {
      source = readFileSync(fileArg, "utf8");
    } catch {
      // Missing file; treat as empty source.
    }
  }
}

const filePath =
  stdinIdx >= 0
    ? process.argv[stdinIdx + 1]
    : (process.argv.find((a) => !a.startsWith("--") && a !== process.argv[1]) ?? "file");

const hasViolation = source.includes("BAD");
const result = {
  version: 1,
  files: [
    {
      path: filePath,
      violations: hasViolation
        ? [
            {
              rule: "no-bad",
              message: "source contains BAD",
              severity: "error",
              line: 1,
              col: 1,
              startLine: 1,
              startColumn: 1,
              endLine: 1,
              endColumn: 4,
              fixes: [],
              suppressions: [],
            },
          ]
        : [],
    },
  ],
  summary: {
    errors: hasViolation ? 1 : 0,
    warnings: 0,
    filesWithViolations: hasViolation ? 1 : 0,
    filesChecked: 1,
    filesCacheSkipped: 0,
    elapsedMs: 1,
    clean: !hasViolation,
  },
};

process.stdout.write(JSON.stringify(result));
