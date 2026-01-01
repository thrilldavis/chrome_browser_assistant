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
- "fill": Fill an input field, type text, or write into any text area/contenteditable element
- "navigate": Navigate to a URL

IMPORTANT: Use "fill" for ANY text entry action (typing, writing, entering text, etc.)

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
    console.log('[FallbackProvider] executeAction called with plan:', plan);

    if (!plan.feasible) {
      console.log('[FallbackProvider] Plan not feasible, returning error');
      return ActionResult.error(plan.reasoning);
    }

    const results = [];

    console.log(`[FallbackProvider] Executing ${plan.steps.length} steps...`);

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      console.log(`[FallbackProvider] Step ${i + 1}/${plan.steps.length}:`, step);

      try {
        console.log(`[FallbackProvider] Executing step: ${step.description}`);

        switch (step.action) {
          case 'click':
            console.log(`[FallbackProvider] Calling executeClick with target: ${step.target}`);
            await this.executeClick(step.target);
            results.push(`✓ ${step.description}`);
            console.log(`[FallbackProvider] Click successful`);
            break;

          case 'fill':
          case 'type':  // Treat 'type' as alias for 'fill'
            console.log(`[FallbackProvider] Calling executeFill with target: ${step.target}, value: ${step.value}`);
            await this.executeFill(step.target, step.value);
            results.push(`✓ ${step.description}`);
            console.log(`[FallbackProvider] Fill successful`);
            break;

          case 'navigate':
            console.log(`[FallbackProvider] Calling executeNavigate with target: ${step.target}`);
            await this.executeNavigate(step.target);
            results.push(`✓ ${step.description}`);
            console.log(`[FallbackProvider] Navigate successful`);
            break;

          default:
            console.warn(`[FallbackProvider] Unknown action type: ${step.action}`);
            results.push(`⚠ Unknown action: ${step.action}`);
        }

        // Small delay between steps
        console.log(`[FallbackProvider] Waiting 500ms before next step...`);
        await this.delay(500);

      } catch (error) {
        console.error(`[FallbackProvider] Error executing step:`, error);
        console.error(`[FallbackProvider] Error stack:`, error.stack);
        results.push(`✗ Failed: ${step.description} - ${error.message}`);
      }
    }

    console.log('[FallbackProvider] All steps executed. Results:', results);
    return ActionResult.success(results.join('\n'));
  }

  /**
   * Execute a click action
   * @param {string} target - Button/link label to click
   */
  async executeClick(target) {
    console.log(`[FallbackProvider] executeClick called with target: "${target}"`);

    // Try to find the element by label
    let element = this.scanner.findByLabel(target);
    console.log(`[FallbackProvider] findByLabel result:`, element);

    // If not found and it's a generic document/editor reference, find main editor area
    if (!element) {
      const genericTargets = ['document', 'page', 'editor', 'text', 'content', 'body', 'main'];
      const normalizedTarget = target.toLowerCase().trim();
      const isGenericTarget = genericTargets.some(gt => {
        if (normalizedTarget === gt) return true;
        if (normalizedTarget.startsWith(gt + '-') || normalizedTarget.startsWith(gt + '_')) return true;
        if (normalizedTarget.includes(' ' + gt) || normalizedTarget.includes(gt + ' ')) return true;
        return false;
      });

      if (isGenericTarget) {
        console.log(`[FallbackProvider] Target "${target}" is generic, looking for main clickable area...`);

        // Find large visible contenteditable or textbox elements
        const clickableCandidates = [
          ...document.querySelectorAll('[role="textbox"]'),
          ...document.querySelectorAll('[contenteditable="true"]')
        ];

        for (const candidate of clickableCandidates) {
          if (!this.scanner.isVisible(candidate)) continue;

          const rect = candidate.getBoundingClientRect();
          if (rect.width > 100 && rect.height > 50) {
            element = candidate;
            console.log(`[FallbackProvider] Found clickable element:`, element);
            break;
          }
        }
      }
    }

    if (!element) {
      console.error(`[FallbackProvider] Could not find element with label: ${target}`);
      throw new Error(`Could not find element with label: ${target}`);
    }

    // Click it with proper event dispatching
    // Some apps (like Gmail) require full mouse events, not just .click()
    console.log(`[FallbackProvider] Clicking element with full mouse events...`);

    // Focus the element first
    element.focus();

    // Dispatch mousedown event
    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    // Dispatch mouseup event
    element.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    // Dispatch click event
    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window
    }));

    // Also call the native click for good measure
    element.click();

    console.log(`[FallbackProvider] Clicked element:`, target);
  }

  /**
   * Execute a fill action
   * @param {string} target - Input label
   * @param {string} value - Value to fill
   */
  async executeFill(target, value) {
    console.log(`[FallbackProvider] executeFill called with target: "${target}", value: "${value}"`);

    let element = null;

    // Generic targets that indicate main editor (skip label search for these)
    const genericTargets = ['document', 'page', 'editor', 'text', 'content', 'body', 'main'];
    const normalizedTarget = target.toLowerCase().trim();
    const isGenericTarget = genericTargets.some(gt => {
      // Match if target is exactly the generic term
      if (normalizedTarget === gt) return true;
      // Match if target starts with the term (e.g., "document-content", "editor-area")
      if (normalizedTarget.startsWith(gt + '-') || normalizedTarget.startsWith(gt + '_')) return true;
      // Match if target contains the term with space (e.g., "google document")
      if (normalizedTarget.includes(' ' + gt) || normalizedTarget.includes(gt + ' ')) return true;
      return false;
    });

    if (isGenericTarget) {
      console.log(`[FallbackProvider] Target "${target}" is generic, looking for main text editor...`);

      const inputCandidates = [
        ...document.querySelectorAll('[role="textbox"]'),
        ...document.querySelectorAll('[contenteditable="true"]'),
        ...document.querySelectorAll('textarea')
      ];

      console.log(`[FallbackProvider] Found ${inputCandidates.length} potential text input elements`);

      // Filter to visible, actual text editors (not buttons/badges)
      for (const candidate of inputCandidates) {
        if (!this.scanner.isVisible(candidate)) continue;

        // Skip if it's a button, link, or badge
        const role = candidate.getAttribute('role');
        const tagName = candidate.tagName.toLowerCase();
        if (role === 'button' || role === 'link' || tagName === 'button' || tagName === 'a') {
          console.log(`[FallbackProvider] Skipping button/link element:`, candidate);
          continue;
        }

        // Skip small elements (likely badges or indicators, not editors)
        const rect = candidate.getBoundingClientRect();
        if (rect.width < 100 || rect.height < 50) {
          console.log(`[FallbackProvider] Skipping small element (${rect.width}x${rect.height}):`, candidate);
          continue;
        }

        element = candidate;
        console.log(`[FallbackProvider] Found suitable text editor:`, {
          tagName: element.tagName,
          role: element.getAttribute('role'),
          contenteditable: element.getAttribute('contenteditable'),
          size: `${rect.width}x${rect.height}`,
          id: element.id,
          className: element.className
        });
        break;
      }
    } else {
      // For specific targets, try label-based search
      console.log(`[FallbackProvider] Target "${target}" is specific, trying label search...`);
      element = this.scanner.findByLabel(target, 'input');
      console.log(`[FallbackProvider] findByLabel with type 'input' result:`, element);

      // If not found, try without type restriction
      if (!element) {
        console.log(`[FallbackProvider] Trying to find element without type restriction...`);
        element = this.scanner.findByLabel(target);
        console.log(`[FallbackProvider] findByLabel without type result:`, element);
      }
    }

    if (!element) {
      console.warn(`[FallbackProvider] Could not find element for target: ${target}, copying to clipboard as fallback`);

      // Copy to clipboard as fallback
      try {
        await navigator.clipboard.writeText(value);
        console.log(`[FallbackProvider] Value copied to clipboard as fallback`);
        throw new Error(`Could not find input field, but content has been copied to clipboard. Press Cmd+V (Mac) or Ctrl+V (Windows) to paste.`);
      } catch (clipboardError) {
        console.error(`[FallbackProvider] Clipboard fallback also failed:`, clipboardError);
        throw new Error(`Could not find input with label: ${target}`);
      }
    }

    console.log(`[FallbackProvider] Found element:`, {
      tagName: element.tagName,
      type: element.type,
      contenteditable: element.getAttribute('contenteditable'),
      role: element.getAttribute('role'),
      className: element.className,
      id: element.id
    });

    // Fill the input
    element.focus();
    console.log(`[FallbackProvider] Element focused`);

    if (element.getAttribute('contenteditable') === 'true' || element.getAttribute('role') === 'textbox') {
      console.log(`[FallbackProvider] Element is contenteditable/textbox, setting innerHTML`);
      element.innerHTML = value.replace(/\n/g, '<br>');
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.tagName === 'TEXTAREA') {
      console.log(`[FallbackProvider] Element is textarea, setting value`);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (element.tagName === 'INPUT') {
      console.log(`[FallbackProvider] Element is input, setting value`);
      element.value = value;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
      console.warn(`[FallbackProvider] Unknown element type, trying innerHTML`);
      element.innerHTML = value.replace(/\n/g, '<br>');
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }

    console.log(`[FallbackProvider] Filled input "${target}" with:`, value.substring(0, 50) + '...');
  }

  /**
   * Execute a navigate action
   * @param {string} url - URL to navigate to
   */
  async executeNavigate(url) {
    window.location.href = url;
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

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to wait
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
