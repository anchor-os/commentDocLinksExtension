// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCommentRanges,
  getLanguageIdFromExtension,
  supportsLanguage,
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
    "swift",
  ]) {
    assert.equal(supportsLanguage(languageId), true, `${languageId} should be supported`);
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
  const ranges = getCommentRanges("javascript", line, { inBlockComment: false, inString: null });

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges[0].end, line.length);
});

test("javascript block comment spans", () => {
  const state = { inBlockComment: false, inString: null };

  const first = getCommentRanges("javascript", "/* open documentation/file.md", state);

  assert.equal(first.length, 1);
  assert.equal(state.inBlockComment, true);

  const second = getCommentRanges("javascript", "   still a comment */ code", state);

  assert.equal(second.length, 1);
  assert.equal(state.inBlockComment, false);
});

test("hash languages treat the whole line as a comment", () => {
  for (const languageId of ["terraform", "yaml"]) {
    const ranges = getCommentRanges(languageId, "# see documentation/file.md", {
      inBlockComment: false,
      inString: null,
    });

    assert.equal(ranges.length, 1, `${languageId} should find the comment`);
  }
});

test("velocity line comments use ##", () => {
  const ranges = getCommentRanges("velocity", "## see documentation/file.md", {
    inBlockComment: false,
    inString: null,
  });

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 0);
});

test("yaml quoted strings are not comments", () => {
  for (const line of [
    'description: "#123"',
    "description: '#123'",
    'description: "see documentation/file.md"',
  ]) {
    const ranges = getCommentRanges("yaml", line, { inBlockComment: false, inString: null });

    assert.deepEqual(ranges, [], `${line} should produce no comment`);
  }
});

test("yaml # needs a preceding whitespace to start a comment", () => {
  const plainScalar = getCommentRanges("yaml", "key: value#123", {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(plainScalar, []);

  const comment = getCommentRanges("yaml", "key: value # see documentation/file.md", {
    inBlockComment: false,
    inString: null,
  });

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, "key: value ".length);
  assert.equal(comment[0].end, "key: value # see documentation/file.md".length);
});

test("yaml block scalar content hides # across lines", () => {
  const state = { inBlockComment: false, inString: null };

  const header = getCommentRanges("yaml", "description: |", state);

  assert.deepEqual(header, []);
  assert.equal(state.inBlockScalar, 0);

  const body = getCommentRanges("yaml", "  see documentation/file.md #123", state);

  assert.deepEqual(body, []);
  assert.equal(state.inBlockScalar, 0);

  const ended = getCommentRanges("yaml", "next_key: 1", state);

  assert.deepEqual(ended, []);
  assert.equal(state.inBlockScalar, null);

  const comment = getCommentRanges("yaml", "# real comment documentation/file.md", state);

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, 0);
});

test("yaml indented block scalar resumes at the same indent", () => {
  const state = { inBlockComment: false, inString: null };

  const header = getCommentRanges("yaml", "  description: >2", state);

  assert.deepEqual(header, []);
  assert.equal(state.inBlockScalar, 2);

  const body = getCommentRanges("yaml", "    see documentation/file.md #123", state);

  assert.deepEqual(body, []);
  assert.equal(state.inBlockScalar, 2);

  const code = getCommentRanges("yaml", "  # back to code documentation/file.md", state);

  assert.equal(code.length, 1);
  assert.equal(code[0].start, 2);
  assert.equal(state.inBlockScalar, null);
});

test("yaml sequence item block scalar hides #", () => {
  const state = { inBlockComment: false, inString: null };

  const header = getCommentRanges("yaml", "- |", state);

  assert.deepEqual(header, []);
  assert.equal(state.inBlockScalar, 0);

  const body = getCommentRanges("yaml", "  see documentation/file.md #123", state);

  assert.deepEqual(body, []);
});

test("yaml header with a trailing comment still opens the scalar", () => {
  const state = { inBlockComment: false, inString: null };

  const header = getCommentRanges("yaml", "description: | # see documentation/file.md", state);

  assert.equal(header.length, 1);
  assert.equal(state.inBlockScalar, 0);

  const body = getCommentRanges("yaml", "  see documentation/file.md #123", state);

  assert.deepEqual(body, []);
});

test("yaml quoted key colon is not a block scalar header", () => {
  const state = { inBlockComment: false, inString: null };

  const ranges = getCommentRanges("yaml", '"key: |": value # see documentation/file.md', state);

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, '"key: |": value '.length);
  assert.equal(state.inBlockScalar, null);
});

test("terraform supports #, // and block comments", () => {
  const hash = getCommentRanges("terraform", "# see documentation/file.md", {
    inBlockComment: false,
    inString: null,
  });

  assert.equal(hash.length, 1);
  assert.equal(hash[0].start, 0);

  const slash = getCommentRanges("terraform", "// see documentation/file.md", {
    inBlockComment: false,
    inString: null,
  });

  assert.equal(slash.length, 1);
  assert.equal(slash[0].start, 0);

  const state = { inBlockComment: false, inString: null };

  const block = getCommentRanges("terraform", "/* see documentation/file.md", state);

  assert.equal(block.length, 1);
  assert.equal(state.inBlockComment, true);

  const closed = getCommentRanges("terraform", "still a comment */", state);

  assert.equal(closed.length, 1);
  assert.equal(state.inBlockComment, false);
});

test("terraform quoted string is not a comment", () => {
  const ranges = getCommentRanges("terraform", 'description = "#123"', {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(ranges, []);
});

test("terraform unmatched quote does not hide later comments", () => {
  const state = { inBlockComment: false, inString: null };

  const quoted = getCommentRanges("terraform", 'description = "unterminated', state);

  assert.deepEqual(quoted, []);

  const comment = getCommentRanges("terraform", "# see documentation/file.md", state);

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, 0);
  assert.equal(state.inString, null);
});

test("terraform heredoc body hides # and // across lines", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("terraform", "description = <<EOT", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "heredoc:EOT");

  const body = getCommentRanges(
    "terraform",
    "see documentation/file.md #123 // not a comment",
    state,
  );

  assert.deepEqual(body, []);

  const closing = getCommentRanges("terraform", "EOT", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);

  const comment = getCommentRanges("terraform", "# now a comment documentation/file.md", state);

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, 0);
});

test("terraform indented heredoc terminator is recognized", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("terraform", "description = <<-EOT", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "heredoc:EOT");

  const body = getCommentRanges("terraform", "  see documentation/file.md #123", state);

  assert.deepEqual(body, []);

  const closing = getCommentRanges("terraform", "    EOT", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("graphql # comments outside strings are detected", () => {
  const line = 'field(arg: "#123") # see documentation/file.md';
  const ranges = getCommentRanges("graphql", line, { inBlockComment: false, inString: null });

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 'field(arg: "#123") '.length);
  assert.equal(ranges[0].end, line.length);
});

test("graphql string and block string hide #", () => {
  const string = getCommentRanges("graphql", 'field(arg: "#123")', {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(string, []);

  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("graphql", '"""see documentation/file.md #123', state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, '"""');

  const inside = getCommentRanges("graphql", "# not a comment still inside", state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, '"""');

  const closing = getCommentRanges("graphql", 'still inside"""', state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);

  const comment = getCommentRanges("graphql", "# real comment documentation/file.md", state);

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, 0);
});

test("graphql block string escape does not close the string", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("graphql", '"""escaped \\""" still #123', state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, '"""');

  const inside = getCommentRanges("graphql", '# not a comment"""', state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, null);
});

test("velocity ## comments start anywhere outside strings", () => {
  const after = getCommentRanges("velocity", "#set($x = 1) ## see documentation/file.md", {
    inBlockComment: false,
    inString: null,
  });

  assert.equal(after.length, 1);
  assert.equal(after[0].start, "#set($x = 1) ".length);

  const directive = getCommentRanges("velocity", "#if($x) ## see documentation/file.md #end", {
    inBlockComment: false,
    inString: null,
  });

  assert.equal(directive.length, 1);
  assert.equal(directive[0].start, "#if($x) ".length);
});

test("velocity strings hide ## and #*", () => {
  const double = getCommentRanges("velocity", '#set($msg = "see documentation/file.md ##123")', {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(double, []);

  const single = getCommentRanges("velocity", "#set($msg = '## not a comment')", {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(single, []);
});

test("velocity unmatched quote does not hide later comments", () => {
  const state = { inBlockComment: false, inString: null };

  const quoted = getCommentRanges("velocity", "#set($msg = 'unterminated", state);

  assert.deepEqual(quoted, []);

  const comment = getCommentRanges("velocity", "## see documentation/file.md", state);

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, 0);
  assert.equal(state.inString, null);
});

test("velocity block comments span lines and hide #", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("velocity", "#* see documentation/file.md", state);

  assert.equal(opening.length, 1);
  assert.equal(state.inBlockComment, true);

  const inside = getCommentRanges("velocity", "# not a comment still inside", state);

  assert.equal(inside.length, 1);
  assert.equal(state.inBlockComment, true);

  const closing = getCommentRanges("velocity", "still inside *#", state);

  assert.equal(closing.length, 1);
  assert.equal(state.inBlockComment, false);
});

test("velocity single # directives are not comments", () => {
  const ranges = getCommentRanges("velocity", "#set($x = $var.foo)", {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(ranges, []);
});

test("velocity #* inside a string is literal text", () => {
  const ranges = getCommentRanges("velocity", '#set($msg = "a #* not a comment *# b")', {
    inBlockComment: false,
    inString: null,
  });

  assert.deepEqual(ranges, []);
});

test("markdown treats the whole line as a comment", () => {
  const line = "see documentation/file.md here";
  const ranges = getCommentRanges("markdown", line, { inBlockComment: false, inString: null });

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges[0].end, line.length);
});

test("php attribute syntax is not treated as a comment", () => {
  const ranges = getCommentRanges("php", '#[Route("/api/checkout", name: "checkout")]', {
    inBlockComment: false,
    inString: null,
    inPhp: true,
  });

  assert.deepEqual(ranges, []);
});

test("php hash comment is still detected", () => {
  const line = "# see documentation/file.md";
  const ranges = getCommentRanges("php", line, {
    inBlockComment: false,
    inString: null,
    inPhp: true,
  });

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, 0);
  assert.equal(ranges[0].end, line.length);
});

test("go raw string spanning lines hides comment delimiters", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("go", "const help = `usage: see documentation/file.md", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "`");

  const inside = getCommentRanges("go", "// this looks like a comment but is not`", state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, null);
});

test("python triple double-quoted string hides # across lines", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("python", 'doc = """see documentation/file.md', state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, '"""');

  const inside = getCommentRanges("python", "# not a comment documentation/file.md", state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, '"""');

  const closing = getCommentRanges("python", 'still inside"""', state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("python triple single-quoted string hides # across lines", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("python", "doc = '''see documentation/file.md", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "'''");

  const inside = getCommentRanges("python", "# hidden documentation/file.md", state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, "'''");

  const closing = getCommentRanges("python", "still inside'''", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("python # comment is still detected after a string", () => {
  const line = 'x = "a" # see documentation/file.md';
  const ranges = getCommentRanges("python", line, { inBlockComment: false, inString: null });

  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start, line.indexOf("#"));
  assert.equal(ranges[0].end, line.length);
});

test("php heredoc body hides # and // across lines", () => {
  const state = { inBlockComment: false, inString: null, inPhp: true };

  const opening = getCommentRanges("php", "$text = <<<EOT", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "heredoc:EOT");

  const body = getCommentRanges("php", "see documentation/file.md # not a comment", state);

  assert.deepEqual(body, []);
  assert.equal(state.inString, "heredoc:EOT");

  const closing = getCommentRanges("php", "EOT;", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("php nowdoc body hides # across lines", () => {
  const state = { inBlockComment: false, inString: null, inPhp: true };

  const opening = getCommentRanges("php", "$text = <<<'EOT'", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "heredoc:EOT");

  const body = getCommentRanges("php", "see documentation/file.md # still text", state);

  assert.deepEqual(body, []);

  const closing = getCommentRanges("php", "EOT", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("php double-quoted string persists across lines", () => {
  const state = { inBlockComment: false, inString: null, inPhp: true };

  const opening = getCommentRanges("php", '$text = "see documentation/file.md', state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, '"');

  const inside = getCommentRanges("php", '// not a comment # still text"', state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, null);
});

test("kotlin/swift triple-quoted string hides // and /* across lines", () => {
  for (const languageId of ["kotlin", "swift"]) {
    const state = { inBlockComment: false, inString: null };

    const opening = getCommentRanges(languageId, 'val help = """see documentation/file.md', state);

    assert.deepEqual(opening, []);
    assert.equal(state.inString, '"""');

    const inside = getCommentRanges(languageId, "// not a comment documentation/file.md", state);

    assert.deepEqual(inside, []);
    assert.equal(state.inString, '"""');

    const closing = getCommentRanges(languageId, 'still inside"""', state);

    assert.deepEqual(closing, []);
    assert.equal(state.inString, null);
  }
});

test("csharp verbatim string hides // across lines", () => {
  const state = { inBlockComment: false, inString: null };

  const opening = getCommentRanges("csharp", 'var help = @"see documentation/file.md', state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, '@"');

  const inside = getCommentRanges("csharp", "// not a comment documentation/file.md", state);

  assert.deepEqual(inside, []);
  assert.equal(state.inString, '@"');

  const closing = getCommentRanges("csharp", 'still "" inside"', state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("php HTML apostrophes do not set persistent string state", () => {
  const state = { inBlockComment: false, inString: null };

  const html = getCommentRanges("php", "<p>It's here</p>", state);

  assert.deepEqual(html, []);
  assert.equal(state.inString, null);
  assert.equal(state.inPhp, false);

  const opening = getCommentRanges("php", "<?php", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inPhp, true);

  const comment = getCommentRanges("php", "# see documentation/file.md", state);

  assert.equal(comment.length, 1);
  assert.equal(comment[0].start, 0);
  assert.equal(comment[0].end, "# see documentation/file.md".length);
});

test("php heredoc closer may be followed by other code", () => {
  const state = { inBlockComment: false, inString: null, inPhp: true };

  const opening = getCommentRanges("php", "$text = <<<EOT", state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "heredoc:EOT");

  const body = getCommentRanges("php", "see documentation/file.md # not a comment", state);

  assert.deepEqual(body, []);
  assert.equal(state.inString, "heredoc:EOT");

  const closing = getCommentRanges("php", "EOT)", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});

test("php heredoc accepts a double-quoted label", () => {
  const state = { inBlockComment: false, inString: null, inPhp: true };

  const opening = getCommentRanges("php", '$text = <<<"EOT"', state);

  assert.deepEqual(opening, []);
  assert.equal(state.inString, "heredoc:EOT");

  const body = getCommentRanges("php", "see documentation/file.md # still text", state);

  assert.deepEqual(body, []);
  assert.equal(state.inString, "heredoc:EOT");

  const closing = getCommentRanges("php", "EOT", state);

  assert.deepEqual(closing, []);
  assert.equal(state.inString, null);
});
