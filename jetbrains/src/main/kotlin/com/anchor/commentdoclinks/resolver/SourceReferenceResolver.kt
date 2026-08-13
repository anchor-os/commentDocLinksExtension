package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.parser.scanDocumentForReferences

/**
 * A position inside a source document pointing back at the comment that
 * references a documentation file.
 *
 * @property line 0-based line of the referencing comment.
 * @property character 0-based character offset (always 0 in this resolver,
 *   matching the VS Code behaviour that navigates to the line start).
 * @property anchorFound true when the requested anchor was matched exactly;
 *   when false the position still points at the best available location.
 */
data class SourceReference(
    val line: Int,
    val character: Int,
    val anchorFound: Boolean
)

/**
 * Compare documentation file paths ignoring a leading `./`, so a source comment
 * that writes `./docs/guide.md` still round-trips with reverse navigation,
 * which produces `docs/guide.md`.
 */
private fun normalizedFile(file: String): String =
    if (file.startsWith("./")) file.substring(2) else file

/**
 * Find the source comment that references a documentation file.
 *
 * Resolution rules:
 *  - The exact reference `documentationFile#anchor` wins.
 *  - If the file is referenced without the anchor, the first such reference is
 *    returned (anchorFound: false).
 *  - If nothing references the file, the top of the source document is
 *    returned (anchorFound: false).
 *
 * Non-documentation references (issue/API/ticket) carry a null [ParsedReference.file]
 * and never match a documentation file, so they are simply skipped.
 *
 * @param documentationFile workspace-relative path as produced by reverse
 *   navigation (no leading `./`).
 */
fun resolveSourceReference(
    document: DocumentLike,
    languageId: String,
    documentationFile: String,
    anchor: String?
): SourceReference {
    var fallback: SourceReference? = null

    for ((reference, line) in scanDocumentForReferences(document, languageId)) {
        if (normalizedFile(reference.file ?: "") != normalizedFile(documentationFile)) {
            continue
        }

        if (anchor != null && reference.anchor == anchor) {
            return SourceReference(line, 0, anchorFound = true)
        }

        if (reference.anchor == null && fallback == null) {
            fallback = SourceReference(line, 0, anchorFound = false)
        }
    }

    return fallback ?: SourceReference(0, 0, anchorFound = false)
}

/**
 * True when the source document contains a comment that references the
 * documentation file with the exact anchor.
 */
fun hasExactSourceReference(
    document: DocumentLike,
    languageId: String,
    documentationFile: String,
    anchor: String
): Boolean {
    if (anchor.isEmpty()) {
        return false
    }

    for ((reference, _) in scanDocumentForReferences(document, languageId)) {
        if (
            normalizedFile(reference.file ?: "") == normalizedFile(documentationFile) &&
            reference.anchor == anchor
        ) {
            return true
        }
    }

    return false
}

/**
 * List every anchor referenced by comments in the source document that point
 * at the given documentation file.
 */
fun listSourceAnchors(
    document: DocumentLike,
    languageId: String,
    documentationFile: String
): List<String> {
    val anchors = mutableSetOf<String>()

    for ((reference, _) in scanDocumentForReferences(document, languageId)) {
        if (
            normalizedFile(reference.file ?: "") == normalizedFile(documentationFile) &&
            reference.anchor != null
        ) {
            anchors.add(reference.anchor!!)
        }
    }

    return anchors.toList()
}
