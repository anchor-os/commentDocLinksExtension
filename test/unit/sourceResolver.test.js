// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveSourceReference } from "../../src/services/sourceResolver.js";

import { makeDocument } from "./helpers.js";

test("exact anchor match wins over earlier loose reference", () => {
  const document = makeDocument([
    "// see documentation/a.md",
    "const x = 1;",
    "// see documentation/a.md#checkout-flow",
    "// see documentation/a.md - alt-anchor",
  ]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "checkout-flow"), {
    line: 2,
    character: 0,
    anchorFound: true,
  });
});

test("space-hyphen reference matches its anchor", () => {
  const document = makeDocument([
    "// see documentation/a.md",
    "// see documentation/a.md - alt-anchor",
  ]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "alt-anchor"), {
    line: 1,
    character: 0,
    anchorFound: true,
  });
});

test("file referenced without the anchor falls back to first reference", () => {
  const document = makeDocument([
    "// see documentation/a.md",
    "const x = 1;",
    "// see documentation/a.md#different-anchor",
  ]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "missing-anchor"), {
    line: 0,
    character: 0,
    anchorFound: false,
  });
});

test("anchored reference cannot become the fallback", () => {
  const document = makeDocument([
    "// see documentation/a.md#anchored-first",
    "// see documentation/a.md",
  ]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "missing-anchor"), {
    line: 1,
    character: 0,
    anchorFound: false,
  });
});

test("unreferenced file resolves to the top of the document", () => {
  const document = makeDocument(["// unrelated comment", "const x = 1;"]);

  assert.deepEqual(resolveSourceReference(document, "documentation/unreferenced.md", "anything"), {
    line: 0,
    character: 0,
    anchorFound: false,
  });
});

test("references inside block comments are found", () => {
  const document = makeDocument(["/*", " * see documentation/a.md#deep-anchor", " */"]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "deep-anchor"), {
    line: 1,
    character: 0,
    anchorFound: true,
  });
});

test("references in non-comment code are ignored", () => {
  const document = makeDocument([
    'const s = "see documentation/a.md#fake-anchor";',
    "// see documentation/a.md#real-anchor",
  ]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "real-anchor"), {
    line: 1,
    character: 0,
    anchorFound: true,
  });
});

test("leading ./ on either side does not break the match", () => {
  const document = makeDocument(["// see ./documentation/a.md#deep-anchor"]);

  assert.deepEqual(resolveSourceReference(document, "documentation/a.md", "deep-anchor"), {
    line: 0,
    character: 0,
    anchorFound: true,
  });

  assert.deepEqual(resolveSourceReference(document, "./documentation/a.md", "deep-anchor"), {
    line: 0,
    character: 0,
    anchorFound: true,
  });
});
