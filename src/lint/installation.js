// @ts-check

import fs from "node:fs";
import path from "node:path";

/**
 * Detection + resolution of the optional `custom-biome-lint` package.
 *
 * The lint feature is OPTIONAL: it activates only when the package is
 * installed inside the workspace (e.g. `node_modules/custom-biome-lint`).
 * Nothing here imports `vscode` so it can be unit-tested against fixtures.
 *
 * Resolution walks up from the file's directory looking for the nearest
 * `node_modules/custom-biome-lint/package.json`. That naturally supports
 * npm/yarn/pnpm and monorepos: the install root is the one closest to the
 * file, which is also the directory whose `package.json`
 * (`ignoreBiomeExtensionRules`) the Rust linter will read.
 */

/**
 * @typedef {object} CustomBiomeInstall
 * @property {string} packageDir Absolute path to the resolved
 *   `node_modules/custom-biome-lint` directory.
 * @property {string} workspaceDir Absolute path to the directory that
 *   contains the `package.json` the linter should use for configuration
 *   (the nearest ancestor that declares the dependency, or the install
 *   root's parent). Used as the CLI `cwd`.
 * @property {string} executable Absolute path to the resolved binary, or
 *   empty string when the binary cannot be located.
 */

/**
 * Find the nearest installed `custom-biome-lint` package for a file.
 *
 * @param {string} fileOrDir Absolute path to a file (or directory) to lint.
 * @returns {CustomBiomeInstall|null} Resolved install, or null when the
 *   package is not installed anywhere up the directory tree.
 */
export function findCustomBiomeLint(fileOrDir) {
  const startDir =
    fs.existsSync(fileOrDir) && fs.statSync(fileOrDir).isDirectory()
      ? fileOrDir
      : path.dirname(fileOrDir);

  let dir = path.resolve(startDir);

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = path.join(dir, "node_modules", "custom-biome-lint");

    if (isPackageDirectory(candidate)) {
      const executable = resolveExecutable(candidate);

      if (executable === null) {
        // Installed but unusable: treat as not available so we never spawn a
        // missing binary. Continue walking up in case a usable copy exists.
        // (Deliberately returns null for this branch to avoid a broken run.)
        return null;
      }

      return {
        packageDir: candidate,
        workspaceDir: dir,
        executable,
      };
    }

    const parent = path.dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  return null;
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function isPackageDirectory(dir) {
  try {
    return fs.statSync(path.join(dir, "package.json")).isFile();
  } catch {
    return false;
  }
}

/**
 * Resolve the package's executable (its `bin`).
 *
 * For a Rust linter shipped via npm the `bin` field points at the binary.
 * Supports string and object `bin` forms; prefers a `custom-biome-lint`
 * key when several are declared.
 *
 * @param {string} packageDir Absolute path to `node_modules/custom-biome-lint`.
 * @returns {string|null} Absolute path to the executable, or null when it
 *   cannot be located / is not a file.
 */
export function resolveExecutable(packageDir) {
  /** @type {string|null} */
  let relative = null;

  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(packageDir, "package.json"), "utf8"));

    const bin = pkg.bin;

    if (typeof bin === "string") {
      relative = bin;
    } else if (bin && typeof bin === "object") {
      relative =
        bin["custom-biome-lint"] ??
        Object.values(bin).find((value) => typeof value === "string") ??
        null;
    }
  } catch {
    return null;
  }

  if (relative === null) {
    // Fall back to a conventional bin name inside the package.
    relative = "bin/custom-biome-lint";
  }

  const executable = path.join(packageDir, relative);

  try {
    if (!fs.statSync(executable).isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  return executable;
}
