// @ts-check

import * as vscode from "vscode";
import { getTicketLinks } from "../config/configuration.js";
import { COMMANDS } from "../constants.js";
import { supportsLanguage } from "../parsers/languageSupport.js";
import { scanDocumentForReferences } from "../references/documentScanner.js";
import { createCommandUri } from "../utils/commandUri.js";

/**
 * @implements {vscode.DocumentLinkProvider}
 */
export class CommentLinkProvider {
  /**
   * @param {vscode.TextDocument} document
   */
  provideDocumentLinks(document) {
    if (!supportsLanguage(document.languageId)) {
      return [];
    }

    const links = [];

    for (const { reference, line } of scanDocumentForReferences(document, getTicketLinks())) {
      const range = new vscode.Range(line, reference.start, line, reference.end);

      const target = createCommandUri(COMMANDS.OPEN_REFERENCE, reference, document.uri.fsPath);

      links.push(new vscode.DocumentLink(range, target));
    }

    return links;
  }
}
