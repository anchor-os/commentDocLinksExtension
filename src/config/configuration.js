// @ts-check

import * as vscode from "vscode";

import { THEME_LINK_COLOR, validLinkColor } from "./color.js";

/**
 * Configuration identifiers. Declared in package.json `contributes.configuration`
 * with window scope so they work at User, Workspace and Machine level through
 * VS Code's normal configuration system.
 */
export const CONFIGURATION = {
  SECTION: "commentDocLinks",
  ENABLE_DECORATIONS: "enableDecorations",
  LINK_COLOR: "linkColor",
  LINK_UNDERLINE: "linkUnderline",
  ENABLE_DIAGNOSTICS: "enableDiagnostics",
  ENABLE_COMPLETION: "enableCompletion",
  TICKET_LINKS: "ticketLinks",
};

export { THEME_LINK_COLOR } from "./color.js";

/**
 * @typedef {object} ExtensionConfiguration
 * @property {boolean} enableDecorations
 * @property {"theme"|string} linkColor `"theme"` or a valid CSS color.
 * @property {boolean} linkUnderline
 * @property {boolean} enableDiagnostics
 * @property {boolean} enableCompletion
 */

/**
 * @typedef {object} TicketLink
 * @property {string} baseUrl URL prefix; the matched key is appended.
 * @property {RegExp} regex Compiled ticket-key pattern (wrapped with a
 *   leading `(?<!\w)` look-behind so keys inside words/URLs are ignored).
 * @property {string|null} label Optional hover label.
 */

/**
 * Read and validate the extension configuration.
 *
 * Invalid values fall back to the documented defaults instead of being
 * trusted, so a typo like `"linkColor": "grean"` never breaks rendering.
 *
 * @returns {ExtensionConfiguration}
 */
export function getConfiguration() {
  const configuration = vscode.workspace.getConfiguration(CONFIGURATION.SECTION);

  const linkColor = configuration.get(CONFIGURATION.LINK_COLOR);

  return {
    enableDecorations: asBoolean(configuration.get(CONFIGURATION.ENABLE_DECORATIONS), true),
    linkColor: validLinkColor(linkColor),
    linkUnderline: asBoolean(configuration.get(CONFIGURATION.LINK_UNDERLINE), true),
    enableDiagnostics: asBoolean(configuration.get(CONFIGURATION.ENABLE_DIAGNOSTICS), true),
    enableCompletion: asBoolean(configuration.get(CONFIGURATION.ENABLE_COMPLETION), true),
  };
}

/**
 * @param {unknown} value
 * @param {boolean} fallback
 */
function asBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

/**
 * True when the configuration changed in a way that affects decorations.
 *
 * @param {vscode.ConfigurationChangeEvent} event
 */
export function affectsDecorationConfiguration(event) {
  return (
    event.affectsConfiguration(CONFIGURATION.SECTION) ||
    event.affectsConfiguration(`${CONFIGURATION.SECTION}.${CONFIGURATION.ENABLE_DECORATIONS}`) ||
    event.affectsConfiguration(`${CONFIGURATION.SECTION}.${CONFIGURATION.LINK_COLOR}`) ||
    event.affectsConfiguration(`${CONFIGURATION.SECTION}.${CONFIGURATION.LINK_UNDERLINE}`)
  );
}

/**
 * Read and validate the `commentDocLinks.ticketLinks` setting.
 *
 * Each entry `{ baseUrl, pattern, label? }` is turned into a compiled
 * `TicketLink`. The pattern is wrapped with a leading `(?<!\w)` look-behind so
 * keys embedded in longer words or URLs are not matched. Invalid patterns are
 * skipped with a warning (guards against bad regex / ReDoS from user input).
 *
 * @returns {TicketLink[]}
 */
export function getTicketLinks() {
  const raw = vscode.workspace
    .getConfiguration(CONFIGURATION.SECTION)
    .get(CONFIGURATION.TICKET_LINKS);

  if (!Array.isArray(raw)) {
    return [];
  }

  /** @type {TicketLink[]} */
  const links = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const baseUrl = typeof entry.baseUrl === "string" ? entry.baseUrl : "";
    const pattern = typeof entry.pattern === "string" ? entry.pattern : "";

    if (baseUrl.length === 0 || pattern.length === 0) {
      continue;
    }

    let regex;

    try {
      regex = new RegExp(`(?<!\\w)(${pattern})(?!\\w)`, "g");
    } catch {
      console.warn(
        `commentDocLinks.ticketLinks: skipping entry with invalid pattern "${pattern}".`,
      );
      continue;
    }

    const label = typeof entry.label === "string" && entry.label.length > 0 ? entry.label : null;

    links.push({ baseUrl, regex, label });
  }

  return links;
}

/**
 * Theme-aware color for a valid reference.
 *
 * `"theme"` maps to VS Code's `textLink.foreground` so the extension looks
 * native; a user-supplied color is used verbatim.
 *
 * @param {string} linkColor
 * @returns {vscode.ThemeColor|string}
 */
export function linkColorValue(linkColor) {
  if (linkColor === THEME_LINK_COLOR) {
    return new vscode.ThemeColor("textLink.foreground");
  }

  return linkColor;
}
