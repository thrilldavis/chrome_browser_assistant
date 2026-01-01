/**
 * SummarizeThreadAction - Summarize Gmail email threads
 *
 * Extracts the email thread content and generates a concise summary using LLM.
 */
class SummarizeThreadAction extends BaseAction {
  constructor(gmailProvider) {
    super('gmail_summarize', 'Summarize Thread');
    this.provider = gmailProvider;
    // This action can be a quick action button - it doesn't need user input
    this.showAsQuickAction = true;
  }

  /**
   * Check if summarize action can be executed
   * @param {Object} context - Page context
   * @returns {Promise<boolean>}
   */
  async canExecute(context) {
    // Available on all Gmail pages
    return this.provider.canHandle();
  }

  /**
   * Extract context for summarization
   * @returns {Promise<Object>}
   */
  async extractContext() {
    const gmailContext = await this.provider.getContext();

    return {
      subject: gmailContext.emailData?.subject || '',
      from: gmailContext.emailData?.from || '',
      threadContent: gmailContext.emailData?.body || '',
      inEmailView: gmailContext.inEmailView
    };
  }

  /**
   * Run the summarize action
   * @param {string} userCommand - Optional user command (not needed for quick action)
   * @param {Object} parameters - Optional parameters
   * @returns {Promise<ActionResult>}
   */
  async run(userCommand = '', parameters = {}) {
    console.log('[SummarizeThreadAction] Running summarize thread action');

    try {
      // Extract context
      const context = await this.extractContext();

      if (!context.inEmailView) {
        return ActionResult.error('Please open an email thread to summarize.');
      }

      // Create prompt for LLM to generate summary
      const systemPrompt = `You are an email summarization assistant. Your task is to read email threads and provide concise, actionable summaries.

Focus on:
- Main topic/subject of the thread
- Key points and decisions made
- Action items or requests
- Important context or details

Keep the summary brief (3-5 bullet points) but informative.`;

      const userPrompt = `Please summarize this email thread:

Subject: ${context.subject}
From: ${context.from}

Thread content:
${context.threadContent}`;

      // Get LLM response
      console.log('[SummarizeThreadAction] Requesting summary from LLM...');
      const summary = await this.provider.getLLMResponse(systemPrompt, userPrompt);

      // Return summary to be displayed in chat
      const displayMessage = `**Email Thread Summary**\n\nSubject: ${context.subject}\n\n${summary}`;

      return ActionResult.success(displayMessage, { summary });

    } catch (error) {
      console.error('[SummarizeThreadAction] Error:', error);
      return ActionResult.error(`Failed to summarize thread: ${error.message}`);
    }
  }

  /**
   * Get intent patterns for this action
   * @returns {Array<string>}
   */
  getIntentPatterns() {
    return [
      'summarize',
      'summarize thread',
      'summarize email',
      'summarize this',
      'give me a summary',
      'tldr',
      'what is this about'
    ];
  }
}
