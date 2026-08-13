// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { listSourceAnchors } from "../../src/services/sourceResolver.js";

import { makeDocument } from "./helpers.js";

test("collects anchored references for the doc file only", () => {
  const document = makeDocument([
    "// see documentation/a.md#alpha",
    "// see documentation/b.md#not-this",
    "// see documentation/a.md#beta",
    "// see documentation/a.md",
  ]);

  assert.deepEqual(listSourceAnchors(document, "documentation/a.md"), ["alpha", "beta"]);
});

test("deduplicates repeated anchors", () => {
  const document = makeDocument([
    "// see documentation/a.md#alpha",
    "// see documentation/a.md#alpha",
  ]);

  assert.deepEqual(listSourceAnchors(document, "documentation/a.md"), ["alpha"]);
});

test("returns empty array when nothing is anchored", () => {
  const document = makeDocument(["// see documentation/a.md", "// unrelated"]);

  assert.deepEqual(listSourceAnchors(document, "documentation/a.md"), []);
});
