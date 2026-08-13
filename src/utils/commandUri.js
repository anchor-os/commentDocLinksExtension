// @ts-check

import * as vscode from "vscode";

/**
 * @param {string} command
 * @param {...unknown} args
 * @returns {vscode.Uri}
 */
export function createCommandUri(command, ...args) {
  const query = encodeURIComponent(JSON.stringify(args));

  return vscode.Uri.parse(`command:${command}?${query}`);
}
