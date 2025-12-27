/**
 * Global registry for model classes
 * Models register themselves here when their scripts load
 */
if (typeof self !== 'undefined') {
  self.MODEL_CLASS_REGISTRY = self.MODEL_CLASS_REGISTRY || {};
}

/**
 * BaseModel - Abstract base class for all AI model providers
 *
 * This class defines the interface that all model implementations must follow.
 * Each model provider (LM Studio, Claude, OpenAI, etc.) should extend this class
 * and implement its abstract methods.
 */
class BaseModel {
  /**
   * @param {string} id - Unique identifier for this model instance
   * @param {string} displayName - Human-readable name shown in the UI
   */
  constructor(id, displayName) {
    if (new.target === BaseModel) {
      throw new Error('BaseModel is abstract and cannot be instantiated directly');
    }
    this.id = id;
    this.displayName = displayName;
  }

  /**
   * Static method to register a model class
   * Call this at the end of each model file
   */
  static registerClass(className, classConstructor) {
    if (typeof self !== 'undefined' && self.MODEL_CLASS_REGISTRY) {
      self.MODEL_CLASS_REGISTRY[className] = classConstructor;
      console.log(`Registered model class: ${className}`);
    }
  }

  /**
   * Returns model-specific configuration fields (without base fields).
   * Subclasses should implement this to define their specific config needs.
   *
   * @returns {Array<Object>} Array of model-specific configuration field definitions
   */
  getModelSpecificConfigFields() {
    return [];
  }

  /**
   * Returns all configuration fields for this model (base + model-specific).
   * Subclasses should NOT override this - override getModelSpecificConfigFields() instead.
   *
   * @returns {Array<Object>} Array of configuration field definitions
   *
   * Example:
   * [
   *   { name: 'apiKey', label: 'API Key', type: 'password', placeholder: 'sk-...', required: true },
   *   { name: 'model', label: 'Model Name', type: 'text', placeholder: 'gpt-4', required: true, defaultValue: 'gpt-4' }
   * ]
   */
  getConfigFields() {
    const baseFields = [
      {
        name: 'chunkSize',
        label: 'Content Chunk Size',
        type: 'number',
        placeholder: '50000',
        required: false,
        defaultValue: '50000',
        helpText: 'Maximum characters per chunk when summarizing long pages. Larger values use more of the model\'s context window but require fewer API calls. Recommended: 50K for smaller models, 100-150K for GPT-4o/Claude.'
      }
    ];

    // Combine model-specific fields with base fields
    return [...this.getModelSpecificConfigFields(), ...baseFields];
  }

  /**
   * Validates the provided configuration
   *
   * @param {Object} config - Configuration object with values for each field
   * @returns {Object} { valid: boolean, errors: Object } - Validation result
   */
  validateConfig(config) {
    const errors = {};
    const fields = this.getConfigFields();

    for (const field of fields) {
      if (field.required && !config[field.name]) {
        errors[field.name] = `${field.label} is required`;
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  /**
   * Makes a chat completion request to the model provider
   *
   * @param {string} systemPrompt - System message to set context
   * @param {string} userPrompt - User's message/question
   * @param {Object} config - Model-specific configuration (API keys, model names, etc.)
   * @returns {Promise<string>} The model's response text
   * @throws {Error} If the request fails
   */
  async chat(systemPrompt, userPrompt, config) {
    throw new Error('chat() must be implemented by subclass');
  }

  /**
   * Returns a user-friendly description of this model provider
   *
   * @returns {string} Description text
   */
  getDescription() {
    return '';
  }

  /**
   * Returns whether this model requires internet connection
   *
   * @returns {boolean} True if internet is required
   */
  requiresInternet() {
    return true;
  }
}
