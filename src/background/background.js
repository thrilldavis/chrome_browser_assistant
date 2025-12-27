console.log("background.js script loaded.");

// Import model system files dynamically based on configuration
importScripts(
  'models/models.config.js',
  'models/background-loader.js',
  'models/ModelRegistry.js'
);

// Load all model provider scripts
loadAllModelProvidersForBackground();

// Initialize model registry on service worker startup
let modelRegistryReady = false;

async function initializeModelRegistry() {
  if (modelRegistryReady) return;

  console.log('Background: Initializing model registry...');

  // Register all models from configuration
  registerAllModelProviders();

  // Load saved configurations and selected model
  await modelRegistry.loadConfigsFromStorage();

  modelRegistryReady = true;
  console.log('Background: Model registry ready');
}

// Initialize immediately
initializeModelRegistry().catch(err => {
  console.error('Failed to initialize model registry:', err);
});

// When the user clicks on the extension action.
chrome.action.onClicked.addListener((tab) => {
  console.log(`background.js onClicked called: ${tab.id}`);

  // Open plugin panel - Chrome will handle the configuration
  chrome.sidePanel.open({ tabId: tab.id }).catch(error => {
    console.error('Error opening plugin panel:', error);
  });
});

// Message handler for communication with plugin
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background: Received message:', request.action);

  if (request.action === 'check_ready') {
    // Check if background is ready
    sendResponse({ ready: modelRegistryReady });
    return true;
  }

  if (request.action === 'get_model_list') {
    // Check if registry is ready
    if (!modelRegistryReady) {
      sendResponse({ error: 'Background still initializing', ready: false });
      return true;
    }

    // Return list of all available models
    const models = modelRegistry.getAllModels().map(m => ({
      id: m.id,
      displayName: m.displayName,
      description: m.getDescription(),
      requiresInternet: m.requiresInternet()
    }));
    sendResponse({ models });
    return true;
  }

  if (request.action === 'get_current_model') {
    // Return current model ID
    sendResponse({ modelId: modelRegistry.currentModelId });
    return true;
  }

  if (request.action === 'set_current_model') {
    // Set current model
    modelRegistry.setCurrentModel(request.modelId);
    modelRegistry.saveCurrentModelToStorage();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'get_model_config') {
    // Get configuration for a specific model
    const modelId = request.modelId || modelRegistry.currentModelId;
    const config = modelRegistry.currentConfig[modelId] || {};
    sendResponse({ config });
    return true;
  }

  if (request.action === 'get_config_fields') {
    // Get configuration fields for a model
    const model = modelRegistry.getModel(request.modelId);
    if (model) {
      const fields = model.getConfigFields();
      sendResponse({ fields });
    } else {
      sendResponse({ error: 'Model not found' });
    }
    return true;
  }

  if (request.action === 'save_model_config') {
    // Save configuration for a model
    modelRegistry.setConfig(request.modelId, request.config);
    modelRegistry.saveConfigsToStorage();
    sendResponse({ success: true });
    return true;
  }

  if (request.action === 'validate_config') {
    // Validate configuration for a model
    const model = modelRegistry.getModel(request.modelId);
    if (model) {
      const validation = model.validateConfig(request.config);
      sendResponse({ validation });
    } else {
      sendResponse({ error: 'Model not found' });
    }
    return true;
  }

  if (request.action === 'chat') {
    // Make a chat request using the current model
    (async () => {
      try {
        const response = await modelRegistry.chat(request.systemPrompt, request.userPrompt);
        sendResponse({ success: true, response });
      } catch (error) {
        sendResponse({ success: false, error: error.message });
      }
    })();
    return true; // Keep channel open for async response
  }

  return false;
});