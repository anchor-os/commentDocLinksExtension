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
                ): Array<PsiReference> {
                    LOG.info("CDL MD PROVIDER invoked for ${element::class.simpleName}")
                    return referencesForFile(element)
                }
            },
        )
    }

    internal fun referencesForFile(element: PsiElement): Array<PsiReference> {
        LOG.info("CDL MD CONTRIB entry: element=${element::class.simpleName}")
        val file = element as? PsiFile ?: run {
            LOG.info("CDL MD CONTRIB skip: not a PsiFile")
            return PsiReference.EMPTY_ARRAY
        }
        val virtualFile = file.virtualFile ?: run {
            LOG.info("CDL MD CONTRIB skip: virtualFile null")
            return PsiReference.EMPTY_ARRAY
        }
        val languageId = languageIdFromVirtualFile(virtualFile) ?: run {
            LOG.info("CDL MD CONTRIB skip: languageId null for ${virtualFile.path}")
            return PsiReference.EMPTY_ARRAY
        }
        if (languageId != "markdown") {
            LOG.info("CDL MD CONTRIB skip: languageId=$languageId not markdown")
            return PsiReference.EMPTY_ARRAY
        }
        val document = file.viewProvider.document ?: run {
            LOG.info("CDL MD CONTRIB skip: document null")
            return PsiReference.EMPTY_ARRAY
        }

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
            // Make the whole `## src/file.js — anchor` (or `#anchor`) heading
            // clickable, not just the source-path span — the anchor is the part
            // a reader naturally clicks. `heading.start` is the path start; the
            // slug (if any) runs to the end of the line.
            val rangeEnd = document.getLineEndOffset(line)
            references.add(
                MarkdownSourceReference(
                    file,
                    heading,
                    file,
                    TextRange(lineStart + heading.start, rangeEnd),
                ),
            )
        }
        return references.toTypedArray()
    }

    companion object {
        private val LOG = com.intellij.openapi.diagnostic.Logger.getInstance(MarkdownSourceLinkContributor::class.java)
    }
}
