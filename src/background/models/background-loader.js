/**
 * Background Service Worker Model Loader
 *
 * Dynamically loads model provider scripts for the background service worker
 * using importScripts (which is synchronous in service workers)
 */

/**
 * Loads all model provider scripts defined in MODEL_PROVIDERS config
 * This runs in the service worker context using importScripts
 */
function loadAllModelProvidersForBackground() {
  if (typeof MODEL_PROVIDERS === 'undefined') {
    throw new Error('MODEL_PROVIDERS not defined. Ensure models.config.js is loaded first.');
  }

  // Combine standard and local providers
  const localProviders = (typeof LOCAL_MODEL_PROVIDERS !== 'undefined') ? LOCAL_MODEL_PROVIDERS : [];
  const allProviders = [...MODEL_PROVIDERS, ...localProviders];

  console.log(`Background: Loading ${allProviders.length} model providers (${MODEL_PROVIDERS.length} standard, ${localProviders.length} local)...`);

  // Collect all script paths
  const scriptPaths = ['models/BaseModel.js'];

  for (const provider of allProviders) {
    scriptPaths.push(provider.scriptPath);
  }

  console.log('Background: Importing scripts:', scriptPaths);

  // Load all scripts synchronously using importScripts
  // Local scripts that don't exist will fail silently (caught in try-catch in caller)
  try {
    importScripts(...scriptPaths);
  } catch (error) {
    // If a local model file doesn't exist, that's OK - just log it
    console.warn('Background: Some model scripts failed to load (this is OK for optional local models):', error.message);

    // Try loading scripts one by one to identify which ones failed
    scriptPaths.forEach(path => {
      try {
        importScripts(path);
      } catch (e) {
        console.warn(`Background: Failed to load ${path}:`, e.message);
      }
    });
  }

  console.log('Background: Model provider scripts loaded');
  console.log('Background: Checking if BaseModel is available:', typeof BaseModel !== 'undefined');
  console.log('Background: Checking if LMStudioModel is available:', typeof LMStudioModel !== 'undefined');
  console.log('Background: Checking if ClaudeModel is available:', typeof ClaudeModel !== 'undefined');
  console.log('Background: Checking if OpenAIModel is available:', typeof OpenAIModel !== 'undefined');
}

/**
 * Registers all model providers with the ModelRegistry
 * Call this after loadAllModelProvidersForBackground()
 */
function registerAllModelProviders() {
  if (typeof MODEL_PROVIDERS === 'undefined') {
    throw new Error('MODEL_PROVIDERS not defined.');
  }

  // Combine standard and local providers
  const localProviders = (typeof LOCAL_MODEL_PROVIDERS !== 'undefined') ? LOCAL_MODEL_PROVIDERS : [];
  const allProviders = [...MODEL_PROVIDERS, ...localProviders];

  console.log('Background: Registering model providers...');

  // Access the global registry that models registered themselves into
  const classRegistry = self.MODEL_CLASS_REGISTRY || {};
  console.log('Background: Available classes in registry:', Object.keys(classRegistry));

  for (const provider of allProviders) {
    try {
      // Get the class from the registry
      const ModelClass = classRegistry[provider.className];

      if (ModelClass) {
        const instance = new ModelClass();
        modelRegistry.register(instance);
        console.log(`Background: Registered ${provider.className}`);
      } else {
        console.warn(`Background: Model class not found in registry: ${provider.className}`);
        console.warn(`Available in registry:`, Object.keys(classRegistry));
      }
    } catch (error) {
      console.error(`Background: Failed to register model ${provider.className}:`, error);
    }
  }

  console.log(`Background: ModelRegistry initialized with ${modelRegistry.models.size} providers`);
}
