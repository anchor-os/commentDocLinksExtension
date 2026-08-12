package com.anchor.commentdoclinks.model

/**
 * Stable reference-type identifiers, mirroring [src/references/referenceTypes.js].
 * Subsystems (hover, decorations, diagnostics, navigation) switch only on these.
 */
enum class ReferenceType(val value: String) {
    DOCUMENTATION("documentation"),
    ISSUE("issue"),
    API("api");

    companion object {
        fun fromValue(v: String): ReferenceType? = entries.firstOrNull { it.value == v }
    }
}
