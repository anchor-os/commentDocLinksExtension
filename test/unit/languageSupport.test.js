// @ts-check

import { test } from "node:test";
import assert from "node:assert/strict";

import {
    supportsLanguage,
    getLanguageIdFromExtension,
    getCommentRanges
} from "../../src/parsers/languageSupport.js";

test("supportsLanguage for known languages", () => {
    for (const languageId of [
        "javascript",
        "typescript",
        "graphql",
        "terraform",
        "yaml",
        "velocity",
        "markdown"
    ]) {
        assert.equal(
            supportsLanguage(languageId),
            true,
            `${languageId} should be supported`
        );
    }

    assert.equal(supportsLanguage("python"), false);
});

test("module extensions map to their language", () => {
    assert.equal(getLanguageIdFromExtension("a.mjs"), "javascript");
    assert.equal(getLanguageIdFromExtension("a.cjs"), "javascript");
    assert.equal(getLanguageIdFromExtension("a.mts"), "typescript");
    assert.equal(getLanguageIdFromExtension("a.cts"), "typescript");
});

test("javascript line comments", () => {
    const line = "// see documentation/file.md";
    const ranges = getCommentRanges(
        "javascript",
        line,
        { inBlockComment: false }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[0].end, line.length);
});

test("javascript block comment spans", () => {
    const state = { inBlockComment: false };

    const first = getCommentRanges(
        "javascript",
        "/* open documentation/file.md",
        state
    );

    assert.equal(first.length, 1);
    assert.equal(state.inBlockComment, true);

    const second = getCommentRanges(
        "javascript",
        "   still a comment */ code",
        state
    );

    assert.equal(second.length, 1);
    assert.equal(state.inBlockComment, false);
});

test("hash languages treat the whole line as a comment", () => {
    for (const languageId of ["terraform", "yaml"]) {
        const ranges = getCommentRanges(
            languageId,
            "# see documentation/file.md",
            { inBlockComment: false }
        );

        assert.equal(
            ranges.length,
            1,
            `${languageId} should find the comment`
        );
    }
});

test("velocity line comments use ##", () => {
    const ranges = getCommentRanges(
        "velocity",
        "## see documentation/file.md",
        { inBlockComment: false }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
});

test("markdown treats the whole line as a comment", () => {
    const line = "see documentation/file.md here";
    const ranges = getCommentRanges(
        "markdown",
        line,
        { inBlockComment: false }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[0].end, line.length);
});
