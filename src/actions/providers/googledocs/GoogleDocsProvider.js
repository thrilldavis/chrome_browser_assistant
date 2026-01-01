/**
 * GoogleDocsProvider - Provider for Google Docs and Google Sheets
 *
 * Google Docs/Sheets use canvas-based rendering instead of standard DOM elements.
 * Text exists only as pixels on a canvas, not as editable HTML elements.
 * This means we can't use standard accessibility attributes or DOM manipulation.
 *
 * Instead, we simulate keyboard input to interact with these applications.
 */
console.log('[Browser Assistant] GoogleDocsProvider.js loaded');

class GoogleDocsProvider {
  constructor() {
    this.name = 'googledocs';
    this.displayName = 'Google Docs/Sheets';
  }

  /**
   * Check if this provider can handle the current page
   * @returns {boolean}
   */
  canHandle() {
    const hostname = window.location.hostname;
    return hostname.includes('docs.google.com');
  }

  /**
   * Get page context
   * @returns {Promise<Object>}
   */
  async getContext() {
    const isDoc = window.location.pathname.includes('/document/');
    const isSheet = window.location.pathname.includes('/spreadsheets/');

    // Extract document text using the GoogleWorkspaceExtractor
    let documentText = '';
    let documentTitle = document.title;

    // Create extractor instance (GoogleWorkspaceExtractor is loaded in content.js)
    if (typeof GoogleWorkspaceExtractor !== 'undefined') {
      const workspaceExtractor = new GoogleWorkspaceExtractor();

      if (workspaceExtractor.isGoogleWorkspace()) {
        const extracted = await workspaceExtractor.extractContent();
        if (extracted && extracted.success) {
          documentText = extracted.text || '';
          documentTitle = extracted.title || document.title;
        }
      }
    }

    return {
      provider: this.name,
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      documentTitle: documentTitle,
      documentText: documentText,
      documentType: isDoc ? 'document' : isSheet ? 'spreadsheet' : 'unknown',
      editorElement: this.findEditorElement()
    };
  }

  /**
   * Find the main editor element
   * @returns {Element|null}
   */
  findEditorElement() {
    // Google Docs uses .kix-appview-editor as the main container
    const docsEditor = document.querySelector('.kix-appview-editor');
    if (docsEditor) return docsEditor;

    // Google Sheets uses a different structure
    const sheetsEditor = document.querySelector('.grid-container');
    if (sheetsEditor) return sheetsEditor;

    return null;
  }

  /**
   * Note: This provider currently doesn't directly insert text into Google Docs/Sheets.
   *
   * Due to Chrome's clipboard security restrictions, we cannot programmatically write
   * to the clipboard when the document doesn't have focus (which happens when the user
   * interacts with the extension side panel).
   *
   * The WriteTextAction handles copying text to clipboard and instructing the user
   * to paste manually with Cmd+V/Ctrl+V.
   *
   * This provider structure is maintained to enable future enhancements such as:
   * - Rich text formatting (bold, italic, lists)
   * - Smart cell navigation in Google Sheets
   * - Structured data pasting across multiple cells
   * - Context-aware content generation based on document type
   *
   * Attempted approaches that failed due to Chrome security model:
   * - document.execCommand('insertText') - returns false
   * - Clipboard API with keyboard simulation - requires document focus
   * - File menu refocusing tricks - still loses focus
   * - Character-by-character keyboard events - requires document focus
   */

  /**
   * Get LLM response for a prompt
   * @param {string} systemPrompt - System prompt
   * @param {string} userPrompt - User prompt
   * @returns {Promise<string>} LLM response
   */
  async getLLMResponse(systemPrompt, userPrompt) {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to get LLM response');
      }

      return response.response;
    } catch (error) {
      console.error('Error getting LLM response:', error);
      throw error;
    }
  }
}
