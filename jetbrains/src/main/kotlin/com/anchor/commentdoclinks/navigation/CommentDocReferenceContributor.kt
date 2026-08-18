package com.anchor.commentdoclinks.navigation

import com.anchor.commentdoclinks.config.CommentDocLinksConfig
import com.anchor.commentdoclinks.model.DocumentLike
import com.anchor.commentdoclinks.parser.scanDocumentForReferences
import com.anchor.commentdoclinks.services.documentLikeFromDocument
import com.anchor.commentdoclinks.services.languageIdFromVirtualFile
import com.intellij.patterns.PlatformPatterns
import com.intellij.psi.PsiElement
import com.intellij.psi.PsiFile
import com.intellij.psi.PsiReference
import com.intellij.psi.PsiReferenceContributor
import com.intellij.psi.PsiReferenceProvider
import com.intellij.psi.PsiReferenceRegistrar
import com.intellij.openapi.diagnostic.Logger
import com.intellij.util.ProcessingContext

/**
 * Registers [CommentDocReference]s for every supported source file.
 *
 * The provider is invoked once per [PsiFile]; it scans the whole document for
 * comment references and returns them with file-relative ranges. Files whose
 * extension does not map to a supported language are skipped.
 */
class CommentDocReferenceContributor : PsiReferenceContributor() {
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

    internal fun referencesForFile(element: PsiElement): Array<PsiReference> {
        val file = element as? PsiFile ?: return PsiReference.EMPTY_ARRAY
        val virtualFile = file.virtualFile ?: return PsiReference.EMPTY_ARRAY
        val languageId = languageIdFromVirtualFile(virtualFile) ?: return PsiReference.EMPTY_ARRAY
        val document = file.viewProvider.document ?: return PsiReference.EMPTY_ARRAY
        val doc: DocumentLike = documentLikeFromDocument(document)

        val references = mutableListOf<PsiReference>()
        for (scanned in scanDocumentForReferences(doc, languageId, CommentDocLinksConfig.ticketLinks)) {
            LOG.info("CDL CONTRIB: found ref '${scanned.reference.file}' in ${virtualFile.path} (lang=$languageId)")
            // `scanDocumentForReferences` reports offsets relative to the start of
            // the reference's own line; IntelliJ expects document-absolute ranges,
            // so shift by the line's start offset. Without this, every reference on
            // a line other than the first is created at the wrong location and is
            // not clickable.
            val lineStart = document.getLineStartOffset(scanned.line)
            references.add(CommentDocReference(file, scanned.reference, file, lineStart))
        }
        return references.toTypedArray()
    }

    companion object {
        private val LOG = Logger.getInstance(CommentDocReferenceContributor::class.java)
    }
}
