/**
 * Browser Assistant - Plugin Script
 *
 * This script manages the plugin UI, model selection, configuration,
 * and interaction with AI models for summarization and chat.
 */

/* =========================
   Utility Functions
   ========================= */

/**
 * Safely renders content to an element by converting Markdown to HTML
 * and sanitizing it before insertion.
 */
function renderContent(element, content) {
  try {
    console.log(`renderContent: raw content: ${content}`);
    const rawHtml = marked.parse(content);
    console.log(`renderContent: output of marked: ${rawHtml}`);
    const safeHtml = DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
    console.log(`renderContent: output of DOMPurify: ${safeHtml}`);
    element.innerHTML = safeHtml;
  } catch (error) {
    console.log(`renderContent: error: ${error}`);
    element.textContent = content;
  }
}

/**
 * Splits a long string of text into smaller chunks.
 * @param {string} text
 * @param {number} maxLength - Maximum characters per chunk
 * @returns {string[]}
 */
function chunkText(text, maxLength = 10000) {
  const chunks = [];
  for (let i = 0; i < text.length; i += maxLength) {
    chunks.push(text.substring(i, i + maxLength));
  }
  return chunks;
}

/* =========================
   Model Configuration UI
   ========================= */

class ConfigurationUI {
  constructor() {
    this.configPanel = document.getElementById('config-panel');
    this.configDescription = document.getElementById('config-description');
    this.configFields = document.getElementById('config-fields');
    this.configSaveBtn = document.getElementById('config-save');
    this.configCancelBtn = document.getElementById('config-cancel');
    this.configCloseBtn = document.getElementById('config-close');
    this.configureBtn = document.getElementById('configure-btn');
    this.configWarning = document.getElementById('config-warning');
    this.configWarningBtn = document.getElementById('config-warning-btn');

    this.currentModelId = null;
    this.tempConfig = {};
    this.onConfigChanged = null; // Callback for when config is saved

    this.initEventListeners();
  }

  initEventListeners() {
    if (this.configureBtn) {
      this.configureBtn.addEventListener('click', () => {
        console.log('Configure button clicked');
        this.show();
      });
    } else {
      console.error('Configure button not found in DOM');
    }

    if (this.configCloseBtn) {
      this.configCloseBtn.addEventListener('click', () => this.hide());
    }
    if (this.configCancelBtn) {
      this.configCancelBtn.addEventListener('click', () => this.hide());
    }
    if (this.configSaveBtn) {
      this.configSaveBtn.addEventListener('click', () => this.save());
    }
    if (this.configWarningBtn) {
      this.configWarningBtn.addEventListener('click', () => this.show());
    }
  }

  /**
   * Checks if the current model is properly configured
   * @returns {Promise<boolean>}
   */
  async isCurrentModelConfigured() {
    const modelId = await BackgroundAPI.getCurrentModel();
    if (!modelId) return false;

    const config = await BackgroundAPI.getModelConfig(modelId);
    const validation = await BackgroundAPI.validateConfig(modelId, config);

    return validation.valid;
  }

  /**
   * Updates the UI to show/hide configuration warnings
   */
  async updateConfigurationStatus() {
    const isConfigured = await this.isCurrentModelConfigured();

    // Update configure button appearance
    if (isConfigured) {
      this.configureBtn.classList.remove('needs-config');
      this.configureBtn.title = 'Configure model';
    } else {
      this.configureBtn.classList.add('needs-config');
      this.configureBtn.title = 'Configuration required!';
    }

    // Update warning banner
    if (isConfigured) {
      this.configWarning.classList.remove('visible');
    } else {
      this.configWarning.classList.add('visible');
    }

    return isConfigured;
  }

  /**
   * Shows the configuration panel for the specified model
   * @param {string} modelId
   */
  async show(modelId = null) {
    console.log('ConfigurationUI.show() called with modelId:', modelId);

    this.currentModelId = modelId || await BackgroundAPI.getCurrentModel();
    console.log('Current model ID:', this.currentModelId);

    if (!this.currentModelId) {
      alert('Please select a model first');
      return;
    }

    // Get model info from background
    const response = await BackgroundAPI.getModelList();
    console.log('getModelList response:', response);
    const models = response.models || [];
    const modelInfo = models.find(m => m.id === this.currentModelId);
    if (!modelInfo) {
      alert('Model not found');
      return;
    }

    // Load current config for this model
    const currentConfig = await BackgroundAPI.getModelConfig(this.currentModelId);
    this.tempConfig = { ...currentConfig };

    // Render description
    this.configDescription.textContent = modelInfo.description;

    // Get and render config fields
    const fields = await BackgroundAPI.getConfigFields(this.currentModelId);
    this.renderFields(fields);

    // Show panel
    console.log('Showing config panel');
    this.configPanel.classList.add('visible');
  }

  hide() {
    this.configPanel.classList.remove('visible');
    this.tempConfig = {};
  }

  /**
   * Renders configuration fields
   * @param {Array} fields - Array of field definitions
   */
  renderFields(fields) {
    this.configFields.innerHTML = '';

    for (const field of fields) {
      const fieldDiv = document.createElement('div');
      fieldDiv.className = 'config-field';

      // Label
      const label = document.createElement('label');
      label.textContent = field.label;
      label.setAttribute('for', `config-${field.name}`);
      fieldDiv.appendChild(label);

      // Input element
      let input;
      if (field.type === 'select') {
        input = document.createElement('select');
        for (const option of field.options || []) {
          const optEl = document.createElement('option');
          optEl.value = option.value;
          optEl.textContent = option.label;
          input.appendChild(optEl);
        }
      } else {
        input = document.createElement('input');
        input.type = field.type || 'text';
        input.placeholder = field.placeholder || '';
      }

      input.id = `config-${field.name}`;
      input.name = field.name;

      // Set current value or default
      const currentValue = this.tempConfig[field.name] || field.defaultValue || '';
      input.value = currentValue;

      // Initialize tempConfig with the current value (including defaults)
      if (!this.tempConfig.hasOwnProperty(field.name)) {
        this.tempConfig[field.name] = currentValue;
      }

      // Update tempConfig on change
      input.addEventListener('input', (e) => {
        this.tempConfig[field.name] = e.target.value;
      });

      fieldDiv.appendChild(input);

      // Help text
      if (field.helpText) {
        const helpText = document.createElement('div');
        helpText.className = 'help-text';
        helpText.textContent = field.helpText;
        fieldDiv.appendChild(helpText);
      }

      this.configFields.appendChild(fieldDiv);
    }
  }

  /**
   * Saves the current configuration
   */
  async save() {
    if (!this.currentModelId) return;

    // Validate configuration
    const validation = await BackgroundAPI.validateConfig(this.currentModelId, this.tempConfig);

    // Clear previous errors
    const errorEls = this.configFields.querySelectorAll('.error-text');
    errorEls.forEach(el => el.remove());

    if (!validation.valid) {
      // Show errors
      for (const [fieldName, errorMsg] of Object.entries(validation.errors)) {
        const fieldDiv = this.configFields.querySelector(`[name="${fieldName}"]`)?.parentElement;
        if (fieldDiv) {
          const errorEl = document.createElement('div');
          errorEl.className = 'error-text';
          errorEl.textContent = errorMsg;
          fieldDiv.appendChild(errorEl);
        }
      }
      return;
    }

    // Save configuration via background API
    await BackgroundAPI.saveModelConfig(this.currentModelId, this.tempConfig);

    console.log(`Configuration saved for ${this.currentModelId}`);

    // Update configuration status
    await this.updateConfigurationStatus();

    // Notify listeners that config changed
    if (this.onConfigChanged) {
      this.onConfigChanged();
    }

    this.hide();
  }
}

/* =========================
   Summarization Functions
   ========================= */

/**
 * Generates a full summary by processing text chunk-by-chunk.
 * @param {string} fullText
 * @returns {Promise<string>}
 */
async function generateFullSummary(fullText) {
  console.log("Entering generateFullSummary...");

  const systemPrompt = `Summarize the webpage text chunk. Keep only the main content and critical info.
Ignore/omit: navigation/menus, ads, headers/footers, sidebars, boilerplate, and bottom thumbnail/related sections.
If the chunk is mostly low-information or boilerplate, output: NO_CONTENT.`;

  // Get the configured chunk size for the current model
  const config = await BackgroundAPI.getModelConfig();
  const chunkSize = parseInt(config.chunkSize) || 50000;
  console.log(`Using chunk size: ${chunkSize} characters`);

  const chunks = chunkText(fullText, chunkSize);
  const chunkSummaries = [];

  for (let i = 0; i < chunks.length; i++) {
    console.log(`Summarizing chunk ${i + 1} of ${chunks.length}...`);
    try {
      const summary = await BackgroundAPI.chat(systemPrompt, chunks[i]);
      console.log("this is the summary: " + summary);
      if (summary) chunkSummaries.push(summary);
    } catch (error) {
      console.error(`Error summarizing chunk ${i + 1}:`, error);
      chunkSummaries.push(`[Error summarizing this section: ${error.message}]`);
    }
  }

  if (chunkSummaries.length > 1) {
    console.log('Combining chunk summaries into a final report...');
    const combineSystemPrompt = `Merge the partial summaries into one cohesive, well-structured summary.
Remove repeats. Preserve key facts/findings/conclusions.
Output ONLY the final summary in Markdown (use concise bullets where helpful). No preface or meta text.`;

    const combineUserPrompt = `${chunkSummaries.join('\n\n---\n\n')}`;

    try {
      return await BackgroundAPI.chat(combineSystemPrompt, combineUserPrompt);
    } catch (error) {
      console.error('Error combining summaries:', error);
      return chunkSummaries.join('\n\n---\n\n');
    }
  }

  return chunkSummaries[0] || 'Could not generate a summary.';
}

/* =========================
   Model Picker Functions
   ========================= */

/**
 * Populates the model dropdown with all available models
 *
 * USABILITY FIX: Handles race condition where plugin opens before background ready.
 *
 * Problem solved:
 * - Background service worker needs time to initialize ModelRegistry
 * - If plugin opens too quickly, getModelList() returns empty/error
 * - User would see "Initializing..." forever and have to close/reopen plugin
 *
 * Solution:
 * - Retry up to 5 times with 500ms intervals
 * - Show "Initializing..." while waiting
 * - Auto-populate when background becomes ready
 * - Show "Failed to load models" if all retries exhausted
 *
 * @param {HTMLSelectElement} selectEl - The select element
 * @param {ConfigurationUI} configUI - Configuration UI instance
 */
async function populateModelDropdown(selectEl, configUI) {
  selectEl.innerHTML = '';

  // Get models from background with retry logic
  let modelListResponse = await BackgroundAPI.getModelList();

  // Check if background isn't ready yet - retry with backoff
  if (modelListResponse.error || !modelListResponse.models) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = 'Initializing...';
    selectEl.appendChild(opt);
    selectEl.disabled = true;

    // Retry up to 5 times with increasing delays
    let retries = 5;
    let delay = 500; // Start with 500ms

    const retryInterval = setInterval(async () => {
      console.log(`Retrying model list fetch... (${6 - retries}/5)`);
      modelListResponse = await BackgroundAPI.getModelList();

      if (modelListResponse.models && modelListResponse.models.length > 0) {
        // Success! Clear the interval and repopulate
        clearInterval(retryInterval);
        console.log('Background ready, populating models');
        selectEl.innerHTML = ''; // Clear "Initializing..."
        await populateModelDropdown(selectEl, configUI);
        return;
      }

      retries--;
      if (retries === 0) {
        clearInterval(retryInterval);
        console.error('Background failed to initialize after retries');
        selectEl.innerHTML = '';
        const errorOpt = document.createElement('option');
        errorOpt.disabled = true;
        errorOpt.selected = true;
        errorOpt.textContent = 'Failed to load models';
        selectEl.appendChild(errorOpt);
      }
    }, delay);

    return;
  }

  const models = modelListResponse.models;

  if (models.length === 0) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = 'No models available';
    selectEl.appendChild(opt);
    selectEl.disabled = true;
    return;
  }

  // Create options for each model
  for (const model of models) {
    const opt = document.createElement('option');
    opt.value = model.id;
    opt.textContent = model.displayName;
    selectEl.appendChild(opt);
  }

  // Get current model from background
  const currentModelId = await BackgroundAPI.getCurrentModel();

  // Set initial selection
  if (currentModelId && models.some(m => m.id === currentModelId)) {
    selectEl.value = currentModelId;
  } else {
    // Default to first model
    selectEl.value = models[0].id;
    await BackgroundAPI.setCurrentModel(models[0].id);
  }

  selectEl.disabled = false;

  // Update configuration status for initial model
  await configUI.updateConfigurationStatus();

  // Listen to changes
  selectEl.addEventListener('change', async (e) => {
    const selectedId = e.target.value;
    await BackgroundAPI.setCurrentModel(selectedId);
    console.log(`Model switched to: ${selectedId}`);

    // Update configuration status when model changes
    await configUI.updateConfigurationStatus();
  });
}

/* =========================
   Page Content Retrieval
   ========================= */

/**
 * Retrieves page content from the active tab
 * @returns {Promise<string|null>} Page text or null if unavailable
 */
async function getPageContent() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log(`Getting content from tab: ${tab.id}, URL: ${tab.url}`);

    // Inject Readability library
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['libs/Readability.js']
      });
      console.log('Readability.js injected successfully');
    } catch (injectError) {
      console.error('Error injecting Readability.js:', injectError);
    }

    // Send message to content script
    console.log('Sending get_page_text message to content script...');
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'get_page_text' });
    console.log(`get_page_text response:`, response);

    // Check if this is a PDF with an error
    if (response && response.isPDF && response.error) {
      console.error('PDF extraction failed:', response.error);
      return null;
    }

    // Return null if no content available
    if (!response || !response.text || response.text.trim().length === 0) {
      console.warn('No text content in response');
      return null;
    }

    // For PDFs, note the page count
    if (response.isPDF) {
      console.log(`Received PDF with ${response.pageCount} pages, ${response.text.length} characters of content`);
    } else if (response.isGoogleWorkspace) {
      console.log(`Received Google ${response.workspaceType} with ${response.text.length} characters of content`);
    } else {
      console.log(`Received ${response.text.length} characters of content`);
    }

    return response.text;
  } catch (error) {
    console.error('Error retrieving page content:', error);
    console.error('Error details:', error.message, error.stack);
    return null;
  }
}

/* =========================
   Content Script Injection
   ========================= */

/**
 * Ensure content scripts are injected into the active tab
 *
 * CRITICAL USABILITY FIX: This eliminates the "reload page" requirement.
 *
 * Problem solved:
 * - Content scripts from manifest only inject when pages LOAD
 * - If extension installed/reloaded while pages already open, those pages lack scripts
 * - User would see "reload page" errors or broken functionality
 * - This was the #1 UX complaint
 *
 * Solution:
 * - Programmatically inject scripts on-demand when plugin opens
 * - Ping existing scripts first to avoid double-injection
 * - PERFORMANCE OPTIMIZATION: Only inject scripts needed for current page
 *   - CNN.com gets 13 scripts (core + fallback)
 *   - Gmail gets 17 scripts (core + fallback + Gmail actions)
 *   - Google Docs gets 16 scripts (core + fallback + Docs actions)
 *
 * @returns {Promise<boolean>} True if scripts injected or already present, false if failed
 */
async function ensureContentScriptsInjected() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      console.log('No active tab found');
      return false;
    }

    // Skip chrome:// and other restricted URLs
    if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('chrome-extension://'))) {
      console.log('Cannot inject into restricted URL:', tab.url);
      return false;
    }

    console.log('Checking if content script is already injected in tab:', tab.id);

    // Try to ping the existing content script
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      if (response && response.pong) {
        console.log('Content script already injected');
        return true;
      }
    } catch (pingError) {
      console.log('Content script not responding, injecting...');
    }

    // Content script not present, inject it
    console.log('Injecting content scripts into tab:', tab.id);

    // Determine which provider scripts to load based on the URL
    const hostname = new URL(tab.url).hostname;
    const isGmail = hostname.includes('mail.google.com');
    const isGoogleDocs = hostname.includes('docs.google.com');

    console.log(`Page type - Gmail: ${isGmail}, Google Docs: ${isGoogleDocs}`);

    // Core scripts - always needed
    const coreScripts = [
      'libs/pdf.min.js',
      'src/content/pdf-extractor.js',
      'src/content/google-workspace-extractor.js',
      'src/content/content.js',
      'src/actions/base/BaseAction.js',
      'src/actions/core/AccessibilityScanner.js',
      'src/actions/core/IntentParser.js',
      'src/actions/ui/ConfirmationOverlay.js'
    ];

    // Gmail-specific scripts - only inject on Gmail
    const gmailScripts = isGmail ? [
      'src/actions/providers/gmail/GmailProvider.js',
      'src/actions/providers/gmail/actions/ReplyAction.js',
      'src/actions/providers/gmail/actions/ComposeAction.js',
      'src/actions/providers/gmail/actions/SummarizeThreadAction.js'
    ] : [];

    // Google Docs-specific scripts - only inject on Google Docs/Sheets/Slides
    const googleDocsScripts = isGoogleDocs ? [
      'src/actions/providers/googledocs/GoogleDocsProvider.js',
      'src/actions/providers/googledocs/actions/WriteTextAction.js',
      'src/actions/providers/googledocs/actions/SummarizeAction.js'
    ] : [];

    // Fallback provider - always needed for generic sites
    const fallbackScripts = [
      'src/actions/providers/fallback/FallbackProvider.js',
      'src/actions/providers/fallback/actions/GenericAction.js',
      'src/actions/providers/fallback/actions/SummarizePageAction.js'
    ];

    // Registry and loader - always needed (must be last)
    const registryScripts = [
      'src/actions/core/ActionRegistry.js',
      'src/actions/actions-loader.js'
    ];

    // Combine only the needed scripts
    const contentScriptFiles = [
      ...coreScripts,
      ...gmailScripts,
      ...googleDocsScripts,
      ...fallbackScripts,
      ...registryScripts
    ];

    console.log(`Injecting ${contentScriptFiles.length} scripts (saved ${19 - contentScriptFiles.length} unnecessary scripts)`);

    // Inject all content scripts in order
    // Using default ISOLATED world to match manifest content_scripts behavior
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: false },
        files: contentScriptFiles
      });
      console.log('All content scripts injected successfully');
      return true;
    } catch (injectError) {
      // If batch injection fails, try one by one (helps with debugging)
      console.warn('Batch injection failed, trying individual injection:', injectError);
      for (const file of contentScriptFiles) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: [file]
          });
          console.log(`Injected: ${file}`);
        } catch (fileError) {
          console.error(`Failed to inject ${file}:`, fileError);
          throw fileError;
        }
      }
      console.log('All content scripts injected individually');
      return true;
    }

  } catch (error) {
    console.error('Error injecting content scripts:', error);
    return false;
  }
}

/* =========================
   Main Initialization
   ========================= */

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Entering main initialization...");

  try {
    // CRITICAL: Ensure content scripts are injected before doing anything else
    // This fixes the "reload page" issue - we inject scripts on-demand
    console.log('Ensuring content scripts are injected...');
    const injected = await ensureContentScriptsInjected();

    // Give content scripts a moment to fully initialize
    if (injected) {
      console.log('Content scripts injected, waiting for initialization...');
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Get all necessary DOM elements
    const chatBox = document.getElementById('chat-box');
    const form = document.getElementById('chat-form');
    const promptField = document.getElementById('prompt');
    const chatLoader = document.getElementById('chat-loader');
    const modelSelect = document.getElementById('model-select');
    const pageIndicator = document.getElementById('current-page-indicator');

    // Check if background is ready
    console.log('Checking if background is ready...');
    let backgroundReady = false;
    try {
      const response = await chrome.runtime.sendMessage({ action: 'check_ready' });
      backgroundReady = response && response.ready;
    } catch (error) {
      console.warn('Could not check background readiness:', error);
    }

    if (!backgroundReady) {
      console.log('Background not ready, showing initialization message');
      summaryEl.textContent = 'Initializing... Please wait a moment.';

      // Poll until background is ready
      const pollInterval = setInterval(async () => {
        try {
          const response = await chrome.runtime.sendMessage({ action: 'check_ready' });
          if (response && response.ready) {
            console.log('Background is now ready!');
            clearInterval(pollInterval);
            // Reload the page to initialize properly
            window.location.reload();
          }
        } catch (error) {
          console.warn('Error polling background:', error);
        }
      }, 500);

      // Set timeout to stop polling after 30 seconds
      setTimeout(() => {
        clearInterval(pollInterval);
        summaryEl.textContent = 'Initialization timed out. Please try reloading the extension.';
      }, 30000);

      return;
    }

    console.log('Background is ready, continuing initialization');

    // Initialize configuration UI
    const configUI = new ConfigurationUI();

    // --- UI State Helper Functions ---
    const setChatLoading = (isLoading) => {
      chatLoader.style.display = isLoading ? 'block' : 'none';
    };
    const setChatDisabled = (isDisabled) => {
      promptField.disabled = isDisabled;
      form.querySelector('button').disabled = isDisabled;
      promptField.placeholder = isDisabled ? 'Please wait...' : 'Ask anything…';
    };

    // Conversation history for multi-turn chat
    let conversationHistory = [];

    // Function to update current page indicator
    async function updatePageIndicator() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          const url = new URL(tab.url);
          const displayUrl = url.hostname + url.pathname;
          pageIndicator.textContent = `📄 ${displayUrl}`;
          pageIndicator.title = tab.url;
          console.log(`Page indicator updated: ${tab.url}`);
        }
      } catch (error) {
        console.warn('Could not update page indicator:', error);
        pageIndicator.textContent = '';
      }
    }

    // Function to update quick actions based on available actions
    async function updateQuickActions(retryCount = 0) {
      try {
        const quickActionsContainer = document.getElementById('quick-actions-container');

        // Query available actions from background
        const response = await chrome.runtime.sendMessage({ action: 'get_available_actions' });
        const availableActions = response?.actions || [];

        console.log('Available actions:', availableActions);

        // If no actions found and we haven't retried enough, try again after a delay
        if (availableActions.length === 0 && retryCount < 3) {
          console.log(`No actions found, retrying in ${(retryCount + 1) * 200}ms... (attempt ${retryCount + 1}/3)`);
          setTimeout(() => updateQuickActions(retryCount + 1), (retryCount + 1) * 200);
          return;
        }

        // Clear and populate quick action buttons
        quickActionsContainer.innerHTML = '';

        // Map action IDs to icons
        const actionIcons = {
          'gmail_reply': '↩️',
          'gmail_compose': '✉️',
          'gmail_summarize': '📋',
          'googledocs_summarize': '📄',
          'fallback_summarize': '📝',
          'write_text': '📝',
          'generic_action': '⚡'
        };

        availableActions.forEach(action => {
          const button = document.createElement('button');
          button.className = 'quick-action-btn';
          button.dataset.actionKey = action.key;

          const icon = document.createElement('span');
          icon.className = 'icon';
          icon.textContent = actionIcons[action.id] || '⚡';

          const label = document.createElement('span');
          label.textContent = action.name;

          button.appendChild(icon);
          button.appendChild(label);

          // Add click handler to trigger action
          button.addEventListener('click', async () => {
            console.log('Quick action clicked:', action.key);
            // Trigger the action via background
            try {
              setChatDisabled(true);
              button.disabled = true;

              const result = await chrome.runtime.sendMessage({
                action: 'execute_action',
                actionKey: action.key,
                userInput: '' // Quick actions don't need user input
              });

              button.disabled = false;
              setChatDisabled(false);

              if (result.success) {
                console.log('Action executed successfully:', result);

                // Add result message to chat box
                const messageDiv = document.createElement('div');
                messageDiv.className = 'chat-message ai-message';

                // Use renderContent to support markdown formatting
                // Provide fallback if message is undefined or empty
                const displayMessage = result.message || 'Action completed successfully';
                if (typeof renderContent === 'function') {
                  renderContent(messageDiv, displayMessage);
                } else {
                  messageDiv.textContent = displayMessage;
                }

                chatBox.appendChild(messageDiv);
                chatBox.scrollTop = chatBox.scrollHeight;

                // Add to conversation history so it can be used as context for future chat
                conversationHistory.push({
                  user: `[Action: ${action.name}]`,
                  assistant: displayMessage
                });
              } else {
                console.error('Action failed:', result.message);

                // Add error to chat box
                const errorDiv = document.createElement('div');
                errorDiv.className = 'chat-message ai-message';
                // Provide fallback if message is undefined or empty
                const errorMessage = result.message || 'An unknown error occurred';
                errorDiv.textContent = `✗ ${errorMessage}`;
                chatBox.appendChild(errorDiv);
                chatBox.scrollTop = chatBox.scrollHeight;
              }
            } catch (error) {
              console.error('Error executing quick action:', error);
              button.disabled = false;
              setChatDisabled(false);

              // Add error to chat box
              const errorDiv = document.createElement('div');
              errorDiv.className = 'chat-message ai-message';
              errorDiv.textContent = `✗ Error: ${error.message}`;
              chatBox.appendChild(errorDiv);
              chatBox.scrollTop = chatBox.scrollHeight;
            }
          });

          quickActionsContainer.appendChild(button);
        });
      } catch (error) {
        console.error('Error updating quick actions:', error);
      }
    }

    // Update indicator on load
    await updatePageIndicator();

    // Update quick actions on load
    await updateQuickActions();

    // Listen for tab changes to update the indicator and actions
    chrome.tabs.onActivated.addListener(async () => {
      await updatePageIndicator();
      await updateQuickActions();
      console.log('Tab changed');
    });

    // Listen for tab URL updates
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        await updatePageIndicator();
        await updateQuickActions();
        console.log('URL changed');
      }
    });

    // Populate model dropdown
    await populateModelDropdown(modelSelect, configUI);

    // Check if current model is configured
    const isConfigured = await configUI.isCurrentModelConfigured();

    // Disable chat if model not configured
    if (!isConfigured) {
      setChatDisabled(true);
    } else {
      setChatDisabled(false);
    }

    // Enable chat immediately
    promptField.focus();

    // Set up unified chat handler
    form.onsubmit = async (e) => {
      e.preventDefault();
      const userPrompt = promptField.value.trim();
      if (!userPrompt) return;

      // Add user message to chatbox
      const userMessageDiv = document.createElement('div');
      userMessageDiv.className = 'chat-message user-message';
      userMessageDiv.textContent = userPrompt;
      chatBox.appendChild(userMessageDiv);
      promptField.value = '';
      setChatDisabled(true);
      setChatLoading(true);

      // Check if this is an action command
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isActionResponse = await chrome.tabs.sendMessage(tab.id, {
          action: 'is_action_command',
          input: userPrompt
        });

        if (isActionResponse && isActionResponse.isAction) {
          console.log('Detected action command, routing to action system');

          // Execute action in content script
          const actionResponse = await chrome.tabs.sendMessage(tab.id, {
            action: 'execute_action',
            command: userPrompt
          });

          // Add action result to chatbox
          const actionMessageDiv = document.createElement('div');
          actionMessageDiv.className = 'chat-message ai-message';

          if (actionResponse.success) {
            actionMessageDiv.textContent = `✓ ${actionResponse.message}`;
          } else {
            // Use message field for errors (consistent with content.js response format)
            const errorMessage = actionResponse.message || actionResponse.error || 'Action failed';
            actionMessageDiv.textContent = `✗ ${errorMessage}`;
          }

          chatBox.appendChild(actionMessageDiv);
          chatBox.scrollTop = chatBox.scrollHeight;

          // Re-enable chat
          setChatLoading(false);
          setChatDisabled(false);
          promptField.focus();
          return; // Don't proceed to regular chat
        }
      } catch (error) {
        console.log('Action check failed, proceeding as regular chat:', error);
        // If action check fails, proceed with regular chat
      }

      // Build system prompt and user prompt based on conversation history
      let systemPrompt = `You are a helpful assistant. Answer the user's question based on the conversation history.`;
      let chatUserPrompt;

      // Build conversation with history
      if (conversationHistory.length > 0) {
        let conversationContext = `--- CONVERSATION HISTORY ---\n`;
        for (const turn of conversationHistory) {
          conversationContext += `User: ${turn.user}\nAssistant: ${turn.assistant}\n\n`;
        }
        conversationContext += `-----------------------\n\n`;
        conversationContext += `User: ${userPrompt}\n\nYour Answer:`;
        chatUserPrompt = conversationContext;
      } else {
        chatUserPrompt = userPrompt;
      }

      console.log(`Getting response from model (history length: ${conversationHistory.length})`);
      try {
        const aiResponse = await BackgroundAPI.chat(systemPrompt, chatUserPrompt);
        const cleanedResponse = aiResponse.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        console.log(`Cleaned response: ${cleanedResponse}`);

        // Add to conversation history
        conversationHistory.push({
          user: userPrompt,
          assistant: cleanedResponse
        });

        // Add AI message to chatbox
        const aiMessageDiv = document.createElement('div');
        aiMessageDiv.className = 'chat-message ai-message';
        renderContent(aiMessageDiv, cleanedResponse || "I'm not sure how to respond to that.");
        chatBox.appendChild(aiMessageDiv);
        chatBox.scrollTop = chatBox.scrollHeight;
      } catch (error) {
        console.error('Error generating chat response:', error);
        const errorDiv = document.createElement('div');
        errorDiv.className = 'chat-message ai-message';
        errorDiv.textContent = `Error: ${error.message}`;
        chatBox.appendChild(errorDiv);
      }

      // Re-enable chat
      setChatLoading(false);
      setChatDisabled(false);
      promptField.focus();
    };

    // Clear chat button handler
    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
      clearChatBtn.addEventListener('click', () => {
        // Clear the chat box
        chatBox.innerHTML = '';

        // Clear conversation history
        conversationHistory = [];

        console.log('Chat cleared');

        // Focus back on input
        promptField.focus();
      });
    }

    console.log("Initialization complete!");

  } catch (error) {
    console.error("Fatal error during initialization:", error);
    // Don't block the UI - show error but allow retry
    const summaryEl = document.getElementById('summary');
    if (summaryEl) {
      summaryEl.textContent = `Initialization error: ${error.message}. Please try reloading the extension.`;
    }
  }
});
