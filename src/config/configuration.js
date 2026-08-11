// @ts-check

import * as vscode from "vscode";

import {
    THEME_LINK_COLOR,
    validLinkColor
} from "./color.js";

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
    ENABLE_COMPLETION: "enableCompletion"
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
 * Read and validate the extension configuration.
 *
 * Invalid values fall back to the documented defaults instead of being
 * trusted, so a typo like `"linkColor": "grean"` never breaks rendering.
 *
 * @returns {ExtensionConfiguration}
 */
export function getConfiguration() {
    const configuration =
        vscode.workspace.getConfiguration(CONFIGURATION.SECTION);

    const linkColor =
        configuration.get(CONFIGURATION.LINK_COLOR);

    return {
        enableDecorations: asBoolean(
            configuration.get(CONFIGURATION.ENABLE_DECORATIONS),
            true
        ),
        linkColor: validLinkColor(linkColor),
        linkUnderline: asBoolean(
            configuration.get(CONFIGURATION.LINK_UNDERLINE),
            true
        ),
        enableDiagnostics: asBoolean(
            configuration.get(CONFIGURATION.ENABLE_DIAGNOSTICS),
            true
        ),
        enableCompletion: asBoolean(
            configuration.get(CONFIGURATION.ENABLE_COMPLETION),
            true
        )
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
        event.affectsConfiguration(
            `${CONFIGURATION.SECTION}.${CONFIGURATION.ENABLE_DECORATIONS}`
        ) ||
        event.affectsConfiguration(
            `${CONFIGURATION.SECTION}.${CONFIGURATION.LINK_COLOR}`
        ) ||
        event.affectsConfiguration(
            `${CONFIGURATION.SECTION}.${CONFIGURATION.LINK_UNDERLINE}`
        )
    );
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
