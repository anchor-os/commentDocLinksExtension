// @ts-check

/**
 * Pure conversion between the `custom-biome-lint` v1 contract's UTF-8
 * BYTE columns and VS Code's UTF-16 code-unit `character` offsets.
 *
 * The contract reports 1-based (line, 1-based UTF-8 byte column) positions.
 * VS Code `Position(line, character)` uses 1-based LINE and a `character` that
 * is a UTF-16 code-unit index from line start — NOT bytes, NOT Unicode scalar
 * characters. A multibyte char (é, 你, 😀) advances the BYTE column by its UTF-8
 * byte length but the UTF-16 index by 1 (BMP) or 2 (astral, e.g. 😀).
 *
 * This module is intentionally free of `vscode` so it can be unit-tested
 * directly and reused by both the diagnostic mapper and the code-action
 * provider (which wraps the produced coordinates in `vscode.Range`).
 */

/**
 * Convert a 1-based UTF-8 byte column within a line to a 0-based UTF-16
 * code-unit index (VS Code `character`).
 *
 * @param {string} lineText The text of the line (UTF-16 in JS strings).
 * @param {number} byteColumn1Based 1-based byte offset from the line start.
 * @returns {number} 0-based UTF-16 code-unit index; clamps to line end.
 */
export function byteColumnToUtf16Char(lineText, byteColumn1Based) {
  const targetByte = byteColumn1Based - 1; // 0-based byte offset from line start
  if (!Number.isFinite(targetByte) || targetByte < 0) return 0;

  let byteAcc = 0;
  for (let i = 0; i < lineText.length; i++) {
    const code = lineText.charCodeAt(i);
    let byteLen;
    if (code >= 0xd800 && code <= 0xdbff) {
      byteLen = 4; // high surrogate carries the full 4 UTF-8 bytes of the pair
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      byteLen = 0; // low surrogate contributes no bytes (the pair's 4 bytes are attributed to the high surrogate)
    } else if (code < 0x80) {
      byteLen = 1;
    } else if (code < 0x800) {
      byteLen = 2;
    } else {
      byteLen = 3;
    }

    // targetByte lands within this code unit's byte span -> its index.
    if (targetByte < byteAcc + byteLen) {
      return i;
    }
    byteAcc += byteLen;
  }
  return lineText.length;
}

/**
 * Convert a contract [LintEdit] (1-based byte columns) into VS Code-style
 * 0-based { line, character } coordinates, given a line-text lookup.
 *
 * @param {{ startLine: number, startColumn: number, endLine: number, endColumn: number }} edit
 * @param {(line0Based: number) => string} getLineText
 * @returns {{ startLine: number, startChar: number, endLine: number, endChar: number }}
 */
export function editToUtf16Range(edit, getLineText) {
  const startLineIdx = edit.startLine - 1;
  const endLineIdx = edit.endLine - 1;
  return {
    startLine: startLineIdx,
    startChar: byteColumnToUtf16Char(getLineText(startLineIdx) ?? "", edit.startColumn),
    endLine: endLineIdx,
    endChar: byteColumnToUtf16Char(getLineText(endLineIdx) ?? "", edit.endColumn),
  };
}

/**
 * Apply contract edits (byte columns) to a full source string and return the
 * resulting text. Used by unit tests to prove the adapter places/replaces text
 * exactly where the Rust binary intends (what `--auto-fix`/`--write-fix` would
 * produce). Edits are applied back-to-front so earlier offsets stay valid.
 *
 * @param {string} text Full source text.
 * @param {Array<{ startLine: number, startColumn: number, endLine: number, endColumn: number, replacement: string }>} edits
 * @returns {string}
 */
export function applyEditsToString(text, edits) {
  if (!edits || edits.length === 0) return text;
  const lines = text.split("\n");
  const getLineText = (i) => lines[i] ?? "";

  /** @type {Array<{ start: number, end: number, replacement: string }>} */
  const converted = [];
  for (const edit of edits) {
    const startChar = byteColumnToUtf16Char(getLineText(edit.startLine - 1), edit.startColumn);
    const endChar = byteColumnToUtf16Char(getLineText(edit.endLine - 1), edit.endColumn);
    if (startChar > endChar) continue;
    converted.push({
      start: absoluteChar(lines, edit.startLine - 1, startChar),
      end: absoluteChar(lines, edit.endLine - 1, endChar),
      replacement: edit.replacement,
    });
  }
  if (converted.length === 0) return text;

  let result = text;
  for (const { start, end, replacement } of converted.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }
  return result;
}

/**
 * Absolute character offset of a (line, char-in-line) position.
 * @param {string[]} lines
 * @param {number} line0Based
 * @param {number} charInLine
 * @returns {number}
 */
function absoluteChar(lines, line0Based, charInLine) {
  let offset = 0;
  for (let i = 0; i < line0Based; i++) offset += lines[i].length + 1;
  return offset + charInLine;
}
