/**
 * PDF Text Extractor
 *
 * Extracts text content from PDF files using PDF.js library.
 * Works with both embedded PDFs and PDF URLs.
 */

console.log('[Browser Assistant] pdf-extractor.js loaded');

class PDFExtractor {
  constructor() {
    // Configure PDF.js worker
    if (typeof pdfjsLib !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('libs/pdf.worker.min.js');
    }
  }

  /**
   * Check if current page is a PDF
   * @returns {boolean}
   */
  isPDF() {
    return document.contentType === 'application/pdf' ||
           window.location.pathname.toLowerCase().endsWith('.pdf') ||
           document.querySelector('embed[type="application/pdf"]') !== null;
  }

  /**
   * Get PDF URL from current page
   * @returns {string|null}
   */
  getPDFUrl() {
    // If we're viewing a PDF directly
    if (document.contentType === 'application/pdf') {
      return window.location.href;
    }

    // Check for embedded PDF
    const embed = document.querySelector('embed[type="application/pdf"]');
    if (embed && embed.src) {
      return embed.src;
    }

    // Check if URL is a PDF
    if (window.location.pathname.toLowerCase().endsWith('.pdf')) {
      return window.location.href;
    }

    return null;
  }

  /**
   * Extract text from a PDF document
   * @param {string} url - URL of the PDF
   * @returns {Promise<Object>} - Extracted text and metadata
   */
  async extractText(url) {
    try {
      console.log('[PDFExtractor] Loading PDF from:', url);

      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library not loaded');
      }

      // Load the PDF document
      const loadingTask = pdfjsLib.getDocument(url);
      const pdf = await loadingTask.promise;

      console.log(`[PDFExtractor] PDF loaded: ${pdf.numPages} pages`);

      const textContent = [];
      const title = await this.getPDFTitle(pdf);

      // Extract text from each page
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        // Combine text items from the page
        const pageText = content.items.map(item => item.str).join(' ');
        textContent.push(pageText);

        console.log(`[PDFExtractor] Extracted page ${pageNum}/${pdf.numPages}`);
      }

      const fullText = textContent.join('\n\n');

      console.log(`[PDFExtractor] Extraction complete: ${fullText.length} characters`);

      return {
        text: fullText,
        title: title || document.title || 'PDF Document',
        pageCount: pdf.numPages,
        success: true
      };

    } catch (error) {
      console.error('[PDFExtractor] Error extracting PDF text:', error);
      return {
        text: '',
        title: document.title || 'PDF Document',
        pageCount: 0,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get PDF metadata title
   * @param {Object} pdf - PDF.js document object
   * @returns {Promise<string|null>}
   */
  async getPDFTitle(pdf) {
    try {
      const metadata = await pdf.getMetadata();
      return metadata.info?.Title || null;
    } catch (error) {
      console.warn('[PDFExtractor] Could not get PDF metadata:', error);
      return null;
    }
  }
}

// Export globally for content script
window.PDFExtractor = PDFExtractor;
