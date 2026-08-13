// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { isValidLinkColor, THEME_LINK_COLOR, validLinkColor } from "../../src/config/color.js";

test("theme marker is a valid link color", () => {
  assert.equal(isValidLinkColor(THEME_LINK_COLOR), true);
});

test("hex colors are valid", () => {
  for (const value of ["#fff", "#F00", "#ff00ff", "#ff00ff00", "#1234abcd"]) {
    assert.equal(isValidLinkColor(value), true, value);
  }
});

test("malformed hex colors are rejected", () => {
  for (const value of ["#ff", "#ff00f", "#fffff", "#ggg", "#fffffffff", "ff00ff", "blue"]) {
    assert.equal(isValidLinkColor(value), value === "blue", value);
  }
});

test("functional colors are valid", () => {
  for (const value of [
    "rgb(1, 2, 3)",
    "rgba(0, 0, 0, 0.5)",
    "hsl(120, 50%, 50%)",
    "hsla(120, 50%, 50%, 1)",
    "rgb(255 0 0 / 50%)",
    "hsl(0deg 100% 50%)",
    "rgb(255, 0, 0, 0.5)",
  ]) {
    assert.equal(isValidLinkColor(value), true, value);
  }
});

test("malformed functional colors are rejected", () => {
  for (const value of [
    "rgb(1)",
    "hsl(foo1)",
    "rgb(255, 0)",
    "rgb()",
    "rgb(255, 0, 0,)",
    "rgb(255 0 0 / 50% / 10%)",
    "rgb(none 0 0)",
    "notacolor(1, 2, 3)",
    "rgb(255 0 0 0.5)",
    "rgb(255, 0, 0, 50% / 10%)",
  ]) {
    assert.equal(isValidLinkColor(value), false, value);
  }
});

test("named colors are valid, case-insensitively", () => {
  assert.equal(isValidLinkColor("rebeccapurple"), true);
  assert.equal(isValidLinkColor("REBECCAPURPLE"), true);
  assert.equal(isValidLinkColor("transparent"), true);
  assert.equal(isValidLinkColor("grean"), false);
});

test("non-string values are rejected", () => {
  for (const value of [null, undefined, 42, {}, []]) {
    assert.equal(isValidLinkColor(value), false);
  }
});

test("validLinkColor passes valid values through", () => {
  assert.equal(validLinkColor("#00ff00"), "#00ff00");
  assert.equal(validLinkColor("cornflowerblue"), "cornflowerblue");
});

test("validLinkColor falls back to the theme marker", () => {
  assert.equal(validLinkColor("grean"), THEME_LINK_COLOR);
  assert.equal(validLinkColor(undefined), THEME_LINK_COLOR);
});
