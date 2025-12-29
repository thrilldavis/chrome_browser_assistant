/**
 * Google Workspace Content Extractor
 *
 * Extracts content from Google Docs, Sheets, and Slides.
 * These apps use canvas-based rendering, so we extract from internal data models.
 */

console.log('[Browser Assistant] google-workspace-extractor.js loaded');

class GoogleWorkspaceExtractor {
  constructor() {
    this.type = this.detectType();
  }

  /**
   * Detect which Google Workspace app is being used
   * @returns {string|null} - 'docs', 'sheets', 'slides', or null
   */
  detectType() {
    const hostname = window.location.hostname;
    const pathname = window.location.pathname;

    if (!hostname.includes('docs.google.com')) {
      return null;
    }

    if (pathname.includes('/document/')) return 'docs';
    if (pathname.includes('/spreadsheets/')) return 'sheets';
    if (pathname.includes('/presentation/')) return 'slides';

    return null;
  }

  /**
   * Check if current page is a Google Workspace document
   * @returns {boolean}
   */
  isGoogleWorkspace() {
    return this.type !== null;
  }

  /**
   * Extract content from the current Google Workspace document
   * @returns {Promise<Object>}
   */
  async extractContent() {
    try {
      console.log(`[GoogleWorkspaceExtractor] Extracting content from Google ${this.type}`);

      let result;
      switch (this.type) {
        case 'docs':
          result = await this.extractDocsContent();
          break;
        case 'sheets':
          result = await this.extractSheetsContent();
          break;
        case 'slides':
          result = await this.extractSlidesContent();
          break;
        default:
          return {
            text: '',
            title: document.title || '',
            success: false,
            error: 'Unknown Google Workspace type'
          };
      }

      return {
        ...result,
        type: this.type,
        success: true
      };

    } catch (error) {
      console.error('[GoogleWorkspaceExtractor] Error extracting content:', error);
      return {
        text: '',
        title: document.title || '',
        type: this.type,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Extract content from Google Docs
   * Uses DOCS_modelChunk which contains the document data
   * @returns {Promise<Object>}
   */
  async extractDocsContent() {
    // Method 1: Try to get from window.DOCS_modelChunk
    if (window.DOCS_modelChunk && window.DOCS_modelChunk.chunk) {
      const text = this.extractTextFromModelChunk(window.DOCS_modelChunk);
      if (text) {
        console.log(`[GoogleWorkspaceExtractor] Extracted ${text.length} chars from DOCS_modelChunk (window)`);
        return {
          text: text,
          title: this.getDocumentTitle(),
          source: 'DOCS_modelChunk-window'
        };
      }
    }

    // Method 2: Parse from script tag
    const scripts = Array.from(document.querySelectorAll('script'));
    const modelScript = scripts.find(s => s.textContent.includes('DOCS_modelChunk = '));

    if (modelScript) {
      const scriptText = modelScript.textContent;
      const match = scriptText.match(/DOCS_modelChunk\s*=\s*({.*?});/s);

      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const text = this.extractTextFromModelChunk(data);

          if (text) {
            console.log(`[GoogleWorkspaceExtractor] Extracted ${text.length} chars from DOCS_modelChunk (script)`);
            return {
              text: text,
              title: this.getDocumentTitle(),
              source: 'DOCS_modelChunk-script'
            };
          }
        } catch (e) {
          console.error('[GoogleWorkspaceExtractor] Failed to parse DOCS_modelChunk:', e);
        }
      }
    }

    // Fallback: return error
    return {
      text: '',
      title: this.getDocumentTitle(),
      source: 'failed',
      error: 'Could not extract document content. DOCS_modelChunk not found.'
    };
  }

  /**
   * Extract text from DOCS_modelChunk data structure
   * @param {Object} modelChunk - The DOCS_modelChunk object
   * @returns {string} - Extracted text
   */
  extractTextFromModelChunk(modelChunk) {
    if (!modelChunk || !modelChunk.chunk || !Array.isArray(modelChunk.chunk)) {
      return '';
    }

    // The first chunk typically contains the document text in the 's' property
    const textChunks = modelChunk.chunk
      .filter(chunk => chunk.s && typeof chunk.s === 'string')
      .map(chunk => chunk.s);

    return textChunks.join('\n');
  }

  /**
   * Extract content from Google Sheets
   * @returns {Promise<Object>}
   */
  async extractSheetsContent() {
    const data = [];

    // Try to get sheet name
    const activeTab = document.querySelector('.docs-sheet-active-tab, .docs-sheet-tab-name');
    const sheetName = activeTab ? activeTab.innerText : 'Sheet';

    // Method 1: Get the entire grid container
    const gridContainer = document.querySelector('.docs-sheet-container, #docs-editor');
    if (gridContainer && gridContainer.innerText) {
      const text = gridContainer.innerText.trim();
      if (text) {
        console.log(`[GoogleWorkspaceExtractor] Extracted ${text.length} chars from Sheets`);
        return {
          text: `Google Sheet: ${sheetName}\n\n${text}`,
          title: this.getDocumentTitle(),
          sheetName: sheetName,
          source: 'grid-container'
        };
      }
    }

    // Method 2: Try to extract visible cells
    const cells = document.querySelectorAll('[role="gridcell"], .cell-input');
    console.log(`[GoogleWorkspaceExtractor] Found ${cells.length} cells`);

    if (cells.length > 0) {
      cells.forEach(cell => {
        const text = cell.innerText || cell.textContent || '';
        if (text.trim()) {
          data.push(text.trim());
        }
      });
    }

    const fullText = data.length > 0
      ? `Google Sheet: ${sheetName}\n\n${data.join('\n')}`
      : `Google Sheet: ${sheetName}\n\n(Sheet appears empty or content could not be extracted)`;

    console.log(`[GoogleWorkspaceExtractor] Extracted ${fullText.length} characters from Google Sheets`);

    return {
      text: fullText,
      title: this.getDocumentTitle(),
      sheetName: sheetName,
      cellCount: data.length,
      source: 'cells'
    };
  }

  /**
   * Extract content from Google Slides
   * @returns {Promise<Object>}
   */
  async extractSlidesContent() {
    const slides = [];

    // Method 1: Try the main viewer content
    const viewerContent = document.querySelector('.punch-viewer-content, #punch-viewer-container');
    if (viewerContent && viewerContent.innerText) {
      const text = viewerContent.innerText.trim();
      if (text) {
        console.log(`[GoogleWorkspaceExtractor] Extracted ${text.length} chars from Slides viewer`);
        return {
          text: text,
          title: this.getDocumentTitle(),
          source: 'viewer-content'
        };
      }
    }

    // Method 2: Get all slide thumbnails
    const slideThumbs = document.querySelectorAll('.punch-viewer-thumbnail, .punch-filmstrip-thumbnail');
    console.log(`[GoogleWorkspaceExtractor] Found ${slideThumbs.length} slides`);

    slideThumbs.forEach((thumb, index) => {
      const text = thumb.innerText || thumb.textContent || '';
      if (text.trim()) {
        slides.push(`Slide ${index + 1}:\n${text.trim()}`);
      }
    });

    // Try speaker notes if available
    const speakerNotes = document.querySelector('.punch-viewer-speakernotes-container, [role="textbox"]');
    if (speakerNotes && speakerNotes.innerText) {
      const notes = speakerNotes.innerText.trim();
      if (notes) {
        slides.push(`\nSpeaker Notes:\n${notes}`);
      }
    }

    const fullText = slides.length > 0
      ? slides.join('\n\n')
      : '(Presentation appears empty or content could not be extracted)';

    console.log(`[GoogleWorkspaceExtractor] Extracted ${fullText.length} characters from Google Slides`);

    return {
      text: fullText,
      title: this.getDocumentTitle(),
      slideCount: slideThumbs.length || 1,
      source: 'slides'
    };
  }

  /**
   * Get the document title
   * @returns {string}
   */
  getDocumentTitle() {
    // Try to get from the title input field
    const titleInput = document.querySelector('.docs-title-input, input[aria-label*="name"], input[aria-label*="title"]');
    if (titleInput && titleInput.value) {
      return titleInput.value;
    }

    // Try the title widget
    const titleWidget = document.querySelector('.docs-title-widget');
    if (titleWidget && titleWidget.innerText) {
      return titleWidget.innerText.trim();
    }

    // Fallback to document title
    const title = document.title || '';
    // Remove " - Google Docs/Sheets/Slides" suffix
    return title.replace(/\s*-\s*Google\s+(Docs|Sheets|Slides).*$/i, '').trim();
  }
}

// Export globally for content script
window.GoogleWorkspaceExtractor = GoogleWorkspaceExtractor;
