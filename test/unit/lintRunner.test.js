// @ts-check

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { parseLintResult } from "../../src/lint/LintResultParser.js";
import {
  defaultExecutor,
  findNodeExecutable,
  LintExecutionError,
  runLint,
  runRules,
} from "../../src/lint/LintRunner.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const LAUNCHER_FIXTURE = path.resolve(dirname, "../fixtures/lint-launcher/echo-argv.js");
const CBL_JSON_FIXTURE = path.resolve(dirname, "../fixtures/lint-launcher/cbl-emit-json.js");

/**
 * @param {string} stdout
 * @param {number} [exitCode]
 * @param {string} [stderr]
 * @returns {import("../../src/lint/LintRunner.js").LintExecutor}
 */
const fakeExecutor =
  (stdout, exitCode = 0, stderr = "") =>
  async () => ({ exitCode, stdout, stderr });

/**
 * Captures args + input text passed to the executor.
 * @returns {{ executor: import("../../src/lint/LintRunner.js").LintExecutor, calls: any[] }}
 */
function capturingExecutor() {
  /** @type {any[]} */
  const calls = [];
  const executor = async (executable, args, cwd, _signal, inputText) => {
    calls.push({ executable, args, cwd, inputText });
    // Valid (empty) v1 envelope so runLint accepts the captured-run result.
    return {
      exitCode: 0,
      stdout: JSON.stringify({ version: 1, files: [], summary: null }),
      stderr: "",
    };
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

// A `.js` launcher must be run through a REAL Node runtime, never
// `process.execPath` (which is the Electron binary inside the VS Code Extension
// Host and cannot run a `.js` file). The fixture prints its own argv; argv[0]
// being the script proves an actual Node ran it (cross-platform guard).
test("launches .js launchers through a real Node runtime (not process.execPath)", async () => {
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

test("findNodeExecutable resolves a real Node from PATH", () => {
  const node = findNodeExecutable();
  assert.ok(node, "expected node on PATH in the test environment");
  assert.ok(/\bnode(\.exe)?$/i.test(node.replace(/\\/g, "/")), `unexpected node path: ${node}`);
});

test("findNodeExecutable resolves node.exe on a Windows PATH", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cbl-node-"));
  try {
    fs.writeFileSync(path.join(tmp, "node.exe"), "");
    const prev = process.env.PATH;
    process.env.PATH = tmp;
    try {
      const node = findNodeExecutable("win32");
      assert.ok(node, "expected node.exe on the Windows PATH");
      assert.ok(node.toLowerCase().endsWith("node.exe"), `unexpected: ${node}`);
    } finally {
      process.env.PATH = prev;
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

// --- Real execution strategy (un-mocked executor) ----------------------------
// These prove the production path: LintRunner -> real Node -> cli.js ->
// valid v1 JSON -> parsed result, without mocking process.execPath.

test("real execution: .js launcher via Node yields valid v1 JSON (macOS/Linux)", async () => {
  const result = await runLint(
    { executable: CBL_JSON_FIXTURE, file: "/ws/a.js", cwd: process.cwd(), text: "const x = 1;" },
    defaultExecutor,
  );
  assert.equal(result.version, 1);
  // "const x = 1;" has no BAD marker, so the fixture reports a clean file.
  assert.equal(result.files[0].violations.length, 0);
});

test("real execution: absolute path containing spaces is passed through intact", async () => {
  const result = await runLint(
    {
      executable: CBL_JSON_FIXTURE,
      file: "/ws/a file with space.js",
      cwd: process.cwd(),
      text: "BAD",
    },
    defaultExecutor,
  );
  assert.equal(result.files[0].path, "/ws/a file with space.js");
  assert.equal(result.files[0].violations.length, 1);
});

test("real execution: native (non-.js) executable is spawned directly, not via Node", async () => {
  // /bin/sh is a real native binary; the JSON it emits proves the command was
  // spawned as-is (a `.js` launcher would have been rewritten to `node <exe>`).
  const outcome = await defaultExecutor(
    "/bin/sh",
    ["-c", 'printf \'%s\' \'{"version":1,"files":[],"summary":null}\''],
    undefined,
    undefined,
    undefined,
  );
  const result = parseLintResult(outcome.stdout);
  assert.equal(result.version, 1);
});

test("real execution: Windows drive-letter style path is handled", async () => {
  // Simulate a Windows absolute path; the fixture echoes it back unchanged.
  const result = await runLint(
    {
      executable: CBL_JSON_FIXTURE,
      file: "C:\\ws\\a.js",
      cwd: process.cwd(),
      text: "BAD",
    },
    defaultExecutor,
  );
  assert.equal(result.files[0].path, "C:\\ws\\a.js");
});

// --- Fix 3: empty stdout / failures must never be "clean" --------------------

test("runLint treats empty stdout as an execution failure, not a clean result", async () => {
  await assert.rejects(
    () => runLint({ executable: "cbl", file: "/ws/a.js" }, fakeExecutor("", 1)),
    LintExecutionError,
  );
});

test("runLint treats a stderr-only failure as an execution failure", async () => {
  await assert.rejects(
    () => runLint({ executable: "cbl", file: "/ws/a.js" }, fakeExecutor("", 2, "boom")),
    LintExecutionError,
  );
});

test("runLint still accepts valid JSON on a non-zero exit (violations present)", async () => {
  const stdout = JSON.stringify({
    version: 1,
    files: [{ path: "/ws/a.js", violations: [{ rule: "r", message: "m", severity: "error" }] }],
    summary: {
      errors: 1,
      warnings: 0,
      filesWithViolations: 1,
      filesChecked: 1,
      filesCacheSkipped: 0,
      elapsedMs: 1,
      clean: false,
    },
  });
  const result = await runLint({ executable: "cbl", file: "/ws/a.js" }, fakeExecutor(stdout, 1));
  assert.equal(result.files[0].violations.length, 1);
});

test("runLint accepts valid JSON on exit 0 as well", async () => {
  const stdout = JSON.stringify({ version: 1, files: [], summary: null });
  const result = await runLint({ executable: "cbl", file: "/ws/a.js" }, fakeExecutor(stdout, 0));
  assert.equal(result.version, 1);
});

test("runRules treats empty stdout as an execution failure", async () => {
  await assert.rejects(
    () => runRules({ executable: "cbl", cwd: "/ws" }, fakeExecutor("", 1)),
    LintExecutionError,
  );
});
