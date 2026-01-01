/**
 * SummarizePageAction - Summarize web pages for unknown sites
 *
 * Extracts the page content and generates a concise summary using LLM.
 * This is the fallback summarize action for sites without specialized providers.
 */
console.log('[Browser Assistant] SummarizePageAction.js loaded');

class SummarizePageAction extends BaseAction {
  constructor(fallbackProvider) {
    super('fallback_summarize', 'Summarize Page');
    this.provider = fallbackProvider;
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
    console.log('[SummarizePageAction] Running summarize page action');

    try {
      // Extract context
      const context = await this.extractContext();

      // Get page content - try to get meaningful text
      let pageContent = '';

      // Try to get main content area first
      const mainContent = document.querySelector('main, article, [role="main"]');
      if (mainContent) {
        pageContent = mainContent.innerText;
      } else {
        // Fall back to body text
        pageContent = document.body.innerText;
      }

      if (!pageContent || pageContent.trim().length === 0) {
        return ActionResult.error('Page appears to be empty. Nothing to summarize.');
      }

      // Trim to reasonable length (LLMs have limits)
      const maxLength = 50000;
      if (pageContent.length > maxLength) {
        pageContent = pageContent.substring(0, maxLength) + '...\n[Content truncated]';
      }

      // Create prompt for LLM to generate summary
      const systemPrompt = `You are a web page summarization assistant. Your task is to read web pages and provide concise, informative summaries.

Focus on:
- Main topic or purpose of the page
- Key points and important information
- Relevant facts, data, or findings
- Actionable information or recommendations

Keep the summary brief (3-5 bullet points) but capture the essential information.`;

      const userPrompt = `Please summarize this web page:

URL: ${window.location.href}
Title: ${document.title}

Content:
${pageContent}`;

      // Get LLM response
      console.log('[SummarizePageAction] Requesting summary from LLM...');
      const summary = await this.provider.getLLMResponse(systemPrompt, userPrompt);

      // Return summary to be displayed in chat
      const displayMessage = `**Page Summary: ${document.title}**\n\n${summary}`;

      return ActionResult.success(displayMessage, { summary });

    } catch (error) {
      console.error('[SummarizePageAction] Error:', error);
      return ActionResult.error(`Failed to summarize page: ${error.message}`);
    }
  }

  /**
   * Get intent patterns for this action
   * @returns {Array<string>}
   */
  getIntentPatterns() {
    return [
      'summarize',
      'summarize page',
      'summarize this page',
      'summarize this',
      'give me a summary',
      'tldr',
      'what is this about',
      'what does this say'
    ];
  }
}
