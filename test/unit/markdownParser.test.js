// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseMarkdownHeading } from "../../src/parsers/markdownParser.js";

test("em-dash heading parses", () => {
  const parsed = parseMarkdownHeading("## src/util/foo.js — checkout-flow");

  assert.deepEqual(parsed, {
    source: "src/util/foo.js",
    anchor: "checkout-flow",
    start: "## ".length,
    end: "## ".length + "src/util/foo.js".length,
  });
});

test("space-hyphen heading parses", () => {
  const parsed = parseMarkdownHeading("## src/util/foo.js - checkout-flow");

  assert.equal(parsed.source, "src/util/foo.js");
  assert.equal(parsed.anchor, "checkout-flow");
});

test("hash-separated heading parses (legacy tolerance)", () => {
  const parsed = parseMarkdownHeading("## src/checkout/cart.js" + "#checkout-flow");

  assert.equal(parsed.source, "src/checkout/cart.js");
  assert.equal(parsed.anchor, "checkout-flow");
});

test("heading without anchor does not parse", () => {
  assert.equal(parseMarkdownHeading("## src/util/foo.js"), null);
});

test("single-hash heading does not parse", () => {
  assert.equal(parseMarkdownHeading("# src/util/foo.js — anchor"), null);
});

test("non-heading line does not parse", () => {
  assert.equal(parseMarkdownHeading("some prose text here"), null);
});
