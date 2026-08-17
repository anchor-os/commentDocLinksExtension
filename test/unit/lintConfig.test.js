// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { lintActive, resolveLintConfig } from "../../src/lint/LintConfig.js";

test("defaults are enabled + autoDetect", () => {
  const config = resolveLintConfig();

  assert.equal(config.enabled, true);
  assert.equal(config.autoDetect, true);
});

test("invalid values fall back to defaults", () => {
  const config = resolveLintConfig({ enabled: "yes", autoDetect: 1 });

  assert.equal(config.enabled, true);
  assert.equal(config.autoDetect, true);
});

test("honors explicit values", () => {
  const config = resolveLintConfig({ enabled: false, autoDetect: false });

  assert.equal(config.enabled, false);
  assert.equal(config.autoDetect, false);
});

test("active only when enabled, autoDetect and installed", () => {
  const config = resolveLintConfig();

  assert.equal(lintActive(config, true), true);
  assert.equal(lintActive(config, false), false);
});

test("disabled master switch turns the feature off", () => {
  const config = resolveLintConfig({ enabled: false });

  assert.equal(lintActive(config, true), false);
});

test("autoDetect off turns the feature off regardless of install", () => {
  const config = resolveLintConfig({ autoDetect: false });

  assert.equal(lintActive(config, true), false);
});
