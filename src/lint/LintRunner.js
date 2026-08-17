// @ts-check

import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { LintParseError, parseLintResult } from "./LintResultParser.js";

/**
 * Execute the installed `custom-biome-lint` binary and return its raw
 * result. This is the ONLY module that knows about `child_process`; the
 * rest of the extension talks to {@link import("./LintProvider.js")}.
 *
 * The executor is injectable so the runner can be unit-tested without
 * spawning a real binary.
 */

const execFileAsync = promisify(execFile);

/**
 * @typedef {object} LintRunOptions
 * @property {string} executable Absolute path to the resolved binary.
 * @property {string} file Absolute path to the file to lint.
 * @property {string} cwd Working directory (the package's config root).
 * @property {AbortSignal} [signal] Optional cancellation signal.
 */

/**
 * @typedef {object} LintRunOutcome
 * @property {number} exitCode Process exit code.
 * @property {string} stdout Captured stdout (expected to be JSON).
 * @property {string} stderr Captured stderr (logs/errors).
 */

/**
 * Default executor: run `executable file --format json` in `cwd`.
 *
 * @param {string} executable
 * @param {string} file
 * @param {string} cwd
 * @param {AbortSignal|undefined} signal
 * @returns {Promise<LintRunOutcome>}
 */
async function defaultExecutor(executable, file, cwd, signal) {
  const { stdout, stderr } = await execFileAsync(executable, [file, "--format", "json"], {
    cwd,
    signal,
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true,
  });

  return {
    exitCode: 0,
    stdout: typeof stdout === "string" ? stdout : String(stdout ?? ""),
    stderr: typeof stderr === "string" ? stderr : String(stderr ?? ""),
  };
}

/**
 * @typedef {(executable: string, file: string, cwd: string, signal: AbortSignal|undefined) => Promise<LintRunOutcome>} LintExecutor
 */

/**
 * Run the linter and parse its JSON output.
 *
 * A non-zero exit code is expected when violations exist and is NOT treated
 * as a failure — `execFileAsync` only rejects on a non-zero exit when no
 * stdout/stderr handler captured output. With our handlers it resolves and
 * we inspect `exitCode` ourselves, so violations parse normally.
 *
 * @param {LintRunOptions} options
 * @param {LintExecutor} [executor]
 * @returns {Promise<import("./LintResultParser.js").LintResult>}
 */
export async function runLint(options, executor = defaultExecutor) {
  const { executable, file, cwd, signal } = options;

  const outcome = await executor(executable, file, cwd, signal);

  try {
    return parseLintResult(outcome.stdout);
  } catch (error) {
    if (error instanceof LintParseError) {
      const detail = outcome.stderr.trim();

      throw new LintExecutionError(
        `custom-biome-lint produced no usable JSON${detail ? `: ${detail}` : ""}`,
        { exitCode: outcome.exitCode, stderr: outcome.stderr },
      );
    }

    throw error;
  }
}

/**
 * Thrown when the linter could not be executed or produced no parseable
 * output (a real failure, as opposed to a result containing violations).
 */
export class LintExecutionError extends Error {
  /**
   * @param {string} message
   * @param {{ exitCode: number, stderr: string }} [meta]
   */
  constructor(message, meta) {
    super(message);
    this.name = "LintExecutionError";
    this.exitCode = meta?.exitCode ?? -1;
    this.stderr = meta?.stderr ?? "";
  }
}
