// @ts-check

import * as vscode from "vscode";

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

/**
 * The special value that selects VS Code's theme link color.
 */
export const THEME_LINK_COLOR = "theme";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const FUNCTIONAL_COLOR_PATTERN =
    /^(?:rgb|rgba|hsl|hsla)\([^)]*\d[^)]*\)$/i;

const NAMED_COLORS = new Set([
    "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure",
    "beige", "bisque", "black", "blanchedalmond", "blue",
    "blueviolet", "brown", "burlywood", "cadetblue", "chartreuse",
    "chocolate", "coral", "cornflowerblue", "cornsilk", "crimson",
    "cyan", "darkblue", "darkcyan", "darkgoldenrod", "darkgray",
    "darkgreen", "darkgrey", "darkkhaki", "darkmagenta",
    "darkolivegreen", "darkorange", "darkorchid", "darkred",
    "darksalmon", "darkseagreen", "darkslateblue", "darkslategray",
    "darkslategrey", "darkturquoise", "darkviolet", "deeppink",
    "deepskyblue", "dimgray", "dimgrey", "dodgerblue", "firebrick",
    "floralwhite", "forestgreen", "fuchsia", "gainsboro",
    "ghostwhite", "gold", "goldenrod", "gray", "green",
    "greenyellow", "grey", "honeydew", "hotpink", "indianred",
    "indigo", "ivory", "khaki", "lavender", "lavenderblush",
    "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
    "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen",
    "lightgrey", "lightpink", "lightsalmon", "lightseagreen",
    "lightskyblue", "lightslategray", "lightslategrey",
    "lightsteelblue", "lightyellow", "lime", "limegreen", "linen",
    "magenta", "maroon", "mediumaquamarine", "mediumblue",
    "mediumorchid", "mediumpurple", "mediumseagreen",
    "mediumslateblue", "mediumspringgreen", "mediumturquoise",
    "mediumvioletred", "midnightblue", "mintcream", "mistyrose",
    "moccasin", "navajowhite", "navy", "oldlace", "olive",
    "olivedrab", "orange", "orangered", "orchid", "palegoldenrod",
    "palegreen", "paleturquoise", "palevioletred", "papayawhip",
    "peachpuff", "peru", "pink", "plum", "powderblue", "purple",
    "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown",
    "salmon", "sandybrown", "seagreen", "seashell", "sienna",
    "silver", "skyblue", "slateblue", "slategray", "slategrey",
    "snow", "springgreen", "steelblue", "tan", "teal", "thistle",
    "tomato", "transparent", "turquoise", "violet", "wheat",
    "white", "whitesmoke", "yellow", "yellowgreen"
]);

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
 * @param {unknown} value
 * @returns {string}
 */
function validLinkColor(value) {
    if (
        typeof value === "string" &&
        (value === THEME_LINK_COLOR ||
            HEX_COLOR_PATTERN.test(value) ||
            FUNCTIONAL_COLOR_PATTERN.test(value) ||
            NAMED_COLORS.has(value.toLowerCase()))
    ) {
        return value;
    }

    return THEME_LINK_COLOR;
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
