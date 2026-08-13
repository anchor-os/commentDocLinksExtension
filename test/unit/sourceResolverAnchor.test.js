// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { hasExactSourceReference } from "../../src/services/sourceResolver.js";

import { makeDocument } from "./helpers.js";

test("exact anchor match returns true", () => {
  const document = makeDocument(["// see documentation/a.md#checkout-flow"]);

  assert.equal(hasExactSourceReference(document, "documentation/a.md", "checkout-flow"), true);
});

test("different anchor returns false", () => {
  const document = makeDocument(["// see documentation/a.md#different-anchor"]);

  assert.equal(hasExactSourceReference(document, "documentation/a.md", "checkout-flow"), false);
});

test("different file returns false", () => {
  const document = makeDocument(["// see documentation/b.md#checkout-flow"]);

  assert.equal(hasExactSourceReference(document, "documentation/a.md", "checkout-flow"), false);
});

test("empty anchor returns false", () => {
  const document = makeDocument(["// see documentation/a.md"]);

  assert.equal(hasExactSourceReference(document, "documentation/a.md", ""), false);
});
