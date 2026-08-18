package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.config.CommentDocLinksConfig
import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.model.ParsedReference
import com.anchor.commentdoclinks.parser.scanDocumentForReferences
import com.anchor.commentdoclinks.services.documentLikeFromDocument
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.intellij.openapi.diagnostic.Logger
import com.intellij.openapi.editor.Document
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceContributor
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.PsiReferenceRegistrar
import com.intellij.util.ProcessingContext
import java.util.concurrent.ConcurrentHashMap

/**
 * Registers [CommentDocReference]s for doc-link comments in any supported
 * source file.
 *
 * Registered on [PlatformPatterns.psiComment()] (NOT [PlatformPatterns.psiFile]):
 * IntelliJ's daemon collects references for element-level PSI (comments,
 * literals, …) during highlighting but does not invoke file-level
 * (`psiFile()`) reference providers in that pass, so a file-level provider is
 * never called at runtime. Each comment element yields only the references
 * whose range falls inside that comment.
 */
class CommentDocReferenceContributor : PsiReferenceContributor() {
    override fun registerReferenceProviders(registrar: PsiReferenceRegistrar) {
        LOG.info("CDL REGISTER providers (contributor instantiated)")
        registrar.registerReferenceProvider(
            PlatformPatterns.psiComment(),
            object : PsiReferenceProvider() {
                override fun getReferencesByElement(
                    element: PsiElement,
                    context: ProcessingContext,
                ): Array<PsiReference> {
                    return referencesForFile(element)
                }
            },
        )
    }

    internal fun referencesForFile(element: PsiElement): Array<PsiReference> {
        val file = element.containingFile ?: return PsiReference.EMPTY_ARRAY
        val virtualFile = file.virtualFile ?: return PsiReference.EMPTY_ARRAY
        val languageId = languageIdFromVirtualFile(virtualFile) ?: return PsiReference.EMPTY_ARRAY
        val document = file.viewProvider.document ?: return PsiReference.EMPTY_ARRAY

        val scanned = scanCache(document, file, languageId)
        val commentStart = element.textRange.startOffset
        val commentEnd = element.textRange.endOffset

        val references = mutableListOf<PsiReference>()
        for (s in scanned) {
            val absStart = s.absLineStart + s.reference.start
            val absEnd = s.absLineStart + s.reference.end
            if (absStart < commentStart || absEnd > commentEnd) continue
            // Range is relative to the comment element (the reference's host),
            // so shift the absolute line-start back by the comment's start.
            val lineOffset = s.absLineStart - commentStart
            references.add(CommentDocReference(element, s.reference, file, lineOffset))
        }
        return references.toTypedArray()
    }

    private data class ScannedRef(val reference: ParsedReference, val absLineStart: Int)

    private fun scanCache(document: Document, file: PsiFile, languageId: String): List<ScannedRef> {
        val stamp = document.modificationStamp
        val revision = CommentDocLinksConfig.currentTicketLinksRevision
        val cached = CACHE[document]
        if (cached != null && cached.first == stamp && cached.second == revision) return cached.third
        val doc: DocumentLike = documentLikeFromDocument(document)
        val list =
            scanDocumentForReferences(doc, languageId, CommentDocLinksConfig.ticketLinks).map { s ->
                ScannedRef(s.reference, document.getLineStartOffset(s.line))
            }
        CACHE[document] = Triple(stamp, revision, list)
        return list
    }

    companion object {
        private val LOG = Logger.getInstance(CommentDocReferenceContributor::class.java)
        private val CACHE = ConcurrentHashMap<Document, Triple<Long, Int, List<ScannedRef>>>()
    }
}
