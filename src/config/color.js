// @ts-check

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
        FUNCTIONAL_COLOR_PATTERN.test(value) ||
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
