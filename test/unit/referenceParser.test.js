// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  detectReferenceSpans,
  parseComment,
  parseReference,
} from "../../src/references/referenceParser.js";

test("detects a plain documentation reference", () => {
  const spans = detectReferenceSpans("see documentation/file.md here");

  assert.deepEqual(spans, [
    {
      raw: "documentation/file.md",
      start: 4,
      end: 4 + "documentation/file.md".length,
    },
  ]);
});

test("rejects documentation references inside URLs", () => {
  assert.deepEqual(detectReferenceSpans("see https://example.com/docs/file.md"), []);
});

test("rejects absolute documentation paths", () => {
  assert.deepEqual(detectReferenceSpans("see /Users/me/docs/file.md"), []);
});

test("rejects references after a backslash (Windows drive letter)", () => {
  assert.deepEqual(detectReferenceSpans("C:\\docs\\file.md"), []);
});

test("rejects references inside UNC paths", () => {
  assert.deepEqual(detectReferenceSpans("\\\\server\\share\\docs\\file.md"), []);
});

test("accepts relative dot paths", () => {
  assert.deepEqual(detectReferenceSpans("./docs/file.md"), [
    {
      raw: "./docs/file.md",
      start: 0,
      end: "./docs/file.md".length,
    },
  ]);
});

test("detects an issue reference", () => {
  assert.deepEqual(parseReference("#123"), {
    type: "issue",
    raw: "#123",
    file: null,
    anchor: null,
    line: null,
    identifier: "123",
  });
});

test("issue reference does not match a word prefix", () => {
  assert.deepEqual(detectReferenceSpans("foo#123"), []);
});

test("issue reference inside a file anchor is consumed by documentation", () => {
  const spans = detectReferenceSpans("file.md#123");

  assert.equal(spans.length, 1);
  assert.equal(spans[0].raw, "file.md#123");
  assert.equal(parseReference(spans[0].raw).type, "documentation");
});

test("parseReference ignores bare ticket keys (no longer a built-in type)", () => {
  assert.equal(parseReference("DOC-123"), null);
  assert.equal(parseReference("ticketnumber-78305"), null);
});

test("configurable ticket link detects a key and attaches the url", () => {
  const links = [
    {
      baseUrl: "https://issues.example.com/browse/",
      regex: /(?<!\w)(ticketnumber-\d+)\b/g,
      label: "Jira",
    },
  ];

  const spans = detectReferenceSpans("see ticketnumber-78305 for details", links);

  assert.deepEqual(spans, [
    {
      raw: "ticketnumber-78305",
      start: 4,
      end: 4 + "ticketnumber-78305".length,
      url: "https://issues.example.com/browse/ticketnumber-78305",
      label: "Jira",
    },
  ]);
});

test("ticket link key inside a word is not matched", () => {
  const links = [{ baseUrl: "https://x/", regex: /(?<!\w)(ticketnumber-\d+)\b/g, label: null }];

  assert.deepEqual(detectReferenceSpans("prefixticketnumber-78305", links), []);
});

test("first matching ticket link wins on overlap", () => {
  const links = [
    { baseUrl: "https://a/", regex: /(?<!\w)(ticketnumber-\d+)\b/g, label: "A" },
    { baseUrl: "https://b/", regex: /(?<!\w)(ticketnumber-\d+)\b/g, label: "B" },
  ];

  const spans = detectReferenceSpans("ticketnumber-1", links);

  assert.equal(spans.length, 1);
  assert.equal(spans[0].url, "https://a/ticketnumber-1");
  assert.equal(spans[0].label, "A");
});

test("parseComment emits a ticket reference with resolved url/label", () => {
  const links = [
    { baseUrl: "https://x/browse/", regex: /(?<!\w)(ticketnumber-\d+)\b/g, label: "Jira" },
  ];

  const matches = parseComment("fix ticketnumber-78305 now", 0, links);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].type, "ticket");
  assert.equal(matches[0].identifier, "ticketnumber-78305");
  assert.equal(matches[0].url, "https://x/browse/ticketnumber-78305");
  assert.equal(matches[0].label, "Jira");
});

test("ticket reference does not match a word suffix", () => {
  assert.deepEqual(detectReferenceSpans("DOC-123x"), []);
});

test("ticket link built from configuration rejects a word suffix", () => {
  // Mirrors the regex produced by getTicketLinks() in configuration.js.
  const regex = /(?<![\w])(ticketnumber-\d+)(?![\w])/g;
  const links = [{ baseUrl: "https://issues.example.com/browse/", regex, label: "Jira" }];

  // A key continued into an identifier must not be matched (no partial key appended).
  assert.deepEqual(detectReferenceSpans("see ticketnumber-78305x in text", links), []);

  // A standalone key is detected and the full key is appended to baseUrl.
  const spans = detectReferenceSpans("see ticketnumber-78305 in text", links);
  assert.equal(spans.length, 1);
  assert.equal(spans[0].url, "https://issues.example.com/browse/ticketnumber-78305");
});

test("detects an API reference", () => {
  assert.deepEqual(parseReference("API:Checkout"), {
    type: "api",
    raw: "API:Checkout",
    file: null,
    anchor: null,
    line: null,
    identifier: "Checkout",
  });
});

test("API reference does not match a word prefix", () => {
  assert.deepEqual(detectReferenceSpans("xAPI:Foo"), []);
});

test("documentation reference wins over overlapping forms", () => {
  const matches = parseComment("see documentation/a.md#123 and #456", 0);

  assert.equal(matches.length, 2);
  assert.equal(matches[0].type, "documentation");
  assert.equal(matches[0].anchor, "123");
  assert.equal(matches[1].type, "issue");
  assert.equal(matches[1].identifier, "456");
});

test("mixed reference types parse in order", () => {
  const matches = parseComment("DOC-42 API:Checkout documentation/a.md #7", 0);

  assert.deepEqual(
    matches.map((m) => m.type),
    ["api", "documentation", "issue"],
  );
});

test("parseComment offsets include the parser offset", () => {
  const matches = parseComment("see documentation/a.md #7", 20);

  assert.equal(matches[0].start, 20 + "see ".length);
});

test("no reference yields no matches", () => {
  assert.deepEqual(parseComment("nothing here", 0), []);
  assert.deepEqual(parseComment("", 0), []);
});

test("plain file reference parses with null anchor", () => {
  const matches = parseComment("documentation/file.md", 0);

  assert.deepEqual(matches, [
    {
      type: "documentation",
      raw: "documentation/file.md",
      file: "documentation/file.md",
      anchor: null,
      line: null,
      identifier: null,
      start: 0,
      end: "documentation/file.md".length,
    },
  ]);
});

test("hash-anchored reference parses", () => {
  const matches = parseComment("documentation/file.md#checkout-flow", 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "documentation/file.md");
  assert.equal(matches[0].anchor, "checkout-flow");
});

test("space-hyphen anchored reference parses", () => {
  const matches = parseComment("documentation/file.md - checkout-flow", 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "documentation/file.md");
  assert.equal(matches[0].anchor, "checkout-flow");
});

test("em-dash anchored reference parses", () => {
  const matches = parseComment("documentation/file.md — checkout-flow", 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "documentation/file.md");
  assert.equal(matches[0].anchor, "checkout-flow");
});

test("multiple references in one comment parse in order", () => {
  const matches = parseComment("see documentation/a.md and documentation/b.md#foo", 0);

  assert.equal(matches.length, 2);
  assert.equal(matches[0].file, "documentation/a.md");
  assert.equal(matches[1].file, "documentation/b.md");
  assert.equal(matches[1].anchor, "foo");
});

test("start/end offsets include the reference prefix offset", () => {
  const text = "leading text documentation/file.md#anchor";
  const matches = parseComment(text, 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].start, text.indexOf("documentation"));
  assert.equal(matches[0].end, text.length);
});

test("offsets include a nonzero parser offset", () => {
  const text = "documentation/file.md#anchor";
  const offset = 42;
  const matches = parseComment(text, offset);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].start, offset + text.indexOf("documentation"));
  assert.equal(matches[0].end, offset + text.length);
});

test("colon line-number reference parses", () => {
  const matches = parseComment("documentation/file.md:42", 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "documentation/file.md");
  assert.equal(matches[0].anchor, null);
  assert.equal(matches[0].line, 42);
});

test("hash line-number reference parses", () => {
  const matches = parseComment("documentation/file.md#L42", 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].file, "documentation/file.md");
  assert.equal(matches[0].anchor, null);
  assert.equal(matches[0].line, 42);
});

test("lowercase hash line-number reference parses", () => {
  const matches = parseComment("documentation/file.md#l42", 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].anchor, null);
  assert.equal(matches[0].line, 42);
});

test("heading anchors still parse with a null line", () => {
  for (const text of [
    "documentation/file.md#checkout-flow",
    "documentation/file.md - checkout-flow",
    "documentation/file.md — checkout-flow",
  ]) {
    const matches = parseComment(text, 0);

    assert.equal(matches.length, 1, text);
    assert.equal(matches[0].anchor, "checkout-flow", text);
    assert.equal(matches[0].line, null, text);
  }
});

test("line and anchor references in one comment parse in order", () => {
  const matches = parseComment("see documentation/a.md:10 and documentation/b.md#foo", 0);

  assert.equal(matches.length, 2);
  assert.equal(matches[0].line, 10);
  assert.equal(matches[0].anchor, null);
  assert.equal(matches[1].anchor, "foo");
  assert.equal(matches[1].line, null);
});

test("line-number reference offsets include the reference prefix offset", () => {
  const text = "leading text documentation/file.md#L42";
  const matches = parseComment(text, 0);

  assert.equal(matches.length, 1);
  assert.equal(matches[0].start, text.indexOf("documentation"));
  assert.equal(matches[0].end, text.length);
});
