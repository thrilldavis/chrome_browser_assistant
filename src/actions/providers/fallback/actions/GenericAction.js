/**
 * GenericAction - AI-powered action for any website
 *
 * Uses LLM to understand and execute actions on any website
 * where we don't have a specific provider.
 */
console.log('[Browser Assistant] GenericAction.js loaded');

class GenericAction extends BaseAction {
  constructor(fallbackProvider) {
    super('generic_action', 'AI-Powered Action');
    this.provider = fallbackProvider;
    this.confirmationOverlay = new ConfirmationOverlay();
  }

  /**
   * Generic action can always execute
   * @returns {Promise<boolean>}
   */
  async canExecute() {
    return true;
  }

  /**
   * Extract context - uses provider's context
   * @returns {Promise<Object>}
   */
  async extractContext() {
    return await this.provider.getContext();
  }

  /**
   * Full workflow: plan, confirm, execute
   * @param {string} userCommand - User's command
   * @returns {Promise<ActionResult>}
   */
  async run(userCommand) {
    try {
      // Step 1: Get LLM to plan the action
      const plan = await this.provider.planAction(userCommand);

      if (!plan.feasible) {
        return ActionResult.error(`Cannot execute: ${plan.reasoning}`);
      }

      // Step 2: Format plan for user confirmation
      const planDescription = this.formatPlan(plan);

      // Step 3: Show confirmation
      const confirmation = await this.confirmationOverlay.show({
        action: 'Execute Action on Page',
        content: planDescription,
        editable: false,
        target: `${window.location.hostname}`,
        warning: plan.warnings.length > 0 ? plan.warnings.join('\n') :
                 'This action will interact with the page. Review the steps carefully.'
      });

      // Step 4: If approved, execute
      if (confirmation.approved) {
        return await this.provider.executeAction(plan);
      } else {
        return ActionResult.error('Action cancelled by user');
      }

    } catch (error) {
      console.error('Error in generic action:', error);
      return ActionResult.error(`Action failed: ${error.message}`);
    }
  }

  /**
   * Format plan for display
   * @param {Object} plan
   * @returns {string}
   */
  formatPlan(plan) {
    let formatted = `AI Analysis: ${plan.reasoning}\n\n`;
    formatted += `Steps to execute:\n\n`;

    plan.steps.forEach((step, index) => {
      formatted += `${index + 1}. ${step.description}\n`;
      formatted += `   Action: ${step.action}`;
      if (step.target) formatted += ` → ${step.target}`;
      if (step.value) formatted += ` = "${step.value}"`;
      formatted += `\n\n`;
    });

    if (plan.warnings.length > 0) {
      formatted += `\nWarnings:\n`;
      plan.warnings.forEach(w => formatted += `⚠ ${w}\n`);
    }

    return formatted;
  }

  /**
   * Execute without confirmation (for programmatic use)
   * @param {string} userCommand
   * @returns {Promise<ActionResult>}
   */
  async executeDirectly(userCommand) {
    const plan = await this.provider.planAction(userCommand);

    if (!plan.feasible) {
      return ActionResult.error(`Cannot execute: ${plan.reasoning}`);
    }

    return await this.provider.executeAction(plan);
  }
}
