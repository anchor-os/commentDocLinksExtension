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
        "javascriptreact",
        "typescript",
        "typescriptreact",
        "graphql",
        "terraform",
        "yaml",
        "velocity",
        "markdown",
        "python",
        "java",
        "go",
        "rust",
        "c",
        "cpp",
        "csharp",
        "php",
        "ruby",
        "kotlin",
        "swift"
    ]) {
        assert.equal(
            supportsLanguage(languageId),
            true,
            `${languageId} should be supported`
        );
    }

    assert.equal(supportsLanguage("css"), false);
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
        { inBlockComment: false, inString: null }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[0].end, line.length);
});

test("javascript block comment spans", () => {
    const state = { inBlockComment: false, inString: null };

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
            { inBlockComment: false, inString: null }
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
        { inBlockComment: false, inString: null }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
});

test("markdown treats the whole line as a comment", () => {
    const line = "see documentation/file.md here";
    const ranges = getCommentRanges(
        "markdown",
        line,
        { inBlockComment: false, inString: null }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[0].end, line.length);
});

test("php attribute syntax is not treated as a comment", () => {
    const ranges = getCommentRanges(
        "php",
        "#[Route(\"/api/checkout\", name: \"checkout\")]",
        { inBlockComment: false, inString: null, inPhp: true }
    );

    assert.deepEqual(ranges, []);
});

test("php hash comment is still detected", () => {
    const line = "# see documentation/file.md";
    const ranges = getCommentRanges(
        "php",
        line,
        { inBlockComment: false, inString: null, inPhp: true }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, 0);
    assert.equal(ranges[0].end, line.length);
});

test("go raw string spanning lines hides comment delimiters", () => {
    const state = { inBlockComment: false, inString: null };

    const opening = getCommentRanges(
        "go",
        "const help = `usage: see documentation/file.md",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "`");

    const inside = getCommentRanges(
        "go",
        "// this looks like a comment but is not`",
        state
    );

    assert.deepEqual(inside, []);
    assert.equal(state.inString, null);
});

test("python triple double-quoted string hides # across lines", () => {
    const state = { inBlockComment: false, inString: null };

    const opening = getCommentRanges(
        "python",
        "doc = \"\"\"see documentation/file.md",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "\"\"\"");

    const inside = getCommentRanges(
        "python",
        "# not a comment documentation/file.md",
        state
    );

    assert.deepEqual(inside, []);
    assert.equal(state.inString, "\"\"\"");

    const closing = getCommentRanges(
        "python",
        "still inside\"\"\"",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});

test("python triple single-quoted string hides # across lines", () => {
    const state = { inBlockComment: false, inString: null };

    const opening = getCommentRanges(
        "python",
        "doc = '''see documentation/file.md",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "'''");

    const inside = getCommentRanges(
        "python",
        "# hidden documentation/file.md",
        state
    );

    assert.deepEqual(inside, []);
    assert.equal(state.inString, "'''");

    const closing = getCommentRanges(
        "python",
        "still inside'''",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});

test("python # comment is still detected after a string", () => {
    const line = "x = \"a\" # see documentation/file.md";
    const ranges = getCommentRanges(
        "python",
        line,
        { inBlockComment: false, inString: null }
    );

    assert.equal(ranges.length, 1);
    assert.equal(ranges[0].start, line.indexOf("#"));
    assert.equal(ranges[0].end, line.length);
});

test("php heredoc body hides # and // across lines", () => {
    const state = { inBlockComment: false, inString: null, inPhp: true };

    const opening = getCommentRanges(
        "php",
        "$text = <<<EOT",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "heredoc:EOT");

    const body = getCommentRanges(
        "php",
        "see documentation/file.md # not a comment",
        state
    );

    assert.deepEqual(body, []);
    assert.equal(state.inString, "heredoc:EOT");

    const closing = getCommentRanges(
        "php",
        "EOT;",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});

test("php nowdoc body hides # across lines", () => {
    const state = { inBlockComment: false, inString: null, inPhp: true };

    const opening = getCommentRanges(
        "php",
        "$text = <<<'EOT'",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "heredoc:EOT");

    const body = getCommentRanges(
        "php",
        "see documentation/file.md # still text",
        state
    );

    assert.deepEqual(body, []);

    const closing = getCommentRanges(
        "php",
        "EOT",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});

test("php double-quoted string persists across lines", () => {
    const state = { inBlockComment: false, inString: null, inPhp: true };

    const opening = getCommentRanges(
        "php",
        "$text = \"see documentation/file.md",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "\"");

    const inside = getCommentRanges(
        "php",
        "// not a comment # still text\"",
        state
    );

    assert.deepEqual(inside, []);
    assert.equal(state.inString, null);
});

test("kotlin/swift triple-quoted string hides // and /* across lines", () => {
    for (const languageId of ["kotlin", "swift"]) {
        const state = { inBlockComment: false, inString: null };

        const opening = getCommentRanges(
            languageId,
            "val help = \"\"\"see documentation/file.md",
            state
        );

        assert.deepEqual(opening, []);
        assert.equal(state.inString, "\"\"\"");

        const inside = getCommentRanges(
            languageId,
            "// not a comment documentation/file.md",
            state
        );

        assert.deepEqual(inside, []);
        assert.equal(state.inString, "\"\"\"");

        const closing = getCommentRanges(
            languageId,
            "still inside\"\"\"",
            state
        );

        assert.deepEqual(closing, []);
        assert.equal(state.inString, null);
    }
});

test("csharp verbatim string hides // across lines", () => {
    const state = { inBlockComment: false, inString: null };

    const opening = getCommentRanges(
        "csharp",
        "var help = @\"see documentation/file.md",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "@\"");

    const inside = getCommentRanges(
        "csharp",
        "// not a comment documentation/file.md",
        state
    );

    assert.deepEqual(inside, []);
    assert.equal(state.inString, "@\"");

    const closing = getCommentRanges(
        "csharp",
        "still \"\" inside\"",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});

test("php HTML apostrophes do not set persistent string state", () => {
    const state = { inBlockComment: false, inString: null };

    const html = getCommentRanges(
        "php",
        "<p>It's here</p>",
        state
    );

    assert.deepEqual(html, []);
    assert.equal(state.inString, null);
    assert.equal(state.inPhp, false);

    const opening = getCommentRanges(
        "php",
        "<?php",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inPhp, true);

    const comment = getCommentRanges(
        "php",
        "# see documentation/file.md",
        state
    );

    assert.equal(comment.length, 1);
    assert.equal(comment[0].start, 0);
    assert.equal(comment[0].end, "# see documentation/file.md".length);
});

test("php heredoc closer may be followed by other code", () => {
    const state = { inBlockComment: false, inString: null, inPhp: true };

    const opening = getCommentRanges(
        "php",
        "$text = <<<EOT",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "heredoc:EOT");

    const body = getCommentRanges(
        "php",
        "see documentation/file.md # not a comment",
        state
    );

    assert.deepEqual(body, []);
    assert.equal(state.inString, "heredoc:EOT");

    const closing = getCommentRanges(
        "php",
        "EOT)",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});

test("php heredoc accepts a double-quoted label", () => {
    const state = { inBlockComment: false, inString: null, inPhp: true };

    const opening = getCommentRanges(
        "php",
        "$text = <<<\"EOT\"",
        state
    );

    assert.deepEqual(opening, []);
    assert.equal(state.inString, "heredoc:EOT");

    const body = getCommentRanges(
        "php",
        "see documentation/file.md # still text",
        state
    );

    assert.deepEqual(body, []);
    assert.equal(state.inString, "heredoc:EOT");

    const closing = getCommentRanges(
        "php",
        "EOT",
        state
    );

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
});
