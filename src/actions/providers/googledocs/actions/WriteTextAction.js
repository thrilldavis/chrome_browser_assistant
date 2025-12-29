/**
 * WriteTextAction - Write text into Google Docs/Sheets
 *
 * Uses keyboard simulation to type text into Google Docs/Sheets documents.
 */
console.log('[Browser Assistant] WriteTextAction.js loaded');

class WriteTextAction extends BaseAction {
  constructor(googleDocsProvider) {
    super('write_text', 'Write Text');
    this.provider = googleDocsProvider;
    this.confirmationOverlay = new ConfirmationOverlay();
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
   * Run the action
   * @param {string} userCommand - User's command
   * @param {Object} parameters - Parsed parameters from intent
   * @returns {Promise<ActionResult>}
   */
  async run(userCommand, parameters = {}) {
    console.log('[WriteTextAction] Starting write text action');

    try {
      const context = await this.extractContext();

      // Check if we can find the editor
      if (!context.editorElement) {
        return ActionResult.error('Could not find Google Docs/Sheets editor on this page.');
      }

      // Generate or extract the text to write
      let textToWrite = parameters.text || '';

      // If no text provided, ask LLM to generate based on command
      if (!textToWrite) {
        console.log('[WriteTextAction] No text in parameters, asking LLM to generate...');

        let systemPrompt;
        if (context.documentType === 'spreadsheet') {
          systemPrompt = `You are helping write content in a Google Sheet.
The user wants to: "${userCommand}"

Generate the appropriate content for this request.
- If the content is tabular data (list, table, structured data), format it as tab-separated values (TSV) so it pastes into multiple cells correctly
- Each row should be on a new line
- Each cell should be separated by a tab character
- Example: "Name\tAge\tCity\nAlice\t30\tNew York\nBob\t25\tSan Francisco"
- If the content is just plain text (not tabular), output it normally

Output ONLY the content that should be written, with no additional formatting or explanation.`;
        } else {
          systemPrompt = `You are helping write content in a Google Doc.
The user wants to: "${userCommand}"

Generate the content as HTML that will be copied to clipboard and pasted into Google Docs.
Google Docs will convert the HTML to rich formatting automatically.

Use these HTML tags for formatting:
- <h1>, <h2>, <h3> for headings
- <strong> or <b> for bold text
- <em> or <i> for italic text
- <ul><li> for bullet lists
- <ol><li> for numbered lists
- <p> for paragraphs
- <br> for line breaks

Example output:
<h1>Main Title</h1>
<p>This is a paragraph with <strong>bold text</strong> and <em>italic text</em>.</p>
<ul>
<li>First bullet point</li>
<li>Second bullet point</li>
</ul>

Output ONLY the HTML content, no explanation or surrounding text.`;
        }

        const userPrompt = `Generate content for: "${userCommand}"`;

        const response = await chrome.runtime.sendMessage({
          action: 'chat',
          systemPrompt: systemPrompt,
          userPrompt: userPrompt
        });

        if (!response.success) {
          return ActionResult.error('Failed to generate text: ' + response.error);
        }

        textToWrite = response.response;
      }

      // Show confirmation with manual paste instruction
      const confirmation = await this.confirmationOverlay.show({
        action: `Write Text in Google ${context.documentType}`,
        content: textToWrite,
        editable: true,
        target: context.title,
        warning: 'Click "Copy & Close" below, then paste into your document with Cmd+V (Mac) or Ctrl+V (Windows).',
        buttonText: 'Copy & Close'
      });

      if (!confirmation.approved) {
        return ActionResult.error('Action cancelled by user');
      }

      const finalText = confirmation.content || textToWrite;

      // Write to clipboard with HTML support for rich formatting
      try {
        // For Google Docs, write both HTML and plain text to clipboard
        // Google Docs will use the HTML version for rich formatting
        if (context.documentType === 'document') {
          const blob = new Blob([finalText], { type: 'text/html' });
          const plainBlob = new Blob([finalText.replace(/<[^>]*>/g, '')], { type: 'text/plain' });

          await navigator.clipboard.write([
            new ClipboardItem({
              'text/html': blob,
              'text/plain': plainBlob
            })
          ]);
          console.log('[WriteTextAction] HTML copied to clipboard for rich formatting');
        } else {
          // For Sheets, use plain text (TSV)
          await navigator.clipboard.writeText(finalText);
          console.log('[WriteTextAction] Text copied to clipboard');
        }

        return ActionResult.success(`Content copied to clipboard! Press Cmd+V (Mac) or Ctrl+V (Windows) to paste it into your document.`);
      } catch (clipboardError) {
        console.error('[WriteTextAction] Clipboard write failed:', clipboardError);
        return ActionResult.error(`Could not copy to clipboard. Please manually copy the text from the confirmation dialog.`);
      }

    } catch (error) {
      console.error('[WriteTextAction] Error:', error);
      return ActionResult.error(`Failed to write text: ${error.message}`);
    }
  }
}
