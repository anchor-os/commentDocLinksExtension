// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    extractDocFileAfterHash,
    extractHeadingSourceBeforeDash,
    anchorSuffixRange
} from "../../src/completion/suggestions.js";

test("extractDocFileAfterHash matches typed md# anchor prefix", () => {
    assert.deepEqual(
        extractDocFileAfterHash(
            "see documentation/file.md#recon"
        ),
        {
            file: "documentation/file.md",
            partialAnchor: "recon"
        }
    );
});

test("extractDocFileAfterHash matches empty anchor after hash", () => {
    assert.deepEqual(
        extractDocFileAfterHash("see documentation/file.md#"),
        {
            file: "documentation/file.md",
            partialAnchor: ""
        }
    );
});

test("extractDocFileAfterHash returns null without a hash", () => {
    assert.equal(
        extractDocFileAfterHash("see documentation/file.md"),
        null
    );
});

test("extractDocFileAfterHash returns null without a md file", () => {
    assert.equal(
        extractDocFileAfterHash("see documentation/file#foo"),
        null
    );
});

test("extractDocFileAfterHash matches nested paths", () => {
    assert.deepEqual(
        extractDocFileAfterHash(
            "see docs/claude/comments/a/b.md#anchor-1"
        ),
        {
            file: "docs/claude/comments/a/b.md",
            partialAnchor: "anchor-1"
        }
    );
});

test("extractHeadingSourceBeforeDash matches em-dash prefix", () => {
    assert.deepEqual(
        extractHeadingSourceBeforeDash("## src/util/foo.js — "),
        { source: "src/util/foo.js" }
    );
});

test("extractHeadingSourceBeforeDash returns null without dash", () => {
    assert.equal(
        extractHeadingSourceBeforeDash("## src/util/foo.js"),
        null
    );
});

test("extractHeadingSourceBeforeDash returns null on prose", () => {
    assert.equal(
        extractHeadingSourceBeforeDash("just some text — "),
        null
    );
});

test("anchorSuffixRange locates the partial anchor", () => {
    const text = "see documentation/file.md#recon";
    const prefix = "see documentation/file.md#";

    assert.deepEqual(
        anchorSuffixRange(text, "recon"),
        { start: prefix.length, end: text.length }
    );
});

test("anchorSuffixRange with empty anchor points at the end", () => {
    const text = "see documentation/file.md#";

    assert.deepEqual(
        anchorSuffixRange(text, ""),
        { start: text.length, end: text.length }
    );
});
