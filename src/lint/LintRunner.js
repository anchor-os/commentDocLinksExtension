// @ts-check

import { execFile } from "node:child_process";
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
    const child = execFile(
      executable,
      args,
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
    if (outcome.stdout.trim().length === 0 && outcome.stderr.trim().length > 0) {
      throw new LintExecutionError(
        `custom-biome-lint failed (exit ${outcome.exitCode}): ${outcome.stderr.trim()}`,
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
    // A failed --rules invocation that writes only stderr must not become a
    // successful empty rule list.
    if (outcome.stdout.trim().length === 0 && outcome.stderr.trim().length > 0) {
      throw new LintExecutionError(
        `custom-biome-lint --rules failed (exit ${outcome.exitCode}): ${outcome.stderr.trim()}`,
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
