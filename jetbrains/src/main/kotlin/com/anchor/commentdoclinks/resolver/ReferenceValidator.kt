package com.anchor.commentdoclinks.resolver

import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ReferenceType
import com.anchor.commentdoclinks.model.ResolutionResult
import com.anchor.commentdoclinks.model.ResolutionStatus
import com.anchor.commentdoclinks.model.stringDocument

/**
 * Minimal file-system view the validator needs: existence + text read.
 * Backed by IntelliJ VFS at the boundary; faked in tests.
 */
interface FileSystemLike {
    fun exists(targetPath: String): Boolean

    fun readText(targetPath: String): String?
}

private val MESSAGES =
    mapOf(
        ResolutionStatus.MISSING_FILE to "Documentation file not found: ",
        ResolutionStatus.MISSING_ANCHOR to "Documentation anchor not found: ",
        ResolutionStatus.INVALID_LINE to "Documentation line out of range: ",
        ResolutionStatus.INVALID_PATH to "Documentation path is not allowed",
    )

/**
 * Validate a reference against the filesystem.
 *
 * Single source of truth for whether a reference is usable — navigation,
 * hover, diagnostics and decorations all consume the result.
 *
 * @param resolveTargetPath resolves a workspace-relative reference to an
 *   absolute path inside the root, or null when the path escapes the root.
 */
fun validateReference(
    reference: ParsedReference,
    resolveTargetPath: (String) -> String?,
    fs: FileSystemLike,
): ResolutionResult {
    if (reference.type == ReferenceType.DOCUMENTATION && reference.file != null) {
        return validateDocumentationReference(reference, resolveTargetPath, fs)
    }
    return ResolutionResult(ResolutionStatus.EXTERNAL, null, null, null)
}

private fun validateDocumentationReference(
    reference: ParsedReference,
    resolveTargetPath: (String) -> String?,
    fs: FileSystemLike,
): ResolutionResult {
    val targetPath = resolveTargetPath(reference.file!!)

    if (targetPath == null) {
        return ResolutionResult(
            ResolutionStatus.INVALID_PATH,
            null,
            null,
            MESSAGES[ResolutionStatus.INVALID_PATH],
        )
    }

    if (!fs.exists(targetPath)) {
        return ResolutionResult(
            ResolutionStatus.MISSING_FILE,
            targetPath,
            null,
            MESSAGES[ResolutionStatus.MISSING_FILE] + reference.file,
        )
    }

    if (reference.line != null) {
        return validateDocumentationLine(reference.line, targetPath, fs)
    }

    if (reference.anchor != null) {
        return validateDocumentationAnchor(reference.anchor, targetPath, fs)
    }

    return ResolutionResult(ResolutionStatus.VALID, targetPath, null, null)
}

private fun validateDocumentationLine(
    line: Int,
    targetPath: String,
    fs: FileSystemLike,
): ResolutionResult {
    val text = fs.readText(targetPath)

    if (text == null) {
        // Unreadable file → treated as valid (no false positives).
        return ResolutionResult(ResolutionStatus.VALID, targetPath, line, null)
    }

    val lineCount = countLines(text)

    if (line < 1 || line > lineCount) {
        return ResolutionResult(
            ResolutionStatus.INVALID_LINE,
            targetPath,
            null,
            MESSAGES[ResolutionStatus.INVALID_LINE] + line.toString(),
        )
    }

    return ResolutionResult(ResolutionStatus.VALID, targetPath, line, null)
}

private fun validateDocumentationAnchor(
    anchor: String,
    targetPath: String,
    fs: FileSystemLike,
): ResolutionResult {
    val text = fs.readText(targetPath)

    if (text == null) {
        return ResolutionResult(ResolutionStatus.VALID, targetPath, null, null)
    }

    val document: DocumentLike = stringDocument(text)

    if (!listAnchors(document).contains(anchor)) {
        return ResolutionResult(
            ResolutionStatus.MISSING_ANCHOR,
            targetPath,
            null,
            MESSAGES[ResolutionStatus.MISSING_ANCHOR] + anchor,
        )
    }

    return ResolutionResult(ResolutionStatus.VALID, targetPath, null, null)
}
