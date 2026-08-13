// @ts-check

/**
 * Minimal document-like object so parsers/resolvers can be tested
 * outside the VS Code extension host.
 *
 * @param {string[]} lines
 * @param {string} languageId
 */
export function makeDocument(lines, languageId = "javascript") {
  return {
    languageId,
    lineCount: lines.length,
    lineAt(index) {
      return { text: lines[index] };
    },
  };
}
