// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    resolveAnchor,
    listAnchors
} from "../../src/services/anchorResolver.js";

import {
    makeDocument
} from "./helpers.js";

const DOCUMENT = makeDocument([
    "## src/util/foo.js — checkout-flow",
    "<a id=\"legacy-anchor\"></a>",
    "## src/util/foo.js - alt-anchor",
    "plain prose"
]);

test("resolves a heading anchor", () => {
    assert.deepEqual(
        resolveAnchor(DOCUMENT, "checkout-flow"),
        { line: 0, character: 0 }
    );
});

test("resolves an HTML anchor", () => {
    assert.deepEqual(
        resolveAnchor(DOCUMENT, "legacy-anchor"),
        { line: 1, character: 0 }
    );
});

test("resolves a space-hyphen heading anchor", () => {
    assert.deepEqual(
        resolveAnchor(DOCUMENT, "alt-anchor"),
        { line: 2, character: 0 }
    );
});

test("missing anchor returns null", () => {
    assert.equal(
        resolveAnchor(DOCUMENT, "does-not-exist"),
        null
    );
});

test("matching is exact, not a prefix match", () => {
    assert.equal(
        resolveAnchor(DOCUMENT, "checkout"),
        null
    );

    assert.equal(
        resolveAnchor(DOCUMENT, "foo"),
        null
    );
});

test("empty anchor returns null", () => {
    assert.equal(
        resolveAnchor(DOCUMENT, ""),
        null
    );
});

test("listAnchors returns every defined anchor", () => {
    assert.deepEqual(
        listAnchors(DOCUMENT),
        ["checkout-flow", "legacy-anchor", "alt-anchor"]
    );
});

test("listAnchors deduplicates repeated anchors", () => {
    const document = makeDocument([
        "## src/a.js — repeated-anchor",
        "## src/b.js — repeated-anchor"
    ]);

    assert.deepEqual(
        listAnchors(document),
        ["repeated-anchor"]
    );
});
