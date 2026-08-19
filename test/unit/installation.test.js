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
const HOISTED = path.resolve(dirname, "../fixtures/lint-hoisted");
const BROKEN_NESTED = path.resolve(dirname, "../fixtures/lint-broken-nested");

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

// TODO 2: even when the binary is hoisted to the repo root, the configuration
// root (cwd) must be the package.json nearest to the linted file.
test("uses the linted file's package.json as cwd when binary is hoisted", () => {
  const file = path.join(HOISTED, "packages", "app", "src", "x.js");
  const install = findCustomBiomeLint(file);

  assert.ok(install);
  // Binary resolved from the hoisted root install...
  assert.equal(install.packageDir, path.join(HOISTED, "node_modules", "custom-biome-lint"));
  // ...but configuration root is the package that owns the file.
  assert.equal(install.workspaceDir, path.join(HOISTED, "packages", "app"));
});

// TODO 3: a broken nested install must not stop resolution; a valid hoisted
// install up the tree should be used instead.
test("continues past a broken nested install to a valid hoisted one", () => {
  const file = path.join(BROKEN_NESTED, "packages", "app", "src", "x.js");
  const install = findCustomBiomeLint(file);

  assert.ok(install);
  assert.equal(install.packageDir, path.join(BROKEN_NESTED, "node_modules", "custom-biome-lint"));
  // Config root is still the file's own package, not the broken nested copy.
  assert.equal(install.workspaceDir, path.join(BROKEN_NESTED, "packages", "app"));
});

// TODO 4 (VS Code parity): there is no global/PATH fallback, so a file outside
// any workspace install resolves to null even when the binary might exist on
// PATH. Ensured by the existing "returns null when package is not installed"
// test; this documents the intent explicitly.
test("never falls back to a global binary (no PATH resolution)", () => {
  const file = path.join(HOISTED, "packages", "app", "src", "x.js");
  const install = findCustomBiomeLint(file);
  // The only acceptable resolution is a workspace install; the helper has no
  // PATH branch, so a hoisted workspace install is used, never a system binary.
  assert.ok(install);
  assert.ok(install.executable.startsWith(HOISTED));
});
