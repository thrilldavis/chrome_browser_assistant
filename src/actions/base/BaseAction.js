/**
 * BaseAction - Base class for all actions
 *
 * Provides common functionality for actions that can be executed
 * on web pages through the extension.
 */
console.log('[Browser Assistant] BaseAction.js loaded');

class BaseAction {
  constructor(id, displayName) {
    this.id = id;
    this.displayName = displayName;
  }

  /**
   * Check if this action can be executed in the current context
   * @param {Object} context - Page context information
   * @returns {Promise<boolean>}
   */
  async canExecute(context) {
    throw new Error('canExecute() must be implemented by subclass');
  }

  /**
   * Extract context needed for this action
   * @returns {Promise<Object>}
   */
  async extractContext() {
    throw new Error('extractContext() must be implemented by subclass');
  }

  /**
   * Generate content for this action using LLM
   * @param {Object} context - Extracted context
   * @param {string} userInput - User's command/input
   * @returns {Promise<string>}
   */
  async generateContent(context, userInput) {
    throw new Error('generateContent() must be implemented by subclass');
  }

  /**
   * Execute the action with the given content
   * @param {string} content - Generated or approved content
   * @param {Object} options - Execution options
   * @returns {Promise<ActionResult>}
   */
  async execute(content, options = {}) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * Preview what this action will do
   * @param {string} content - Content to preview
   * @returns {Object} Preview information
   */
  getPreview(content) {
    return {
      action: this.displayName,
      content: content,
      warning: null
    };
  }

  /**
   * Validate that the action can be safely executed
   * @param {string} content - Content to validate
   * @returns {Object} Validation result
   */
  validate(content) {
    return {
      valid: true,
      errors: []
    };
  }
}

/**
 * ActionResult - Standard result format for action execution
 */
class ActionResult {
  constructor(success, message, data = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static success(message, data = null) {
    return new ActionResult(true, message, data);
  }

  static error(message, data = null) {
    return new ActionResult(false, message, data);
  }
}
