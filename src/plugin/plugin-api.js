/**
 * Plugin API - Communicates with background service worker
 *
 * This API provides an interface for the plugin to interact with
 * the model registry that lives in the background service worker.
 */

const BackgroundAPI = {
  /**
   * Gets list of all available models
   * @returns {Promise<Object>} Returns { models: Array } or { error: string, ready: boolean }
   */
  async getModelList() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'get_model_list' }, (response) => {
        resolve(response || { error: 'No response', ready: false });
      });
    });
  },

  /**
   * Gets the current selected model ID
   * @returns {Promise<string|null>}
   */
  async getCurrentModel() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'get_current_model' }, (response) => {
        resolve(response.modelId || null);
      });
    });
  },

  /**
   * Sets the current model
   * @param {string} modelId
   * @returns {Promise<boolean>}
   */
  async setCurrentModel(modelId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'set_current_model', modelId }, (response) => {
        resolve(response.success || false);
      });
    });
  },

  /**
   * Gets configuration for a specific model
   * @param {string} modelId
   * @returns {Promise<Object>}
   */
  async getModelConfig(modelId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'get_model_config', modelId }, (response) => {
        resolve(response.config || {});
      });
    });
  },

  /**
   * Gets configuration fields for a model
   * @param {string} modelId
   * @returns {Promise<Array>}
   */
  async getConfigFields(modelId) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'get_config_fields', modelId }, (response) => {
        resolve(response.fields || []);
      });
    });
  },

  /**
   * Saves configuration for a model
   * @param {string} modelId
   * @param {Object} config
   * @returns {Promise<boolean>}
   */
  async saveModelConfig(modelId, config) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'save_model_config', modelId, config }, (response) => {
        resolve(response.success || false);
      });
    });
  },

  /**
   * Validates configuration for a model
   * @param {string} modelId
   * @param {Object} config
   * @returns {Promise<Object>}
   */
  async validateConfig(modelId, config) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: 'validate_config', modelId, config }, (response) => {
        resolve(response.validation || { valid: false, errors: {} });
      });
    });
  },

  /**
   * Makes a chat request using the current model
   * @param {string} systemPrompt
   * @param {string} userPrompt
   * @returns {Promise<string>}
   */
  async chat(systemPrompt, userPrompt) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        action: 'chat',
        systemPrompt,
        userPrompt
      }, (response) => {
        if (response.success) {
          resolve(response.response);
        } else {
          reject(new Error(response.error || 'Chat request failed'));
        }
      });
    });
  }
};
