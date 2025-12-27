/**
 * ModelRegistry - Central registry for all available AI model providers
 *
 * This singleton class manages all available model providers and provides
 * methods to retrieve them, get their configurations, and interact with them.
 */
class ModelRegistry {
  constructor() {
    if (ModelRegistry.instance) {
      return ModelRegistry.instance;
    }

    this.models = new Map();
    this.currentModelId = null;
    this.currentConfig = {};
    this.initialized = false;

    ModelRegistry.instance = this;
  }

  /**
   * Initializes the registry by loading all model providers from the config
   * This method should be called once when the extension loads
   *
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return;
    }

    console.log('Initializing ModelRegistry...');

    // Load configurations from storage first
    await this.loadConfigsFromStorage();

    // MODEL_PROVIDERS is defined in models.config.js which must be loaded before this script
    if (typeof MODEL_PROVIDERS === 'undefined') {
      console.error('MODEL_PROVIDERS not found. Ensure models.config.js is loaded first.');
      return;
    }

    // Register each model provider
    for (const provider of MODEL_PROVIDERS) {
      try {
        // The script should already be loaded via HTML, so the class should be available globally
        const ModelClass = window[provider.className];
        if (ModelClass) {
          const instance = new ModelClass();
          this.register(instance);
        } else {
          console.warn(`Model class not found: ${provider.className}`);
        }
      } catch (error) {
        console.error(`Failed to register model ${provider.className}:`, error);
      }
    }

    this.initialized = true;
    console.log(`ModelRegistry initialized with ${this.models.size} providers`);
  }

  /**
   * Registers a model provider instance
   *
   * @param {BaseModel} modelInstance - Instance of a model class extending BaseModel
   */
  register(modelInstance) {
    if (!(modelInstance instanceof BaseModel)) {
      throw new Error('Model must extend BaseModel');
    }
    this.models.set(modelInstance.id, modelInstance);
    console.log(`Registered model provider: ${modelInstance.displayName} (${modelInstance.id})`);
  }

  /**
   * Gets all registered model providers
   *
   * @returns {Array<BaseModel>} Array of all registered models
   */
  getAllModels() {
    return Array.from(this.models.values());
  }

  /**
   * Gets a specific model provider by ID
   *
   * @param {string} modelId - The model's unique identifier
   * @returns {BaseModel|null} The model instance or null if not found
   */
  getModel(modelId) {
    return this.models.get(modelId) || null;
  }

  /**
   * Gets the currently selected model provider
   *
   * @returns {BaseModel|null} The current model instance or null
   */
  getCurrentModel() {
    return this.currentModelId ? this.getModel(this.currentModelId) : null;
  }

  /**
   * Sets the current model by ID
   *
   * @param {string} modelId - The model's unique identifier
   * @returns {boolean} True if successful, false if model not found
   */
  setCurrentModel(modelId) {
    if (this.models.has(modelId)) {
      this.currentModelId = modelId;
      console.log(`Current model set to: ${modelId}`);
      return true;
    }
    console.error(`Model not found: ${modelId}`);
    return false;
  }

  /**
   * Gets the current model's configuration
   *
   * @returns {Object} The configuration object
   */
  getCurrentConfig() {
    return this.currentConfig[this.currentModelId] || {};
  }

  /**
   * Sets the configuration for a specific model
   *
   * @param {string} modelId - The model's unique identifier
   * @param {Object} config - Configuration object
   */
  setConfig(modelId, config) {
    this.currentConfig[modelId] = config;
    console.log(`Configuration updated for model: ${modelId}`);
  }

  /**
   * Loads all configurations from Chrome storage
   *
   * @returns {Promise<void>}
   */
  async loadConfigsFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['modelConfigs', 'selectedModel'], (result) => {
        if (result.modelConfigs) {
          this.currentConfig = result.modelConfigs;
          console.log('Loaded model configurations from storage');
        }
        if (result.selectedModel) {
          this.currentModelId = result.selectedModel;
          console.log(`Loaded selected model: ${result.selectedModel}`);
        }
        resolve();
      });
    });
  }

  /**
   * Saves current model selection to Chrome storage
   *
   * @returns {Promise<void>}
   */
  async saveCurrentModelToStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ selectedModel: this.currentModelId }, () => {
        console.log(`Saved selected model: ${this.currentModelId}`);
        resolve();
      });
    });
  }

  /**
   * Saves all configurations to Chrome storage
   *
   * @returns {Promise<void>}
   */
  async saveConfigsToStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ modelConfigs: this.currentConfig }, () => {
        console.log('Saved model configurations to storage');
        resolve();
      });
    });
  }

  /**
   * Makes a chat request using the current model and its configuration
   *
   * @param {string} systemPrompt - System message
   * @param {string} userPrompt - User message
   * @returns {Promise<string>} Model's response
   * @throws {Error} If no model is selected or model not found
   */
  async chat(systemPrompt, userPrompt) {
    if (!this.currentModelId) {
      throw new Error('No model selected');
    }

    const model = this.getCurrentModel();
    if (!model) {
      throw new Error(`Model not found: ${this.currentModelId}`);
    }

    const config = this.getCurrentConfig();
    const validation = model.validateConfig(config);

    if (!validation.valid) {
      const errorMessages = Object.values(validation.errors).join(', ');
      throw new Error(`Invalid configuration: ${errorMessages}`);
    }

    return await model.chat(systemPrompt, userPrompt, config);
  }
}

// Create singleton instance (initialized in background.js)
const modelRegistry = new ModelRegistry();
