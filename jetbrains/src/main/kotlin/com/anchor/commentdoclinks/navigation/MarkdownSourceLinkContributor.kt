package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.resolver.parseMarkdownHeading
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.intellij.openapi.util.TextRange
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceContributor
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.PsiReferenceRegistrar
import com.intellij.util.ProcessingContext

/**
 * Registers [MarkdownSourceReference]s for `## src/file.js — anchor` headings
 * in Markdown documentation files (reverse navigation to source).
 */
class MarkdownSourceLinkContributor : PsiReferenceContributor() {
    override fun registerReferenceProviders(registrar: PsiReferenceRegistrar) {
        registrar.registerReferenceProvider(
            PlatformPatterns.psiFile(),
            object : PsiReferenceProvider() {
                override fun getReferencesByElement(
                    element: PsiElement,
                    context: ProcessingContext,
                ): Array<PsiReference> = referencesForFile(element)
            },
        )
    }

    private fun referencesForFile(element: PsiElement): Array<PsiReference> {
        val file = element as? PsiFile ?: return PsiReference.EMPTY_ARRAY
        val virtualFile = file.virtualFile ?: return PsiReference.EMPTY_ARRAY
        val languageId = languageIdFromVirtualFile(virtualFile) ?: return PsiReference.EMPTY_ARRAY
        if (languageId != "markdown") return PsiReference.EMPTY_ARRAY
        val document = file.viewProvider.document ?: return PsiReference.EMPTY_ARRAY

        val references = mutableListOf<PsiReference>()
        for (line in 0 until document.lineCount) {
            val lineText =
                document.getText(
                    com.intellij.openapi.util.TextRange(
                        document.getLineStartOffset(line),
                        document.getLineEndOffset(line),
                    ),
                )
            val heading = parseMarkdownHeading(lineText) ?: continue
            val lineStart = document.getLineStartOffset(line)
            references.add(
                MarkdownSourceReference(
                    file,
                    heading,
                    file,
                    TextRange(lineStart + heading.start, lineStart + heading.end),
                ),
            )
        }
        return references.toTypedArray()
    }
}
