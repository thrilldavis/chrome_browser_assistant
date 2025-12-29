/**
 * ActionRegistry - Central registry for all actions
 *
 * Manages action providers and coordinates action execution across different sites.
 */
class ActionRegistry {
  constructor() {
    this.providers = new Map();
    this.actions = new Map();
    this.intentParser = new IntentParser();
    this.initialized = false;
  }

  /**
   * Initialize the registry and register providers
   */
  async initialize() {
    if (this.initialized) return;

    console.log('Initializing ActionRegistry...');

    // Register Gmail provider
    if (window.location.hostname.includes('mail.google.com')) {
      await this.registerGmailProvider();
    }

    // Register Google Docs provider
    if (window.location.hostname.includes('docs.google.com')) {
      await this.registerGoogleDocsProvider();
    }

    // Always register fallback provider for generic actions
    await this.registerFallbackProvider();

    this.initialized = true;
    console.log('ActionRegistry initialized');
  }

  /**
   * Register Gmail provider and its actions
   */
  async registerGmailProvider() {
    const gmailProvider = new GmailProvider();

    if (gmailProvider.canHandle()) {
      console.log('Registering Gmail provider');

      this.providers.set('gmail', gmailProvider);

      // Register Gmail actions
      const replyAction = new ReplyAction(gmailProvider);
      const composeAction = new ComposeAction(gmailProvider);

      this.actions.set('reply', replyAction);
      this.actions.set('compose', composeAction);

      console.log('Gmail provider and actions registered');
    }
  }

  /**
   * Register Google Docs provider and its actions
   */
  async registerGoogleDocsProvider() {
    const googleDocsProvider = new GoogleDocsProvider();

    if (googleDocsProvider.canHandle()) {
      console.log('Registering Google Docs provider');

      this.providers.set('googledocs', googleDocsProvider);

      // Register Google Docs actions
      const writeTextAction = new WriteTextAction(googleDocsProvider);

      this.actions.set('write', writeTextAction);

      console.log('Google Docs provider and actions registered');
    }
  }

  /**
   * Register fallback provider for generic actions
   */
  async registerFallbackProvider() {
    console.log('Registering Fallback provider');

    const fallbackProvider = new FallbackProvider();
    this.providers.set('fallback', fallbackProvider);

    // Register generic action
    const genericAction = new GenericAction(fallbackProvider);
    this.actions.set('generic', genericAction);

    console.log('Fallback provider and generic action registered');
  }

  /**
   * Check if input looks like an action command
   * @param {string} userInput
   * @returns {boolean}
   */
  isActionCommand(userInput) {
    return this.intentParser.looksLikeActionCommand(userInput);
  }

  /**
   * Handle user input and execute appropriate action
   * @param {string} userInput - User's command
   * @returns {Promise<ActionResult>}
   */
  async handleCommand(userInput) {
    try {
      // Ensure initialized
      await this.initialize();

      // Parse intent
      console.log('Parsing intent for:', userInput);
      const intent = await this.intentParser.parse(userInput, {
        url: window.location.href,
        hostname: window.location.hostname
      });

      console.log('Parsed intent:', intent);

      // Try to find a specific action handler first
      let action = this.actions.get(intent.action);

      // If no specific handler or low confidence, try fallback
      if (!action || (intent.action === 'unknown') || (intent.confidence < 0.5)) {
        console.log('No specific action found, using generic fallback');
        action = this.actions.get('generic');

        if (!action) {
          return ActionResult.error('Could not understand the command. Try being more specific.');
        }

        // Use generic action with full user input
        console.log('Executing generic action');
        const result = await action.run(userInput);
        return result;
      }

      // Check if specific action can be executed
      const canExecute = await action.canExecute();
      if (!canExecute) {
        // Fall back to generic action
        console.log('Specific action cannot execute, trying generic fallback');
        const genericAction = this.actions.get('generic');
        if (genericAction) {
          const result = await genericAction.run(userInput);
          return result;
        }
        return ActionResult.error(`Cannot execute "${intent.action}" in the current context.`);
      }

      // Execute the specific action
      console.log('Executing specific action:', intent.action);
      const result = await action.run(userInput, intent.parameters);

      return result;

    } catch (error) {
      console.error('Error handling command:', error);
      return ActionResult.error(`Failed to execute command: ${error.message}`);
    }
  }

  /**
   * Get available actions for current page
   * @returns {Promise<Array>}
   */
  async getAvailableActions() {
    await this.initialize();

    const available = [];

    for (const [name, action] of this.actions.entries()) {
      const canExecute = await action.canExecute();
      if (canExecute) {
        available.push({
          id: action.id,
          name: action.displayName,
          key: name
        });
      }
    }

    return available;
  }
}

// Create global instance
window.browserAssistantActionRegistry = window.browserAssistantActionRegistry || new ActionRegistry();
