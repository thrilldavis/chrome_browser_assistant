/**
 * SummarizeAction - Summarize Google Docs content
 *
 * Extracts the document content and generates a concise summary using LLM.
 */
console.log('[Browser Assistant] SummarizeAction.js loaded');

class SummarizeAction extends BaseAction {
  constructor(googleDocsProvider) {
    super('googledocs_summarize', 'Summarize Document');
    this.provider = googleDocsProvider;
    // This action can be a quick action button - it doesn't need user input
    this.showAsQuickAction = true;
  }

  /**
   * Check if action can execute
   * @returns {Promise<boolean>}
   */
  async canExecute() {
    return this.provider.canHandle();
  }

  /**
   * Extract context from the page
   * @returns {Promise<Object>}
   */
  async extractContext() {
    return await this.provider.getContext();
  }

  /**
   * Run the summarize action
   * @param {string} userCommand - Optional user command (not needed for quick action)
   * @param {Object} parameters - Optional parameters
   * @returns {Promise<ActionResult>}
   */
  async run(userCommand = '', parameters = {}) {
    console.log('[SummarizeAction] Running summarize document action');

    try {
      // Extract context
      const context = await this.extractContext();

      if (!context.documentText || context.documentText.trim().length === 0) {
        return ActionResult.error('Document appears to be empty. Nothing to summarize.');
      }

      // Create prompt for LLM to generate summary
      const systemPrompt = `You are a document summarization assistant. Your task is to read documents and provide concise, informative summaries.

Focus on:
- Main topic/purpose of the document
- Key points and arguments
- Important data, facts, or findings
- Conclusions or recommendations

Keep the summary brief (3-5 bullet points) but capture the essential information.`;

      const userPrompt = `Please summarize this document:

Title: ${context.documentTitle || 'Untitled Document'}

Content:
${context.documentText}`;

      // Get LLM response
      console.log('[SummarizeAction] Requesting summary from LLM...');
      const summary = await this.provider.getLLMResponse(systemPrompt, userPrompt);

      // Return summary to be displayed in chat
      const displayMessage = `**Document Summary: ${context.documentTitle || 'Untitled'}**\n\n${summary}`;

      return ActionResult.success(displayMessage, { summary });

    } catch (error) {
      console.error('[SummarizeAction] Error:', error);
      return ActionResult.error(`Failed to summarize document: ${error.message}`);
    }
  }

  /**
   * Get intent patterns for this action
   * @returns {Array<string>}
   */
  getIntentPatterns() {
    return [
      'summarize',
      'summarize document',
      'summarize doc',
      'summarize this',
      'give me a summary',
      'tldr',
      'what is this about',
      'what does this say'
    ];
  }
}
