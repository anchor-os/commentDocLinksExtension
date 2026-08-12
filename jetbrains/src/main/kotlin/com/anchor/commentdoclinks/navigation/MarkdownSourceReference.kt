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
    range: TextRange
) : PsiReferenceBase<PsiElement>(element, range, false) {

    override fun resolve(): PsiElement? {
        val project = markdownFile.project
        val virtualFile = markdownFile.virtualFile ?: return null
        val root = WorkspaceRootService(project).resolveWorkspaceRoot(virtualFile) ?: return null

        val sourcePath = resolveInRoot(root, heading.source) ?: return null
        val sourceVf = LocalFileSystem.getInstance().findFileByPath(sourcePath) ?: return null
        val sourcePsi = PsiManager.getInstance(project).findFile(sourceVf) ?: return null
        val sourceLanguageId = languageIdFromVirtualFile(sourceVf) ?: return sourcePsi

        val documentationFile = workspaceRelativePath(virtualFile.path, root) ?: return sourcePsi
        val fs: FileSystemLike = VfsFileSystem()
        val sourceText = fs.readText(sourcePath) ?: return sourcePsi
        val sourceDoc = stringDocument(sourceText)

        val location = resolveSourceReference(sourceDoc, sourceLanguageId, documentationFile, heading.anchor)
        return elementAtLine(sourcePsi, location.line)
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
