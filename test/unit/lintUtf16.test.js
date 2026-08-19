// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyEditsToString,
  byteColumnToUtf16Char,
  editToUtf16Range,
} from "../../src/lint/lintUtf16.js";

test("ascii: byte column maps 1:1 to UTF-16 code unit", () => {
  const line = "abcdef";
  // byte col 2 -> char 1 (both 1-based->0-based mapping of the char at col 2)
  assert.equal(byteColumnToUtf16Char(line, 1), 0);
  assert.equal(byteColumnToUtf16Char(line, 2), 1);
  assert.equal(byteColumnToUtf16Char(line, 6), 5);
});

test("ascii: out-of-range byte column clamps to line end", () => {
  assert.equal(byteColumnToUtf16Char("abc", 99), 3);
  assert.equal(byteColumnToUtf16Char("abc", 0), 0);
  assert.equal(byteColumnToUtf16Char("abc", -4), 0);
});

test("é (2-byte UTF-8): byte column maps to the right UTF-16 index", () => {
  // "a"=1 byte, "é"=2 bytes, "b"=1 byte
  const line = "aéb";
  assert.equal(byteColumnToUtf16Char(line, 1), 0); // before é
  assert.equal(byteColumnToUtf16Char(line, 2), 1); // é starts at UTF-8 byte 2 -> char 1
  assert.equal(byteColumnToUtf16Char(line, 3), 1); // é spans bytes 2-3 -> still char 1
  assert.equal(byteColumnToUtf16Char(line, 4), 2); // b starts at byte 4 -> char 2
});

test("你 (3-byte UTF-8): byte column maps to the right UTF-16 index", () => {
  const line = "你";
  assert.equal(byteColumnToUtf16Char(line, 1), 0); // before 你
  assert.equal(byteColumnToUtf16Char(line, 2), 0); // 你 spans bytes 1-3 -> char 0
  assert.equal(byteColumnToUtf16Char(line, 4), 1); // after 你
});

test("😀 (astral, surrogate pair, 4 UTF-8 bytes): high surrogate carries the column", () => {
  // "a"=1 byte, "😀"=4 bytes (high surrogate at char 1), "b"=1 byte
  const line = "a😀b";
  assert.equal(byteColumnToUtf16Char(line, 1), 0); // before emoji
  assert.equal(byteColumnToUtf16Char(line, 2), 1); // emoji starts at UTF-8 byte 2 -> char 1
  assert.equal(byteColumnToUtf16Char(line, 5), 1); // emoji spans bytes 2-5 -> chars 1-2
  assert.equal(byteColumnToUtf16Char(line, 6), 3); // b starts at byte 6 -> char 3
});

test("non-ASCII content BEFORE the diagnostic does not shift the column target", () => {
  // Line with 你 at the front; diagnostic byte 4 is the start of "x".
  const line = "你x";
  // 你 = bytes 1-3 (char 0), "x" = byte 4 (char 1)
  assert.equal(byteColumnToUtf16Char(line, 4), 1);
  assert.equal(byteColumnToUtf16Char(line, 3), 0); // inside 你 -> char 0
});

test("editToUtf16Range converts a multi-byte edit span", () => {
  const line = "aéb"; // é = bytes 2-3, char 1; exclusive end byte 4 -> char 2
  const edit = { startLine: 1, startColumn: 2, endLine: 1, endColumn: 4, replacement: "X" };
  const getLineText = (i) => (i === 0 ? line : "");
  assert.deepEqual(editToUtf16Range(edit, getLineText), {
    startLine: 0,
    startChar: 1,
    endLine: 0,
    endChar: 2,
  });
});

test("applyEditsToString replaces text at the byte-correct position", () => {
  // Replace é (bytes 2-3, exclusive end byte 4) with "e".
  const text = "aéb";
  const edits = [{ startLine: 1, startColumn: 2, endLine: 1, endColumn: 4, replacement: "e" }];
  assert.equal(applyEditsToString(text, edits), "aeb");
});

test("applyEditsToString handles insertion (zero-width edit)", () => {
  const text = "ab";
  const edits = [{ startLine: 1, startColumn: 2, endLine: 1, endColumn: 2, replacement: "X" }];
  assert.equal(applyEditsToString(text, edits), "aXb");
});

test("applyEditsToString handles astral replacement", () => {
  // Replace 😀 (bytes 2-5, exclusive end byte 6) with the 2-char sequence "<3".
  const text = "a😀b";
  const edits = [{ startLine: 1, startColumn: 2, endLine: 1, endColumn: 6, replacement: "<3" }];
  assert.equal(applyEditsToString(text, edits), "a<3b");
});

test("applyEditsToString applies multiple edits back-to-front", () => {
  const text = "abcdef";
  const edits = [
    { startLine: 1, startColumn: 1, endLine: 1, endColumn: 2, replacement: "X" }, // a -> X
    { startLine: 1, startColumn: 5, endLine: 1, endColumn: 6, replacement: "Y" }, // e -> Y
  ];
  assert.equal(applyEditsToString(text, edits), "XbcdYf");
});

test("applyEditsToString returns text unchanged when no edits", () => {
  assert.equal(applyEditsToString("abc", []), "abc");
});
