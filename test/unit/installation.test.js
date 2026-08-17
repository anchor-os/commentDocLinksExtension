// @ts-check

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { findCustomBiomeLint, resolveExecutable } from "../../src/lint/installation.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const WORKSPACE = path.resolve(dirname, "../fixtures/lint-workspace");
const MONOREPO = path.resolve(dirname, "../fixtures/lint-monorepo");

test("detects installed custom-biome-lint for a nested file", () => {
  const file = path.join(WORKSPACE, "src", "example.js");
  const install = findCustomBiomeLint(file);

  assert.ok(install);
  assert.equal(install.packageDir, path.join(WORKSPACE, "node_modules", "custom-biome-lint"));
  assert.equal(install.workspaceDir, WORKSPACE);
  assert.ok(install.executable.endsWith(path.join("bin", "custom-biome-lint")));
});

test("returns null when package is not installed anywhere up the tree", () => {
  const outside = path.resolve(dirname, "..", "..", "src", "extension.js");
  const install = findCustomBiomeLint(outside);

  assert.equal(install, null);
});

test("resolves the package closest to the file (monorepo)", () => {
  const file = path.join(MONOREPO, "packages", "app-a", "src", "x.js");
  const install = findCustomBiomeLint(file);

  assert.ok(install);
  assert.equal(
    install.packageDir,
    path.join(MONOREPO, "packages", "app-a", "node_modules", "custom-biome-lint"),
  );
  assert.equal(install.workspaceDir, path.join(MONOREPO, "packages", "app-a"));
});

test("resolveExecutable handles object bin form", () => {
  const dir = path.join(WORKSPACE, "node_modules", "custom-biome-lint");
  const executable = resolveExecutable(dir);

  assert.ok(executable);
  assert.ok(executable.endsWith(path.join("bin", "custom-biome-lint")));
});

test("resolveExecutable handles string bin form", () => {
  const dir = path.join(MONOREPO, "packages", "app-a", "node_modules", "custom-biome-lint");
  const executable = resolveExecutable(dir);

  assert.ok(executable);
  assert.ok(executable.endsWith(path.join("bin", "custom-biome-lint")));
});

test("resolveExecutable returns null for a missing binary", () => {
  const dir = path.join(WORKSPACE, "node_modules", "custom-biome-lint");

  // Temporarily write a package.json without the binary and restore it.
  const pkgPath = path.join(dir, "package.json");
  const original = fs.readFileSync(pkgPath, "utf8");

  try {
    fs.writeFileSync(
      pkgPath,
      JSON.stringify({ name: "custom-biome-lint", bin: "./bin/does-not-exist" }),
    );
    assert.equal(resolveExecutable(dir), null);
  } finally {
    fs.writeFileSync(pkgPath, original);
  }
});
