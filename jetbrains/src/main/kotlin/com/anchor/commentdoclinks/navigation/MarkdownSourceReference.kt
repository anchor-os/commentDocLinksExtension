package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.model.stringDocument
import com.anchor.commentdoclinks.resolver.FileSystemLike
import com.anchor.commentdoclinks.resolver.ParsedHeading
import com.anchor.commentdoclinks.resolver.resolveInRoot
import com.anchor.commentdoclinks.resolver.resolveSourceReference
import com.anchor.commentdoclinks.resolver.workspaceRelativePath
import com.anchor.commentdoclinks.services.VfsFileSystem
import com.anchor.commentdoclinks.services.WorkspaceRootService
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.util.TextRange
import com.intellij.openapi.vfs.LocalFileSystem
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiManager
import com.intellij.psi.PsiReferenceBase

/**
 * A navigable source-link inside a Markdown documentation heading.
 *
 * Attached to the Markdown [PsiFile] with a file-relative range covering the
 * `src/file.js` span. Resolving opens the source file and reveals the comment
 * that references this documentation file (reverse navigation, mirroring
 * `src/providers/markdownLinkProvider.js` + `openSource`).
 */
class MarkdownSourceReference(
    element: PsiElement,
    private val heading: ParsedHeading,
    private val markdownFile: PsiFile,
    range: TextRange,
) : PsiReferenceBase<PsiElement>(element, range, false) {
    override fun resolve(): PsiElement? {
        val project = markdownFile.project
        val virtualFile = markdownFile.virtualFile ?: return null
        val root = WorkspaceRootService(project).resolveWorkspaceRoot(virtualFile) ?: return null
        LOG.debug("BACK resolve: root=$root source=${heading.source} anchor=${heading.anchor}")

        val sourcePath = resolveInRoot(root, heading.source)
        LOG.debug("BACK sourcePath=$sourcePath")
        if (sourcePath == null) return null
        val sourceVf = LocalFileSystem.getInstance().refreshAndFindFileByPath(sourcePath)
        LOG.debug("BACK sourceVf=${sourceVf?.path}")
        if (sourceVf == null) return null
        val sourcePsi = PsiManager.getInstance(project).findFile(sourceVf)
        LOG.debug("BACK sourcePsi=${sourcePsi?.virtualFile?.path}")
        if (sourcePsi == null) return sourcePsi
        val sourceLanguageId = languageIdFromVirtualFile(sourceVf) ?: return sourcePsi

        val documentationFile = workspaceRelativePath(virtualFile.path, root) ?: return sourcePsi
        LOG.debug("BACK documentationFile=$documentationFile")
        val fs: FileSystemLike = VfsFileSystem()
        val sourceText = fs.readText(sourcePath) ?: return sourcePsi
        val sourceDoc = stringDocument(sourceText)

        val location = resolveSourceReference(sourceDoc, sourceLanguageId, documentationFile, heading.anchor)
        LOG.debug("BACK resolvedLine=${location.line} anchorFound=${location.anchorFound}")
        return elementAtLine(sourcePsi, location.line)
    }

    private fun elementAtLine(
        file: PsiFile,
        line: Int,
    ): PsiElement? {
        val document = file.viewProvider.document ?: return file
        if (line < 0 || line >= document.lineCount) return file
        val offset = document.getLineStartOffset(line)
        return file.findElementAt(offset) ?: file
    }

    override fun getVariants(): Array<com.intellij.codeInsight.lookup.LookupElement> =
        com.intellij.codeInsight.lookup.LookupElement.EMPTY_ARRAY

    companion object {
        private val LOG = Logger.getInstance(MarkdownSourceReference::class.java)
    }
}
