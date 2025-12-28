/**
 * ComposeAction - Compose new Gmail emails
 *
 * Opens compose window, generates email content using LLM, and fills
 * the compose fields (To, Subject, Body).
 */
class ComposeAction extends BaseAction {
  constructor(gmailProvider) {
    super('gmail_compose', 'Compose Email');
    this.provider = gmailProvider;
    this.confirmationOverlay = new ConfirmationOverlay();
  }

  /**
   * Check if compose action can be executed
   * @param {Object} context - Page context
   * @returns {Promise<boolean>}
   */
  async canExecute(context) {
    // Can compose from anywhere in Gmail
    return this.provider.canHandle();
  }

  /**
   * Extract context for compose
   * @param {Object} parameters - Intent parameters (to, subject, message)
   * @returns {Promise<Object>}
   */
  async extractContext(parameters = {}) {
    return {
      to: parameters.to || '',
      subject: parameters.subject || '',
      messageHint: parameters.message || ''
    };
  }

  /**
   * Generate email content using LLM
   * @param {Object} context - Compose context
   * @param {string} userInput - User's full command
   * @returns {Promise<Object>} { to, subject, body }
   */
  async generateContent(context, userInput) {
    const systemPrompt = `You are composing a professional email. Be clear, concise, and appropriate for the context.

Generate a JSON response with these fields:
{
  "to": "email@example.com",
  "subject": "Email subject",
  "body": "Email body content"
}

Rules:
- If recipient is not provided, leave "to" empty
- If subject is not clear, generate an appropriate one
- Keep the body professional and concise
- Do not include a signature - Gmail adds that automatically
- Format: plain text, use paragraphs appropriately`;

    let userPrompt = `User wants to compose an email.`;

    // Add any context we have
    if (context.to) {
      userPrompt += `\nRecipient: ${context.to}`;
    }
    if (context.subject) {
      userPrompt += `\nSubject: ${context.subject}`;
    }
    if (context.messageHint) {
      userPrompt += `\nMessage intent: ${context.messageHint}`;
    }

    // Add the full user command for more context
    userPrompt += `\n\nFull user command: "${userInput}"`;

    userPrompt += `\n\nGenerate the email as JSON.`;

    try {
      // Use background API to call LLM
      const response = await chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate email');
      }

      // Parse JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON');
      }

      const emailData = JSON.parse(jsonMatch[0]);

      // Merge with context (prefer context values if provided)
      return {
        to: context.to || emailData.to || '',
        subject: context.subject || emailData.subject || '',
        body: emailData.body || ''
      };

    } catch (error) {
      console.error('Error generating email:', error);
      throw new Error(`Could not generate email: ${error.message}`);
    }
  }

  /**
   * Execute the compose action
   * @param {Object} emailData - { to, subject, body }
   * @param {Object} options - Execution options
   * @returns {Promise<ActionResult>}
   */
  async execute(emailData, options = {}) {
    try {
      // Step 1: Open compose window
      const opened = await this.provider.openCompose();
      if (!opened) {
        return ActionResult.error('Failed to open compose window');
      }

      // Step 2: Fill fields
      const filled = await this.provider.fillComposeFields(emailData);
      if (!filled) {
        return ActionResult.error('Failed to fill compose fields');
      }

      // Step 3: Auto-send if requested (default: no)
      if (options.autoSend) {
        // TODO: Implement send functionality
        // For now, we just fill the compose area
      }

      return ActionResult.success('Email drafted successfully! Review and send when ready.');
    } catch (error) {
      console.error('Error executing compose action:', error);
      return ActionResult.error(`Failed to compose email: ${error.message}`);
    }
  }

  /**
   * Full workflow: parse, generate, confirm, execute
   * @param {string} userInput - User's command
   * @param {Object} parameters - Parsed parameters from intent
   * @returns {Promise<ActionResult>}
   */
  async run(userInput, parameters = {}) {
    try {
      // Step 1: Check if we can execute
      const canRun = await this.canExecute();
      if (!canRun) {
        return ActionResult.error('Cannot compose - not in Gmail');
      }

      // Step 2: Extract context from parameters
      const context = await this.extractContext(parameters);

      // Step 3: Generate email content
      const emailData = await this.generateContent(context, userInput);

      // Step 4: Format content for preview
      const previewContent = `To: ${emailData.to || '(not specified)'}
Subject: ${emailData.subject || '(no subject)'}

${emailData.body}`;

      // Step 5: Show confirmation overlay
      const confirmation = await this.confirmationOverlay.show({
        action: 'Compose Email',
        content: previewContent,
        editable: true,
        target: 'New Gmail compose window',
        warning: 'The compose window will be filled but not sent automatically. You can review and edit before sending.'
      });

      // Step 6: If approved, parse edited content and execute
      if (confirmation.approved) {
        // Parse the edited content back into fields
        const editedEmailData = this.parseEditedContent(confirmation.content);
        return await this.execute(editedEmailData);
      } else {
        return ActionResult.error('Compose cancelled by user');
      }

    } catch (error) {
      console.error('Error in compose workflow:', error);
      return ActionResult.error(`Compose failed: ${error.message}`);
    }
  }

  /**
   * Parse edited preview content back into email fields
   * @param {string} content - Edited content from confirmation
   * @returns {Object} { to, subject, body }
   */
  parseEditedContent(content) {
    const lines = content.split('\n');
    const emailData = { to: '', subject: '', body: '' };

    let bodyStartIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('To:')) {
        emailData.to = line.substring(3).trim().replace('(not specified)', '');
        bodyStartIndex = Math.max(bodyStartIndex, i + 1);
      } else if (line.startsWith('Subject:')) {
        emailData.subject = line.substring(8).trim().replace('(no subject)', '');
        bodyStartIndex = Math.max(bodyStartIndex, i + 1);
      }
    }

    // Everything after the headers is the body
    emailData.body = lines.slice(bodyStartIndex).join('\n').trim();

    return emailData;
  }

  /**
   * Get preview of what this action will do
   * @param {Object} emailData
   * @returns {Object}
   */
  getPreview(emailData) {
    return {
      action: this.displayName,
      content: `To: ${emailData.to}\nSubject: ${emailData.subject}\n\n${emailData.body}`,
      warning: 'The email will be drafted in Gmail but not sent automatically. You can review and edit before sending.'
    };
  }
}
