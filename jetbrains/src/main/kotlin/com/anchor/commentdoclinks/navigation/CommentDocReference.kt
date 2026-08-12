package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.model.ResolutionStatus
import com.anchor.commentdoclinks.resolver.FileSystemLike
import com.anchor.commentdoclinks.resolver.resolveAnchor
import com.anchor.commentdoclinks.resolver.resolveInRoot
import com.anchor.commentdoclinks.resolver.validateReference
import com.anchor.commentdoclinks.services.VfsFileSystem
import com.anchor.commentdoclinks.services.WorkspaceRootService
import com.anchor.commentdoclinks.services.documentLikeFromDocument
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiManager
import com.intellij.psi.PsiReferenceBase

/**
 * A navigable reference living inside a source comment.
 *
 * Attached to the containing [PsiFile] with a file-relative range so IntelliJ
 * renders it as a clickable link (Ctrl/Cmd+Click, Go to Declaration). Resolving
 * opens the target documentation file and lands on the referenced line or
 * heading; external references (issue/API/DOC ticket) resolve to `null` because
 * they have no local target.
 */
class CommentDocReference(
    element: PsiElement,
    private val reference: ParsedReference,
    private val sourceFile: PsiFile
) : PsiReferenceBase<PsiElement>(element, TextRange(reference.start, reference.end), false) {

    override fun resolve(): PsiElement? {
        val project = sourceFile.project
        val virtualFile = sourceFile.virtualFile ?: return null
        val root = WorkspaceRootService(project).resolveWorkspaceRoot(virtualFile) ?: return null

        val fs: FileSystemLike = VfsFileSystem()
        val result = validateReference(reference, { rel -> resolveInRoot(root, rel) }, fs)

        if (result.status == ResolutionStatus.EXTERNAL || result.targetPath == null) {
            return null
        }

        val targetFile = LocalFileSystem.getInstance().findFileByPath(result.targetPath) ?: return null
        val targetPsi = PsiManager.getInstance(project).findFile(targetFile) ?: return null

        if (reference.line != null) {
            return elementAtLine(targetPsi, reference.line - 1)
        }

        if (reference.anchor != null) {
            val document = targetPsi.viewProvider.document ?: return targetPsi
            val location = resolveAnchor(documentLikeFromDocument(document), reference.anchor)
            if (location != null) {
                return elementAtLine(targetPsi, location.line)
            }
        }

        return targetPsi
    }

    private fun elementAtLine(file: PsiFile, line: Int): PsiElement? {
        val document = file.viewProvider.document ?: return file
        if (line < 0 || line >= document.lineCount) return file
        val offset = document.getLineStartOffset(line)
        return file.findElementAt(offset) ?: file
    }

    override fun getVariants(): Array<com.intellij.codeInsight.lookup.LookupElement> =
        com.intellij.codeInsight.lookup.LookupElement.EMPTY_ARRAY
}
