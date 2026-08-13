// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";

import { countLines, documentFromText } from "../../src/references/document.js";

test("documentFromText builds a line-based document", () => {
  const document = documentFromText("a\nb\nc", "javascript");

  assert.equal(document.languageId, "javascript");
  assert.equal(document.lineCount, 3);
  assert.equal(document.lineAt(1).text, "b");
});

test("documentFromText splits on LF, CRLF and CR", () => {
  const document = documentFromText("a\r\nb\rc\nd", "markdown");

  assert.equal(document.lineCount, 4);
  assert.deepEqual(
    [0, 1, 2, 3].map((i) => document.lineAt(i).text),
    ["a", "b", "c", "d"],
  );
});

test("documentFromText defaults to markdown", () => {
  const document = documentFromText("text");

  assert.equal(document.languageId, "markdown");
});

test("countLines counts LF line endings", () => {
  assert.equal(countLines("a\nb\nc"), 3);
});

test("countLines counts CRLF line endings", () => {
  assert.equal(countLines("a\r\nb\r\nc"), 3);
});

test("countLines counts bare CR line endings", () => {
  assert.equal(countLines("a\rb\rc"), 3);
});

test("countLines treats empty text as a single line", () => {
  assert.equal(countLines(""), 1);
});

test("countLines treats trailing newline as an extra line", () => {
  assert.equal(countLines("a\nb\n"), 3);
});
