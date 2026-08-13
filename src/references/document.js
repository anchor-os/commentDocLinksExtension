// @ts-check

/**
 * Minimal document-like view over raw text, mirroring the shape of a
 * `vscode.TextDocument` that parsers/resolvers consume.
 *
 * Handles LF, CRLF and bare-CR line endings uniformly.
 *
 * @param {string} text
 * @param {string} [languageId]
 * @returns {{
 *   languageId: string,
 *   lineCount: number,
 *   lineAt(index: number): { text: string }
 * }}
 */
export function documentFromText(text, languageId = "markdown") {
  const lines = text.split(/\r\n|\r|\n/);

  return {
    languageId,
    lineCount: lines.length,
    lineAt(index) {
      return { text: lines[index] };
    },
  };
}

/**
 * Count lines the same way `documentFromText` splits them.
 *
 * @param {string} text
 * @returns {number}
 */
export function countLines(text) {
  return text.split(/\r\n|\r|\n/).length;
}
