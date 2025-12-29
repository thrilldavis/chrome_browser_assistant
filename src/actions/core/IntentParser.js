/**
 * IntentParser - Parses user commands to determine intended actions
 *
 * Uses pattern matching and LLM assistance to understand what action
 * the user wants to perform based on their natural language input.
 */
class IntentParser {
  constructor() {
    // Action patterns for quick pattern matching
    this.patterns = {
      reply: [
        /\breply\s+(to\s+)?(this\s+)?email/i,
        /\brespond\s+(to\s+)?(this\s+)?email/i,
        /\banswer\s+(this\s+)?email/i,
        /\bwrite\s+a?\s*reply/i
      ],
      compose: [
        /\bcompose\s+(an?\s+)?email/i,
        /\bwrite\s+(an?\s+)?email/i,
        /\bdraft\s+(an?\s+)?email/i,
        /\bsend\s+(an?\s+)?email/i,
        /\bemail\s+/i
      ],
      forward: [
        /^forward\s+(this\s+)?email/i,
        /^fwd\s+(this\s+)?email/i
      ],
      write: [
        // Pattern: commands about writing in documents/sheets
        /\b(write|add|insert|put|create|generate|make)\b.*\b(document|doc|sheet|google\s+doc|google\s+sheet)\b/i,
        /\b(document|doc|sheet|google\s+doc|google\s+sheet)\b.*\b(write|add|insert|put|create|generate|make)\b/i,
        /\bin\s+(the\s+)?(document|doc|sheet)\b/i
      ]
    };
  }

  /**
   * Parse user input to determine intent
   * @param {string} userInput - User's command
   * @param {Object} pageContext - Current page context
   * @returns {Promise<Object>} Parsed intent
   */
  async parse(userInput, pageContext = {}) {
    const trimmedInput = userInput.trim();

    // Try pattern matching first (fast)
    const patternMatch = this.matchPatterns(trimmedInput, pageContext);
    if (patternMatch) {
      return {
        action: patternMatch.action,
        confidence: patternMatch.confidence,
        parameters: this.extractParameters(trimmedInput, patternMatch.action),
        rawInput: userInput,
        method: 'pattern'
      };
    }

    // If it looks like an action command but doesn't match patterns, use generic
    if (this.looksLikeActionCommand(trimmedInput)) {
      return {
        action: 'generic',
        confidence: 0.7,
        parameters: {},
        rawInput: userInput,
        method: 'keyword-fallback'
      };
    }

    // Fall back to LLM parsing for complex or ambiguous commands
    return await this.parseWithLLM(userInput, pageContext);
  }

  /**
   * Match input against known patterns
   * @param {string} input - User input
   * @param {Object} pageContext - Current page context
   * @returns {Object|null}
   */
  matchPatterns(input, pageContext = {}) {
    for (const [action, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(input)) {
          return {
            action: action,
            confidence: 0.9,
            pattern: pattern
          };
        }
      }
    }
    return null;
  }

  /**
   * Extract parameters from user input
   * @param {string} input - User input
   * @param {string} action - Detected action
   * @returns {Object}
   */
  extractParameters(input, action) {
    const params = {};

    switch (action) {
      case 'compose':
        // Extract recipient: "compose email to john@example.com"
        const toMatch = input.match(/to\s+([^\s]+@[^\s]+)/i);
        if (toMatch) params.to = toMatch[1];

        // Extract subject: "compose email about project update"
        const aboutMatch = input.match(/about\s+(.+)/i);
        if (aboutMatch) params.subject = aboutMatch[1];

        // Extract message hint: "saying we need to reschedule"
        const sayingMatch = input.match(/saying\s+(.+)/i);
        if (sayingMatch) params.message = sayingMatch[1];
        break;

      case 'reply':
        // Extract reply instructions: "reply saying I'll be out of office"
        const replyMatch = input.match(/(?:saying|that)\s+(.+)/i);
        if (replyMatch) params.message = replyMatch[1];
        break;

      case 'forward':
        // Extract forward recipient
        const fwdMatch = input.match(/to\s+([^\s]+@[^\s]+)/i);
        if (fwdMatch) params.to = fwdMatch[1];
        break;
    }

    return params;
  }

  /**
   * Parse intent using LLM for complex commands
   * @param {string} userInput - User input
   * @param {Object} pageContext - Page context
   * @returns {Promise<Object>}
   */
  async parseWithLLM(userInput, pageContext) {
    try {
      const systemPrompt = `You are an intent parser for a browser assistant.
Analyze the user's command and determine what action they want to perform.

Available actions:
- reply: Reply to an email
- compose: Compose a new email
- forward: Forward an email
- unknown: Cannot determine intent

Respond with JSON only:
{
  "action": "action_name",
  "confidence": 0.0-1.0,
  "parameters": {
    "to": "email@example.com",
    "subject": "subject line",
    "message": "message hint"
  },
  "reasoning": "brief explanation"
}`;

      const userPrompt = `Page context: ${JSON.stringify(pageContext, null, 2)}

User command: "${userInput}"

Parse this command and return JSON.`;

      // Use the background API to call the LLM
      const response = await chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to parse intent');
      }

      // Parse JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        rawInput: userInput,
        method: 'llm'
      };

    } catch (error) {
      console.error('LLM intent parsing failed:', error);
      return {
        action: 'unknown',
        confidence: 0,
        parameters: {},
        rawInput: userInput,
        method: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Check if input looks like an action command
   * @param {string} input - User input
   * @returns {boolean}
   */
  looksLikeActionCommand(input) {
    const actionKeywords = [
      // Email actions
      'reply', 'respond', 'compose', 'draft', 'send', 'forward', 'fwd', 'email', 'message',

      // Generic page actions
      'write', 'type', 'fill', 'enter', 'input',
      'click', 'press', 'tap', 'select',
      'open', 'close', 'show', 'hide',
      'scroll', 'navigate', 'go to',
      'submit', 'save', 'delete', 'remove',
      'add', 'create', 'insert',
      'search', 'find', 'look for'
    ];

    const lowerInput = input.toLowerCase();
    return actionKeywords.some(keyword => lowerInput.includes(keyword));
  }
}
