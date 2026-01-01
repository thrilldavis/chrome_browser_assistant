/**
 * GmailProvider - Gmail-specific action provider
 *
 * Handles actions specific to Gmail using accessibility-based selectors
 * that are robust against UI changes.
 */
class GmailProvider {
  constructor() {
    this.scanner = new AccessibilityScanner();
    this.name = 'gmail';
    this.displayName = 'Gmail';
  }

  /**
   * Check if current page is Gmail
   * @returns {boolean}
   */
  canHandle() {
    return window.location.hostname.includes('mail.google.com');
  }

  /**
   * Get current Gmail context
   * @returns {Promise<Object>}
   */
  async getContext() {
    return {
      provider: this.name,
      inEmailView: this.isInEmailView(),
      inComposeView: this.isInComposeView(),
      emailData: this.isInEmailView() ? await this.extractEmailData() : null
    };
  }

  /**
   * Check if currently viewing an email
   * @returns {boolean}
   */
  isInEmailView() {
    // Gmail uses role="main" for the email viewing area
    const mainRegion = document.querySelector('[role="main"]');
    if (!mainRegion) return false;

    // Check for email-specific indicators
    const hasSubject = mainRegion.querySelector('[data-subject]') !== null ||
                      mainRegion.querySelector('h2') !== null;
    const hasEmailBody = mainRegion.querySelector('[role="region"]') !== null ||
                        mainRegion.querySelector('[data-message-id]') !== null;

    return hasSubject || hasEmailBody;
  }

  /**
   * Check if currently in compose view
   * @returns {boolean}
   */
  isInComposeView() {
    // Look for compose window
    const composeWindow = document.querySelector('[role="dialog"]');
    if (!composeWindow) return false;

    // Check if it's a compose dialog (has To, Subject, Body fields)
    const hasToField = composeWindow.querySelector('[name="to"]') !== null ||
                      composeWindow.querySelector('[aria-label*="To" i]') !== null;

    return hasToField;
  }

  /**
   * Extract data from current email
   * @returns {Promise<Object>}
   */
  async extractEmailData() {
    const emailData = {
      subject: '',
      from: '',
      to: '',
      body: '',
      date: ''
    };

    try {
      const mainRegion = document.querySelector('[role="main"]');
      if (!mainRegion) return emailData;

      // Extract subject
      const subjectEl = mainRegion.querySelector('h2') ||
                       mainRegion.querySelector('[data-subject]');
      if (subjectEl) {
        emailData.subject = subjectEl.textContent.trim();
      }

      // Extract sender
      const fromEl = mainRegion.querySelector('[email]') ||
                    mainRegion.querySelector('[data-hovercard-id]');
      if (fromEl) {
        emailData.from = fromEl.getAttribute('email') ||
                        fromEl.textContent.trim();
      }

      // Extract body - look for the main content area
      const bodyEl = mainRegion.querySelector('[data-message-id]') ||
                    mainRegion.querySelector('[role="region"]') ||
                    mainRegion.querySelector('.a3s');
      if (bodyEl) {
        emailData.body = bodyEl.textContent.trim();
      }

      // Extract date
      const dateEl = mainRegion.querySelector('[data-tooltip*=":"]');
      if (dateEl) {
        emailData.date = dateEl.getAttribute('data-tooltip') ||
                        dateEl.textContent.trim();
      }

    } catch (error) {
      console.error('Error extracting email data:', error);
    }

    return emailData;
  }

  /**
   * Find and click the reply button
   * @returns {Promise<boolean>}
   */
  async openReplyCompose() {
    try {
      // Look for Reply button using accessibility
      const replyButton = this.scanner.findByLabel('Reply', 'button') ||
                         document.querySelector('[aria-label="Reply" i]') ||
                         document.querySelector('[data-tooltip="Reply" i]');

      if (!replyButton) {
        console.error('Reply button not found');
        return false;
      }

      replyButton.click();

      // Wait for compose area to appear
      await this.waitForElement('[role="textbox"][aria-label*="Message" i]', 3000);

      return true;
    } catch (error) {
      console.error('Error opening reply compose:', error);
      return false;
    }
  }

  /**
   * Fill reply compose area with content
   * @param {string} content - Reply content
   * @returns {Promise<boolean>}
   */
  async fillReplyContent(content) {
    try {
      // Find the compose textbox
      const composeBox = document.querySelector('[role="textbox"][aria-label*="Message" i]') ||
                        document.querySelector('[contenteditable="true"][aria-label*="Body" i]') ||
                        document.querySelector('.editable[role="textbox"]');

      if (!composeBox) {
        console.error('Compose box not found');
        return false;
      }

      // Set content
      composeBox.focus();
      composeBox.innerHTML = content.replace(/\n/g, '<br>');

      // Trigger input event to ensure Gmail recognizes the change
      composeBox.dispatchEvent(new Event('input', { bubbles: true }));

      return true;
    } catch (error) {
      console.error('Error filling reply content:', error);
      return false;
    }
  }

  /**
   * Open compose window
   * @returns {Promise<boolean>}
   */
  async openCompose() {
    try {
      // Find Compose button
      const composeButton = this.scanner.findByLabel('Compose', 'button') ||
                           document.querySelector('[aria-label="Compose" i]') ||
                           document.querySelector('[role="button"][gh="cm"]');

      if (!composeButton) {
        console.error('Compose button not found');
        return false;
      }

      composeButton.click();

      // Wait for compose dialog to appear
      await this.waitForElement('[role="dialog"]', 3000);

      return true;
    } catch (error) {
      console.error('Error opening compose:', error);
      return false;
    }
  }

  /**
   * Fill compose fields
   * @param {Object} fields - { to, subject, body }
   * @returns {Promise<boolean>}
   */
  async fillComposeFields(fields) {
    try {
      const { to, subject, body } = fields;

      // Find compose dialog
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return false;

      // Fill To field
      if (to) {
        const toField = dialog.querySelector('[name="to"]') ||
                       dialog.querySelector('[aria-label*="To" i]');
        if (toField) {
          toField.value = to;
          toField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      // Fill Subject field
      if (subject) {
        const subjectField = dialog.querySelector('[name="subjectbox"]') ||
                            dialog.querySelector('[aria-label*="Subject" i]');
        if (subjectField) {
          subjectField.value = subject;
          subjectField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      // Fill Body field
      if (body) {
        const bodyField = dialog.querySelector('[role="textbox"][aria-label*="Message" i]') ||
                         dialog.querySelector('[contenteditable="true"]');
        if (bodyField) {
          bodyField.focus();
          bodyField.innerHTML = body.replace(/\n/g, '<br>');
          bodyField.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      return true;
    } catch (error) {
      console.error('Error filling compose fields:', error);
      return false;
    }
  }

  /**
   * Wait for element to appear
   * @param {string} selector
   * @param {number} timeout
   * @returns {Promise<Element>}
   */
  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        return resolve(element);
      }

      const observer = new MutationObserver((mutations) => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

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
