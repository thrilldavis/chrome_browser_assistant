/**
 * FallbackProvider - LLM-powered provider for unknown sites
 *
 * Uses AI to understand page structure and execute actions on sites
 * where we don't have a specific provider. This enables the extension
 * to work on ANY website.
 */
console.log('[Browser Assistant] FallbackProvider.js loaded');

class FallbackProvider {
  constructor() {
    this.scanner = new AccessibilityScanner();
    this.name = 'fallback';
    this.displayName = 'Dynamic (AI-Powered)';
  }

  /**
   * Fallback provider can handle any page
   * @returns {boolean}
   */
  canHandle() {
    return true; // Always available as fallback
  }

  /**
   * Get page context with discovered elements
   * @returns {Promise<Object>}
   */
  async getContext() {
    const elements = this.scanner.scanPage();

    // Simplify for LLM consumption
    const simplifiedElements = {
      buttons: elements.buttons.map(b => ({
        label: b.label,
        ariaLabel: b.ariaLabel
      })).slice(0, 20), // Limit to avoid token bloat

      inputs: elements.inputs.map(i => ({
        label: i.label,
        type: i.type,
        placeholder: i.placeholder
      })).slice(0, 20),

      links: elements.links.map(l => ({
        label: l.label,
        href: l.href
      })).slice(0, 10)
    };

    return {
      provider: this.name,
      url: window.location.href,
      hostname: window.location.hostname,
      title: document.title,
      elements: simplifiedElements
    };
  }

  /**
   * Use LLM to understand what action to take
   * @param {string} userCommand - What the user wants to do
   * @returns {Promise<Object>} Action plan from LLM
   */
  async planAction(userCommand) {
    const context = await this.getContext();

    const systemPrompt = `You are a browser automation assistant. Analyze the page and determine how to execute the user's command.

Page Context:
- URL: ${context.url}
- Title: ${context.title}
- Available buttons: ${JSON.stringify(context.elements.buttons)}
- Available inputs: ${JSON.stringify(context.elements.inputs)}
- Available links: ${JSON.stringify(context.elements.links)}

Your task: Determine the steps needed to execute the user's command.

Respond with JSON ONLY:
{
  "feasible": true/false,
  "reasoning": "explanation of your analysis",
  "steps": [
    {
      "action": "click|fill|navigate",
      "target": "button/input label or link text",
      "value": "text to fill (if action is fill)",
      "description": "what this step does"
    }
  ],
  "warnings": ["any warnings or limitations"]
}

Action types:
- "click": Click a button or link
- "fill": Fill an input field
- "navigate": Navigate to a URL

If the command cannot be executed, set feasible: false and explain why.`;

    const userPrompt = `User command: "${userCommand}"

Analyze the page and create a step-by-step plan to execute this command.`;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt: systemPrompt,
        userPrompt: userPrompt
      });

      if (!response.success) {
        throw new Error(response.error || 'Failed to plan action');
      }

      // Parse JSON from response
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('LLM did not return valid JSON');
      }

      const plan = JSON.parse(jsonMatch[0]);
      console.log('Action plan:', plan);

      return plan;
    } catch (error) {
      console.error('Error planning action:', error);
      return {
        feasible: false,
        reasoning: `Failed to analyze page: ${error.message}`,
        steps: [],
        warnings: ['Could not generate action plan']
      };
    }
  }

  /**
   * Execute a planned action
   * @param {Object} plan - Action plan from planAction()
   * @returns {Promise<ActionResult>}
   */
  async executeAction(plan) {
    if (!plan.feasible) {
      return ActionResult.error(plan.reasoning);
    }

    const results = [];

    for (const step of plan.steps) {
      try {
        console.log(`Executing step: ${step.description}`);

        switch (step.action) {
          case 'click':
            await this.executeClick(step.target);
            results.push(`✓ ${step.description}`);
            break;

          case 'fill':
            await this.executeFill(step.target, step.value);
            results.push(`✓ ${step.description}`);
            break;

          case 'navigate':
            await this.executeNavigate(step.target);
            results.push(`✓ ${step.description}`);
            break;

          default:
            results.push(`⚠ Unknown action: ${step.action}`);
        }

        // Small delay between steps
        await this.delay(500);

      } catch (error) {
        console.error(`Error executing step:`, error);
        results.push(`✗ Failed: ${step.description} - ${error.message}`);
      }
    }

    return ActionResult.success(results.join('\n'));
  }

  /**
   * Execute a click action
   * @param {string} target - Button/link label to click
   */
  async executeClick(target) {
    // Try to find the element
    const element = this.scanner.findByLabel(target);

    if (!element) {
      throw new Error(`Could not find element with label: ${target}`);
    }

    // Click it
    element.click();
    console.log(`Clicked element:`, target);
  }

  /**
   * Execute a fill action
   * @param {string} target - Input label
   * @param {string} value - Value to fill
   */
  async executeFill(target, value) {
    const element = this.scanner.findByLabel(target, 'input');

    if (!element) {
      throw new Error(`Could not find input with label: ${target}`);
    }

    // Fill the input
    element.focus();

    if (element.getAttribute('contenteditable') === 'true') {
      element.innerHTML = value;
    } else {
      element.value = value;
    }

    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    console.log(`Filled input "${target}" with:`, value);
  }

  /**
   * Execute a navigate action
   * @param {string} url - URL to navigate to
   */
  async executeNavigate(url) {
    window.location.href = url;
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to wait
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
