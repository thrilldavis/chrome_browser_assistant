/**
 * ReplyAction - Reply to Gmail emails
 *
 * Extracts email context, generates a reply using LLM, and fills
 * the Gmail reply compose area.
 */
class ReplyAction extends BaseAction {
  constructor(gmailProvider) {
    super('gmail_reply', 'Reply to Email');
    this.provider = gmailProvider;
    this.confirmationOverlay = new ConfirmationOverlay();
    // This action can be a quick action button - it doesn't need user input
    this.showAsQuickAction = true;
  }

  /**
   * Check if reply action can be executed
   * @param {Object} context - Page context
   * @returns {Promise<boolean>}
   */
  async canExecute(context) {
    // Can only reply if we're viewing an email
    return this.provider.canHandle() && this.provider.isInEmailView();
  }

  /**
   * Extract context for reply
   * @returns {Promise<Object>}
   */
  async extractContext() {
    const emailData = await this.provider.extractEmailData();

    return {
      emailSubject: emailData.subject,
      emailFrom: emailData.from,
      emailBody: emailData.body,
      emailDate: emailData.date
    };
  }

  /**
   * Generate reply content using LLM
   * @param {Object} context - Email context
   * @param {string} userInput - User's command/hint
   * @returns {Promise<string>}
   */
  async generateContent(context, userInput) {
    const systemPrompt = `You are writing an email reply. Be professional, concise, and helpful.

Original Email Details:
From: ${context.emailFrom}
Subject: ${context.emailSubject}
Date: ${context.emailDate}

Original Email Body:
${context.emailBody}

Write a professional reply. Do not include a greeting if the user didn't request one. Do not include a signature - Gmail will add that automatically.`;

    let userPrompt = 'Write an appropriate reply to this email.';

    // Check if user provided specific instructions
    if (userInput) {
      const messageMatch = userInput.match(/(?:saying|that)\s+(.+)/i);
      if (messageMatch) {
        userPrompt = `Write a reply ${messageMatch[1]}`;
      }
    }

    try {
      // Use background API to call LLM
      const response = await chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate reply');
      }

      return response.response.trim();
    } catch (error) {
      console.error('Error generating reply:', error);
      throw new Error(`Could not generate reply: ${error.message}`);
    }
  }

  /**
   * Execute the reply action
   * @param {string} content - Reply content (possibly edited by user)
   * @param {Object} options - Execution options
   * @returns {Promise<ActionResult>}
   */
  async execute(content, options = {}) {
    try {
      // Step 1: Open reply compose
      const opened = await this.provider.openReplyCompose();
      if (!opened) {
        return ActionResult.error('Failed to open reply compose area');
      }

      // Step 2: Fill content
      const filled = await this.provider.fillReplyContent(content);
      if (!filled) {
        return ActionResult.error('Failed to fill reply content');
      }

      // Step 3: Auto-send if requested (default: no)
      if (options.autoSend) {
        // TODO: Implement send functionality
        // For now, we just fill the compose area
      }

      return ActionResult.success('Reply drafted successfully! Review and send when ready.');
    } catch (error) {
      console.error('Error executing reply action:', error);
      return ActionResult.error(`Failed to execute reply: ${error.message}`);
    }
  }

  /**
   * Full workflow: extract, generate, confirm, execute
   * @param {string} userInput - User's command
   * @returns {Promise<ActionResult>}
   */
  async run(userInput) {
    try {
      // Step 1: Check if we can execute
      const canRun = await this.canExecute();
      if (!canRun) {
        return ActionResult.error('Cannot reply - not viewing an email');
      }

      // Step 2: Extract context
      const context = await this.extractContext();
      if (!context.emailBody) {
        return ActionResult.error('Could not extract email content');
      }

      // Step 3: Generate reply
      const generatedContent = await this.generateContent(context, userInput);

      // Step 4: Show confirmation overlay
      const confirmation = await this.confirmationOverlay.show({
        action: 'Reply to Email',
        content: generatedContent,
        editable: true,
        target: `Email from ${context.emailFrom}`,
        warning: 'Review the reply before sending. The compose area will be filled but not sent automatically.'
      });

      // Step 5: If approved, execute
      if (confirmation.approved) {
        return await this.execute(confirmation.content);
      } else {
        return ActionResult.error('Reply cancelled by user');
      }

    } catch (error) {
      console.error('Error in reply workflow:', error);
      return ActionResult.error(`Reply failed: ${error.message}`);
    }
  }

  /**
   * Get preview of what this action will do
   * @param {string} content
   * @returns {Object}
   */
  getPreview(content) {
    return {
      action: this.displayName,
      content: content,
      warning: 'The reply will be drafted in Gmail but not sent automatically. You can review and edit before sending.'
    };
  }
}
