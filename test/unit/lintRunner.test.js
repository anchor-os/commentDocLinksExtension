// @ts-check

import assert from "node:assert/strict";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { LintParseError } from "../../src/lint/LintResultParser.js";
import {
  defaultExecutor,
  LintExecutionError,
  runLint,
  runRules,
} from "../../src/lint/LintRunner.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER_FIXTURE = path.resolve(dirname, "../fixtures/lint-launcher/echo-argv.js");

/**
 * @param {string} stdout
 * @param {number} [exitCode]
 * @returns {import("../../src/lint/LintRunner.js").LintExecutor}
 */
const fakeExecutor =
  (stdout, exitCode = 0) =>
  async () => ({ exitCode, stdout, stderr: "" });

/**
 * Captures args + input text passed to the executor.
 * @returns {{ executor: import("../../src/lint/LintRunner.js").LintExecutor, calls: any[] }}
 */
function capturingExecutor() {
  /** @type {any[]} */
  const calls = [];
  const executor = async (executable, args, cwd, _signal, inputText) => {
    calls.push({ executable, args, cwd, inputText });
    return { exitCode: 0, stdout: "", stderr: "" };
  };
  return { executor, calls };
}

test("runLint uses --stdin when buffer text is supplied", async () => {
  const { executor, calls } = capturingExecutor();
  await runLint({ executable: "cbl", file: "/ws/a.js", cwd: "/ws", text: "const x=1;" }, executor);
  assert.deepEqual(calls[0].args, ["--stdin", "/ws/a.js", "--format", "json"]);
  assert.equal(calls[0].inputText, "const x=1;");
});

test("runLint uses file mode when no text is supplied", async () => {
  const { executor, calls } = capturingExecutor();
  await runLint({ executable: "cbl", file: "/ws/a.js", cwd: "/ws" }, executor);
  assert.deepEqual(calls[0].args, ["/ws/a.js", "--format", "json"]);
  assert.equal(calls[0].inputText, undefined);
});

test("runLint parses v1 JSON from a non-zero exit (violations present)", async () => {
  const stdout = JSON.stringify({
    version: 1,
    files: [
      {
        path: "/ws/a.js",
        violations: [
          {
            rule: "r",
            message: "m",
            severity: "error",
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
    summary: {
      errors: 1,
      warnings: 0,
      filesWithViolations: 1,
      filesChecked: 1,
      filesCacheSkipped: 0,
      elapsedMs: 5,
      clean: false,
    },
  });
  const result = await runLint({ executable: "cbl", file: "/ws/a.js" }, fakeExecutor(stdout, 1));
  assert.equal(result.version, 1);
  assert.equal(result.files[0].violations.length, 1);
});

test("runLint rejects on spawn failure (executor throws)", async () => {
  const executor = async () => {
    throw new Error("ENOENT");
  };
  await assert.rejects(
    () => runLint({ executable: "cbl", file: "/ws/a.js" }, executor),
    LintExecutionError,
  );
});

test("runLint rejects when stdout is not v1 JSON", async () => {
  await assert.rejects(
    () => runLint({ executable: "cbl", file: "/ws/a.js" }, fakeExecutor("garbage", 2)),
    LintExecutionError,
  );
});

test("runRules parses the catalog", async () => {
  const rules = [
    {
      name: "no-native-map",
      description: "d",
      defaultSeverity: "error",
      enabledByDefault: true,
      supportedExtensions: [".js"],
    },
  ];
  const result = await runRules(
    { executable: "cbl", cwd: "/ws" },
    fakeExecutor(JSON.stringify(rules)),
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].name, "no-native-map");
});

test("runRules rejects when output is not JSON", async () => {
  await assert.rejects(
    () => runRules({ executable: "cbl", cwd: "/ws" }, fakeExecutor("nope")),
    LintExecutionError,
  );
});

// TODO 1: a `.js` launcher must be run through the current Node/Electron
// runtime (`process.execPath`) so it works on Windows too, where spawning a
// `.js` file directly fails. The fixture prints its own argv; argv[0] being
// the script proves `process.execPath` was the command (cross-platform guard).
test("launches .js launchers through process.execPath (Windows-safe)", async () => {
  const outcome = await defaultExecutor(
    LAUNCHER_FIXTURE,
    ["--stdin", "/ws/a.js", "--format", "json"],
    undefined,
    undefined,
    undefined,
  );
  const argv = JSON.parse(outcome.stdout).argv;
  assert.equal(argv[0], LAUNCHER_FIXTURE, "script must be argv[0] => node ran it");
  assert.deepEqual(argv.slice(1), ["--stdin", "/ws/a.js", "--format", "json"]);
});

void LintParseError;
