package com.anchor.commentdoclinks.model

/**
 * Validation status of a resolved reference, mirroring
 * [src/references/referenceTypes.js] RESOLUTION_STATUS.
 *
 * Consumers (navigation, hover, diagnostics, decorations) treat these statuses
 * identically, so a reference is never "valid when clicked" but "broken
 * according to diagnostics".
 */
enum class ResolutionStatus(val value: String) {
    /** Target file exists and any anchor/line is valid (or file unreadable). */
    VALID("valid"),

    /** Target file does not exist on disk. */
    MISSING_FILE("missing-file"),

    /** Target file exists but the requested anchor is not present. */
    MISSING_ANCHOR("missing-anchor"),

    /** Target file exists but the requested line is out of range. */
    INVALID_LINE("invalid-line"),

    /** Target path escapes the selected workspace/git root. */
    INVALID_PATH("invalid-path"),

    /** Reference type has no local target (issue/API/DOC-…). */
    EXTERNAL("external");

    companion object {
        fun fromValue(v: String): ResolutionStatus? = entries.firstOrNull { it.value == v }
    }
}
