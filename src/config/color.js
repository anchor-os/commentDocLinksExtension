// @ts-check

/**
 * The special value that selects VS Code's theme link color.
 */
export const THEME_LINK_COLOR = "theme";

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const FUNCTIONAL_COLOR_PATTERN = /^(rgb|rgba|hsl|hsla)\((.*)\)$/i;

const COLOR_COMPONENT_PATTERN =
    /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:deg|rad|grad|turn|%)?$/i;

const ALPHA_COMPONENT_PATTERN =
    /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:%)?$/i;

/**
 * True when `value` is a CSS functional color following the documented
 * subset: exactly three numeric components, comma-separated (legacy) or
 * whitespace-separated (modern), with an optional alpha after `/`.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isFunctionalColor(value) {
    const match = FUNCTIONAL_COLOR_PATTERN.exec(value);

    if (!match) {
        return false;
    }

    const body = match[2].trim();

    if (body.length === 0) {
        return false;
    }

    const slashIndex = body.indexOf("/");
    const color = slashIndex === -1
        ? body
        : body.slice(0, slashIndex);
    const alpha = slashIndex === -1
        ? null
        : body.slice(slashIndex + 1);

    if (
        alpha !== null &&
        (alpha.includes("/") || color.length === 0)
    ) {
        return false;
    }

    const legacySyntax = color.includes(",");

    const components = (
        legacySyntax
            ? color.split(",")
            : color.trim().split(/\s+/)
    ).map((part) => part.trim());

    if (components.length === 4) {
        // Legacy `rgba()`/`hsla()` may put the alpha in a fourth
        // comma-separated component, but never alongside a `/` alpha
        // and never in space-separated syntax.
        if (!legacySyntax || alpha !== null) {
            return false;
        }

        const legacyAlpha = components.pop();

        if (
            legacyAlpha === undefined ||
            legacyAlpha.length === 0 ||
            !ALPHA_COMPONENT_PATTERN.test(legacyAlpha)
        ) {
            return false;
        }
    }

    if (
        components.length !== 3 ||
        components.some((part) =>
            !COLOR_COMPONENT_PATTERN.test(part)
        )
    ) {
        return false;
    }

    if (alpha !== null) {
        const alphaComponent = alpha.trim();

        if (
            alphaComponent.length === 0 ||
            !ALPHA_COMPONENT_PATTERN.test(alphaComponent)
        ) {
            return false;
        }
    }

    return true;
}

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
 * True when `value` is a usable link color: the special `"theme"` marker,
 * a hex color, a CSS functional color, or a named CSS color.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isValidLinkColor(value) {
    if (typeof value !== "string") {
        return false;
    }

    return (
        value === THEME_LINK_COLOR ||
        HEX_COLOR_PATTERN.test(value) ||
        isFunctionalColor(value) ||
        NAMED_COLORS.has(value.toLowerCase())
    );
}

/**
 * Normalize a user-supplied link color, falling back to the theme marker
 * when the value is not a usable color.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function validLinkColor(value) {
    return isValidLinkColor(value) ? value : THEME_LINK_COLOR;
}
