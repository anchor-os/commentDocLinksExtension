// @ts-check

import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { LintParseError, parseLintResult, parseRules } from "./LintResultParser.js";

/**
 * Run `custom-biome-lint` and parse its v1 JSON output into a {@link LintResult}.
 *
 * Strategy (matches the other adapters): prefer stdin mode
 * (`echo <buffer> | custom-biome-lint --stdin <virtualPath> --format json`) so
 * unsaved editor buffers are linted without touching disk; fall back to file
 * mode (`custom-biome-lint <path> --format json`) when no buffer text is
 * available. Both modes emit the same v1 envelope; a non-zero exit code caused
 * by violations is normal and must NOT be treated as a failure — we still parse
 * the captured stdout.
 *
 * We deliberately do NOT rely on `util.promisify(execFile)` alone: it rejects on
 * a non-zero exit and discards the captured stdout, so a "has violations" run
 * would be misreported as an execution error. Instead we resolve with the
 * captured stdout/stderr/exitCode from the callback regardless of exit code, and
 * only reject on spawn errors (e.g. binary not found).
 *
 * @typedef {import("./LintResultParser.js").LintResult} LintResult
 * @typedef {import("./LintResultParser.js").LintRule} LintRule
 */

/**
 * @typedef {object} LintRunOutcome
 * @property {number} exitCode
 * @property {string} stdout
 * @property {string} stderr
 */

/**
 * @typedef {object} LintRunOptions
 * @property {string} executable Absolute/relative binary path.
 * @property {string} file The file path (also the stdin virtual path).
 * @property {string} [cwd]
 * @property {AbortSignal} [signal]
 * @property {string} [text] Editor buffer text; when present, stdin mode is used.
 */

/**
 * @typedef {(executable: string, args: string[], cwd: string|undefined, signal: AbortSignal|undefined, inputText: string|undefined) => Promise<LintRunOutcome>} LintExecutor
 */

/**
 * Real executor. Resolves even on a non-zero exit so violations parse correctly.
 * @type {LintExecutor}
 */
export const defaultExecutor = (executable, args, cwd, signal, inputText) =>
  new Promise((resolve, reject) => {
    // On Windows a `.js` CLI cannot be executed directly (no shebang
    // handling by CreateProcess). Relaunch JS launchers through a REAL Node.js
    // executable resolved from `PATH` — never `process.execPath`, which inside
    // the VS Code Extension Host is the Electron binary and cannot run a `.js`
    // file. Native binaries (no JS extension) are spawned as-is.
    const isJsLauncher = /\.(?:js|cjs|mjs)$/i.test(executable);
    let command = executable;
    let finalArgs = args;
    if (isJsLauncher) {
      const node = findNodeExecutable();
      if (node) {
        command = node;
        finalArgs = [executable, ...args];
      }
      // Without a resolvable Node runtime we still attempt the script directly;
      // on Unix the OS shebang runs it, while Windows without Node surfaces a
      // clean spawn error rather than a false "clean" result.
    }

    const child = execFile(
      command,
      finalArgs,
      { cwd, maxBuffer: 64 * 1024 * 1024, windowsHide: true, timeout: 30_000 },
      /**
       * @param {Error & { code?: string | number }} error
       * @param {string | Buffer} stdout
       * @param {string | Buffer} stderr
       */
      (error, stdout, stderr) => {
        // On a non-zero exit, `error` is non-null but stdout/stderr are still
        // populated — that is exactly the "has violations" case we must parse.
        const exitCode = error && typeof error.code === "number" ? error.code : error ? 1 : 0;
        resolve({
          exitCode,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
        });
      },
    );

    if (signal) {
      if (signal.aborted) {
        child.kill("SIGTERM");
      } else {
        signal.addEventListener(
          "abort",
          () => {
            child.kill("SIGTERM");
          },
          { once: true },
        );
      }
    }

    if (inputText != null) {
      // The linter may exit before draining stdin (EPIPE). Swallow the write
      // error; the captured stdout is still resolved by the execFile callback.
      child.stdin?.on("error", () => {});
      child.stdin?.end(inputText);
    }

    // Spawn-level errors (ENOENT, EACCES) reject — these are genuine failures.
    child.on("error", reject);
  });

/**
 * Locate a real Node.js executable to launch JS launchers.
 *
 * Inside the VS Code Extension Host `process.execPath` is the Electron binary,
 * not Node — spawning a `.js` file with it loads an Electron app instead of
 * running the script. We resolve an actual `node` from `PATH` instead. The
 * workspace installed `custom-biome-lint` via npm, so `node` is on `PATH` in
 * every realistic environment. Returns `null` when none is found.
 *
 * @returns {string|null}
 */
export function findNodeExecutable(platform = process.platform) {
  const pathEnv = process.env.PATH ?? "";
  const isWindows = platform === "win32";
  const names = isWindows ? ["node.exe", "nodejs.exe"] : ["node", "nodejs"];
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    for (const name of names) {
      const candidate = path.join(dir, name);
      try {
        if (fs.statSync(candidate).isFile()) return candidate;
      } catch {
        // Not present in this directory; keep looking.
      }
    }
  }
  return null;
}

/**
 * @param {LintRunOptions} options
 * @param {LintExecutor} [executor]
 * @returns {Promise<LintResult>}
 */
export async function runLint(options, executor = defaultExecutor) {
  const { executable, file, cwd, signal, text } = options;
  const args = text != null ? ["--stdin", file, "--format", "json"] : [file, "--format", "json"];

  let outcome;
  try {
    outcome = await executor(executable, args, cwd, signal, text);
  } catch (cause) {
    throw new LintExecutionError(
      `failed to spawn custom-biome-lint: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  try {
    // A valid lint run always emits the v1 envelope on stdout. Empty stdout
    // means the linter produced no JSON at all — a timeout, crash, killed
    // process, or a spawn failure surfaced here — and must NEVER be treated as
    // a clean result, because that would silently clear real diagnostics.
    // Surface an execution error instead so existing diagnostics are preserved.
    if (outcome.stdout.trim().length === 0) {
      const stderr = outcome.stderr.trim();
      const detail = stderr.length > 0 ? `: ${stderr}` : "";
      throw new LintExecutionError(
        `custom-biome-lint produced no lint output (exit ${outcome.exitCode})${detail}`,
      );
    }
    return parseLintResult(outcome.stdout);
  } catch (error) {
    if (error instanceof LintParseError) {
      throw new LintExecutionError(
        `custom-biome-lint produced no parseable v1 json (exit ${outcome.exitCode}): ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Fetch the rule catalog via `custom-biome-lint --rules`.
 * @param {{ executable: string, cwd?: string, signal?: AbortSignal }} options
 * @param {LintExecutor} [executor]
 * @returns {Promise<LintRule[]>}
 */
export async function runRules(options, executor = defaultExecutor) {
  const { executable, cwd, signal } = options;
  let outcome;
  try {
    outcome = await executor(executable, ["--rules"], cwd, signal, undefined);
  } catch (cause) {
    throw new LintExecutionError(
      `failed to spawn custom-biome-lint: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
  }

  try {
    // A valid --rules run always emits JSON. Empty stdout (timeout, crash, or
    // spawn failure) must not become a successful empty rule list.
    if (outcome.stdout.trim().length === 0) {
      const stderr = outcome.stderr.trim();
      const detail = stderr.length > 0 ? `: ${stderr}` : "";
      throw new LintExecutionError(
        `custom-biome-lint --rules produced no output (exit ${outcome.exitCode})${detail}`,
      );
    }
    return parseRules(outcome.stdout);
  } catch (error) {
    if (error instanceof LintParseError) {
      throw new LintExecutionError(
        `custom-biome-lint --rules produced no parseable json (exit ${outcome.exitCode}): ${error.message}`,
      );
    }
    throw error;
  }
}

/**
 * Error thrown when the binary cannot be spawned or its output is not v1 JSON.
 * Distinguishes "binary failed" from "had violations".
 */
export class LintExecutionError extends Error {
  constructor(message) {
    super(message);
    this.name = "LintExecutionError";
  }
}
