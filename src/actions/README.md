# Actions System Guide

This directory contains the actions system that allows the Browser Assistant to perform tasks on web pages (replying to emails, composing messages, writing in docs, etc.).

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Creating a New Action](#creating-a-new-action)
- [Creating a New Provider](#creating-a-new-provider)
- [Complete Examples](#complete-examples)
- [Intent Parsing](#intent-parsing)
- [Confirmation Overlay](#confirmation-overlay)
- [Best Practices](#best-practices)

## Architecture Overview

The actions system has three main components:

```
┌─────────────────────────────────────────────────┐
│           ActionRegistry                        │
│  - Discovers and registers all providers        │
│  - Matches user intent to actions               │
│  - Coordinates action execution                 │
└────────────┬────────────────────────────────────┘
             │
    ┌────────┴────────┐
    │  IntentParser   │
    │  - Parse user   │
    │    commands     │
    └─────────────────┘
             │
    ┌────────┴────────────────────────────────┐
    │         Provider (e.g., GmailProvider)  │
    │  - Detects if it can handle current page│
    │  - Exposes actions for this platform    │
    └────────┬────────────────────────────────┘
             │
    ┌────────┴────────────────────┐
    │  Actions (e.g., ReplyAction)│
    │  - Extract context          │
    │  - Generate content via LLM │
    │  - Execute the task         │
    └─────────────────────────────┘
```

### Key Classes

1. **BaseAction**: Abstract base class all actions extend
2. **Provider**: Platform-specific logic (Gmail, Google Docs, etc.)
3. **ActionRegistry**: Discovers and executes actions
4. **IntentParser**: Parses user commands
5. **ConfirmationOverlay**: Shows preview before executing

## Creating a New Action

Actions belong to a provider and perform specific tasks (reply to email, write text in doc, etc.).

### Step 1: Create Your Action Class

Create a file in `providers/[platform]/actions/YourAction.js`:

```javascript
/**
 * YourAction - [Brief description]
 *
 * [Detailed description of what this action does]
 */
class YourAction extends BaseAction {
  constructor(provider) {
    super('action_id', 'Display Name');
    this.provider = provider;  // Store reference to parent provider
    this.confirmationOverlay = new ConfirmationOverlay();
  }

  /**
   * Check if this action can execute in current context
   * @param {Object} context - Page context
   * @returns {Promise<boolean>}
   */
  async canExecute(context) {
    // Return true if action can be performed
    // Check page state, required elements, etc.
    return this.provider.canHandle() &&
           document.querySelector('.required-element') !== null;
  }

  /**
   * Extract context needed for this action
   * @returns {Promise<Object>}
   */
  async extractContext() {
    // Gather information from the page
    // This will be used to generate appropriate content

    return {
      // Context data specific to this action
      pageTitle: document.title,
      relevantData: this.provider.extractSomeData()
    };
  }

  /**
   * Generate content using LLM
   * @param {Object} context - Extracted context
   * @param {string} userInput - User's command
   * @returns {Promise<string>}
   */
  async generateContent(context, userInput) {
    // Build prompts for the LLM
    const systemPrompt = `You are helping the user with [task].

Context:
${JSON.stringify(context, null, 2)}

Generate appropriate content for this task.`;

    let userPrompt = 'Perform the task.';

    // Parse user input for specific instructions
    if (userInput) {
      const match = userInput.match(/saying (.+)/i);
      if (match) {
        userPrompt = `The user wants to ${match[1]}`;
      }
    }

    try {
      // Call LLM via background script
      const response = await chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to generate content');
      }

      return response.response.trim();

    } catch (error) {
      console.error('Error generating content:', error);
      throw new Error(`Could not generate content: ${error.message}`);
    }
  }

  /**
   * Execute the action with generated content
   * @param {string} content - Content to use (possibly edited by user)
   * @param {Object} options - Execution options
   * @returns {Promise<ActionResult>}
   */
  async execute(content, options = {}) {
    try {
      // Step 1: Prepare the page/UI
      const prepared = await this.provider.prepareForAction();
      if (!prepared) {
        return ActionResult.error('Failed to prepare page');
      }

      // Wait a moment for UI to be ready
      await new Promise(resolve => setTimeout(resolve, 300));

      // Step 2: Show confirmation to user
      const confirmed = await this.confirmationOverlay.show({
        title: 'Confirm Action',
        message: 'Review the content before applying:',
        content: content,
        confirmText: 'Apply',
        cancelText: 'Cancel',
        allowEdit: true  // Let user edit before applying
      });

      if (!confirmed.confirmed) {
        return ActionResult.error('Action cancelled by user');
      }

      // Use edited content if user made changes
      const finalContent = confirmed.editedContent || content;

      // Step 3: Insert content into the page
      const inserted = await this.provider.insertContent(finalContent);
      if (!inserted) {
        return ActionResult.error('Failed to insert content');
      }

      // Success!
      return ActionResult.success('Action completed successfully', {
        contentLength: finalContent.length
      });

    } catch (error) {
      console.error('Error executing action:', error);
      return ActionResult.error(`Failed to execute: ${error.message}`);
    }
  }

  /**
   * Get preview of what this action will do
   * @param {string} content - Generated content
   * @returns {Object}
   */
  getPreview(content) {
    return {
      action: this.displayName,
      content: content,
      warning: content.length > 1000 ? 'Content is quite long' : null
    };
  }

  /**
   * Validate content before execution
   * @param {string} content - Content to validate
   * @returns {Object}
   */
  validate(content) {
    const errors = [];

    if (!content || content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    if (content.length > 10000) {
      errors.push('Content is too long (max 10000 characters)');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}
```

### Step 2: Register in Provider

Add your action to the provider's `getActions()` method:

```javascript
class YourProvider {
  getActions() {
    return [
      new ExistingAction(this),
      new YourAction(this)  // Add here
    ];
  }
}
```

### Step 3: Add Intent Patterns

Update `IntentParser.js` to recognize commands for your action:

```javascript
const intentPatterns = [
  // Your new action
  {
    pattern: /do something|perform task/i,
    intent: {
      action: 'your_action',
      confidence: 0.8
    }
  },
  // Existing patterns...
];
```

## Creating a New Provider

Providers handle platform-specific logic (detecting Gmail vs Google Docs, finding the right UI elements, etc.).

### Step 1: Create Provider Directory

```
src/actions/providers/yourplatform/
├── YourPlatformProvider.js
└── actions/
    ├── ActionOne.js
    └── ActionTwo.js
```

### Step 2: Create Provider Class

Create `providers/yourplatform/YourPlatformProvider.js`:

```javascript
/**
 * YourPlatformProvider - Handle [platform name]
 *
 * Provides actions for [platform description]
 */
class YourPlatformProvider {
  constructor() {
    this.name = 'yourplatform';
    this.displayName = 'Your Platform';
  }

  /**
   * Check if this provider can handle the current page
   * @returns {boolean}
   */
  canHandle() {
    // Check URL, DOM elements, or other indicators
    return window.location.hostname.includes('yourplatform.com') &&
           document.querySelector('.platform-indicator') !== null;
  }

  /**
   * Get available actions for this provider
   * @returns {Array<BaseAction>}
   */
  getActions() {
    return [
      new ActionOne(this),
      new ActionTwo(this)
    ];
  }

  /**
   * Detect current context/state
   * @returns {Object}
   */
  detectContext() {
    return {
      isLoggedIn: this.isLoggedIn(),
      currentView: this.getCurrentView(),
      // Other state information
    };
  }

  // Helper methods for actions to use

  isLoggedIn() {
    return document.querySelector('.user-menu') !== null;
  }

  getCurrentView() {
    if (window.location.pathname.includes('/edit')) {
      return 'editing';
    }
    if (window.location.pathname.includes('/view')) {
      return 'viewing';
    }
    return 'unknown';
  }

  /**
   * Find a UI element with fallback selectors
   * @param {Array<string>} selectors - Try these in order
   * @returns {Element|null}
   */
  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * Wait for an element to appear
   * @param {string} selector
   * @param {number} timeout
   * @returns {Promise<Element>}
   */
  async waitForElement(selector, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const element = document.querySelector(selector);
      if (element) return element;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Element ${selector} not found`);
  }

  /**
   * Click an element safely
   * @param {Element} element
   * @returns {boolean}
   */
  clickElement(element) {
    if (!element) return false;

    try {
      element.click();
      return true;
    } catch (error) {
      console.error('Error clicking element:', error);
      return false;
    }
  }

  /**
   * Insert text into an element
   * @param {Element} element
   * @param {string} text
   * @returns {boolean}
   */
  insertText(element, text) {
    if (!element) return false;

    try {
      // Try multiple insertion methods

      // Method 1: Native value setter
      const nativeSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      ).set;
      nativeSetter.call(element, text);

      // Method 2: Dispatch input event to trigger listeners
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));

      return true;
    } catch (error) {
      console.error('Error inserting text:', error);
      return false;
    }
  }
}
```

### Step 3: Add to manifest.json

Add provider files to content_scripts:

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": [
    "src/actions/base/BaseAction.js",
    "src/actions/core/AccessibilityScanner.js",
    "src/actions/core/IntentParser.js",
    "src/actions/ui/ConfirmationOverlay.js",
    "src/actions/providers/yourplatform/YourPlatformProvider.js",
    "src/actions/providers/yourplatform/actions/ActionOne.js",
    "src/actions/providers/yourplatform/actions/ActionTwo.js",
    "src/actions/core/ActionRegistry.js",
    "src/actions/actions-loader.js"
  ]
}]
```

### Step 4: Register in ActionRegistry

The `ActionRegistry` will automatically discover your provider if you instantiate it:

```javascript
// In actions-loader.js or similar
const yourPlatformProvider = new YourPlatformProvider();
```

## Complete Examples

### Example 1: Simple Action

A simple action that inserts pre-generated content:

```javascript
/**
 * QuickReplyAction - Send a quick acknowledgment reply
 */
class QuickReplyAction extends BaseAction {
  constructor(provider) {
    super('quick_reply', 'Quick Reply');
    this.provider = provider;
    this.confirmationOverlay = new ConfirmationOverlay();
  }

  async canExecute(context) {
    return this.provider.canHandle() && this.provider.isInMessageView();
  }

  async extractContext() {
    const messageData = await this.provider.extractMessageData();

    return {
      senderName: messageData.from,
      subject: messageData.subject
    };
  }

  async generateContent(context, userInput) {
    // Quick replies don't need LLM - use templates
    const templates = {
      'thanks': `Thank you for reaching out! I'll review this and get back to you soon.`,
      'received': `I've received your message and will respond shortly.`,
      'reviewing': `Thanks for sending this. I'm reviewing it now and will follow up.`
    };

    // Check user input for template keyword
    const template = userInput?.toLowerCase() || 'received';

    return templates[template] || templates['received'];
  }

  async execute(content, options = {}) {
    try {
      await this.provider.openReplyArea();
      await new Promise(r => setTimeout(r, 300));

      const confirmed = await this.confirmationOverlay.show({
        title: 'Send Quick Reply',
        message: 'This will send the following message:',
        content: content,
        confirmText: 'Send',
        cancelText: 'Cancel',
        allowEdit: true
      });

      if (!confirmed.confirmed) {
        return ActionResult.error('Cancelled');
      }

      const finalContent = confirmed.editedContent || content;
      await this.provider.insertReply(finalContent);

      return ActionResult.success('Reply sent successfully');

    } catch (error) {
      return ActionResult.error(`Failed: ${error.message}`);
    }
  }
}
```

### Example 2: Complex Action with Multiple Steps

An action that performs several steps in sequence:

```javascript
/**
 * ForwardWithSummaryAction - Forward email with AI summary
 */
class ForwardWithSummaryAction extends BaseAction {
  constructor(provider) {
    super('forward_summary', 'Forward with Summary');
    this.provider = provider;
    this.confirmationOverlay = new ConfirmationOverlay();
  }

  async canExecute(context) {
    return this.provider.canHandle() && this.provider.isInEmailView();
  }

  async extractContext() {
    const emailData = await this.provider.extractEmailData();

    return {
      subject: emailData.subject,
      from: emailData.from,
      body: emailData.body,
      date: emailData.date,
      hasAttachments: emailData.attachments?.length > 0
    };
  }

  async generateContent(context, userInput) {
    // Extract recipient email from user input
    const recipientMatch = userInput?.match(/to\s+([\w.]+@[\w.]+)/i);
    const recipient = recipientMatch ? recipientMatch[1] : null;

    const systemPrompt = `Summarize this email in 2-3 concise sentences.
Focus on key points and action items.

Original Email:
From: ${context.from}
Subject: ${context.subject}
Date: ${context.date}

${context.body}`;

    const response = await chrome.runtime.sendMessage({
      action: 'chat',
      systemPrompt: systemPrompt,
      userPrompt: 'Create a brief summary of this email.'
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    const summary = response.response.trim();

    // Build forward message
    let forwardMessage = `Summary:\n${summary}\n\n`;
    forwardMessage += `--- Forwarded Message ---\n`;
    forwardMessage += `From: ${context.from}\n`;
    forwardMessage += `Subject: ${context.subject}\n`;
    forwardMessage += `Date: ${context.date}\n\n`;
    forwardMessage += context.body;

    // Store recipient for later use
    this.recipient = recipient;

    return forwardMessage;
  }

  async execute(content, options = {}) {
    try {
      // Step 1: Open forward compose
      const opened = await this.provider.openForwardCompose();
      if (!opened) {
        return ActionResult.error('Failed to open forward compose');
      }

      await new Promise(r => setTimeout(r, 500));

      // Step 2: Insert recipient if we extracted one
      if (this.recipient) {
        const recipientField = await this.provider.waitForElement('.to-field');
        await this.provider.insertText(recipientField, this.recipient);
      }

      // Step 3: Show confirmation
      const confirmed = await this.confirmationOverlay.show({
        title: 'Forward Email with Summary',
        message: 'Review the forwarding message:',
        content: content,
        confirmText: 'Insert',
        cancelText: 'Cancel',
        allowEdit: true
      });

      if (!confirmed.confirmed) {
        return ActionResult.error('Cancelled by user');
      }

      // Step 4: Insert the message
      const finalContent = confirmed.editedContent || content;
      const bodyField = await this.provider.waitForElement('.compose-body');
      await this.provider.insertText(bodyField, finalContent);

      return ActionResult.success('Forward message prepared', {
        recipient: this.recipient,
        summaryLength: content.split('\n')[1]?.length
      });

    } catch (error) {
      return ActionResult.error(`Failed: ${error.message}`);
    }
  }

  validate(content) {
    const errors = [];

    if (!content || content.length === 0) {
      errors.push('Content cannot be empty');
    }

    if (!content.includes('Summary:')) {
      errors.push('Summary section is missing');
    }

    if (!content.includes('Forwarded Message')) {
      errors.push('Original message is missing');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }
}
```

## Intent Parsing

The IntentParser identifies user intent from natural language commands.

### Adding Intent Patterns

Edit `IntentParser.js` to add patterns for your action:

```javascript
const intentPatterns = [
  // Reply action
  {
    pattern: /^reply|respond|answer/i,
    intent: {
      action: 'reply',
      confidence: 0.9
    }
  },

  // Your new action
  {
    pattern: /^do something|perform task/i,
    intent: {
      action: 'your_action',
      confidence: 0.8
    }
  },

  // Multiple patterns for same action
  {
    pattern: /^quick reply|fast response/i,
    intent: {
      action: 'quick_reply',
      confidence: 0.85
    }
  }
];
```

### Pattern Matching Tips

- **Use `^` to match start** of command for higher confidence
- **List most specific patterns first** (checked in order)
- **Set appropriate confidence** (0.0-1.0)
- **Test with variations** of how users might phrase it

### Extracting Parameters

```javascript
{
  pattern: /^reply saying (.+)/i,
  intent: {
    action: 'reply',
    confidence: 0.95,
    extractParams: (match) => ({
      message: match[1]
    })
  }
}
```

## Confirmation Overlay

The ConfirmationOverlay shows a preview before executing actions.

### Basic Usage

```javascript
const confirmed = await this.confirmationOverlay.show({
  title: 'Confirm Action',
  message: 'This will do something. Continue?',
  content: generatedContent,
  confirmText: 'Proceed',
  cancelText: 'Cancel',
  allowEdit: false
});

if (confirmed.confirmed) {
  // User confirmed, proceed
}
```

### With Editing

```javascript
const confirmed = await this.confirmationOverlay.show({
  title: 'Review Content',
  message: 'Edit if needed, then click Apply:',
  content: generatedContent,
  confirmText: 'Apply',
  cancelText: 'Cancel',
  allowEdit: true  // Enable editing
});

if (confirmed.confirmed) {
  const finalContent = confirmed.editedContent || content;
  // Use edited content
}
```

### Custom Styling

```javascript
const confirmed = await this.confirmationOverlay.show({
  title: 'Warning',
  message: 'This action cannot be undone!',
  content: content,
  confirmText: 'I Understand',
  cancelText: 'Go Back',
  allowEdit: false,
  type: 'warning'  // Changes color scheme
});
```

## Best Practices

### Action Design

1. **Single Responsibility**: Each action should do one thing well
2. **Clear Naming**: Use descriptive IDs and display names
3. **Helpful Previews**: Always show what will happen before executing
4. **Error Handling**: Catch and report errors clearly
5. **Validation**: Validate inputs before execution

### Provider Design

1. **Robust Detection**: Check multiple indicators (URL + DOM elements)
2. **Helper Methods**: Provide utilities for common operations
3. **Flexible Selectors**: Support multiple versions of the platform
4. **Async Operations**: Use async/await for all DOM interactions
5. **Error Recovery**: Handle when elements aren't found gracefully

### User Experience

1. **Fast Detection**: Keep `canExecute()` lightweight
2. **Clear Feedback**: Show progress and results
3. **Allow Editing**: Let users review and modify generated content
4. **Graceful Failures**: Don't crash, show helpful error messages
5. **Keyboard Support**: Allow confirmation with Enter/Escape

### Security

1. **No Eval**: Never use `eval()` or `Function()` with user input
2. **Validate Content**: Check for malicious patterns before inserting
3. **Sandbox Execution**: Don't expose sensitive APIs to page context
4. **User Confirmation**: Always require confirmation before sensitive actions

## Testing Your Action

### Manual Testing

1. **Load the extension** in developer mode
2. **Navigate to target page** (Gmail, Google Docs, etc.)
3. **Open DevTools** console
4. **Type command** in chat input
5. **Verify** action executes correctly

### Debug Checklist

- [ ] Provider detects page correctly (`canHandle()` returns true)
- [ ] Action appears in available actions
- [ ] Intent parser recognizes command
- [ ] Context extraction works
- [ ] LLM generates appropriate content
- [ ] Confirmation overlay shows correctly
- [ ] Content inserts into correct location
- [ ] No errors in console
- [ ] Action completes successfully

### Common Issues

**Action not found:**
- Check provider is instantiated in actions-loader.js
- Verify action is returned in provider's `getActions()`
- Check intent pattern matches your command

**Content not inserting:**
- Verify selectors are correct (use DevTools)
- Check if page has loaded completely
- Try waiting longer before insertion
- Check if element is readonly/disabled

**LLM not generating:**
- Verify chat message sends successfully
- Check system/user prompts are well-formed
- Look for API errors in background console

## Existing Actions

### Gmail Provider
- **ReplyAction**: Reply to emails with AI-generated responses
- **ComposeAction**: Compose new emails

### Google Docs Provider
- **WriteTextAction**: Insert AI-generated text into documents

### Fallback Provider
- **GenericAction**: Generic action for unsupported platforms

Study these for reference implementations!
