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
    this.configureBtn.addEventListener('click', () => this.show());
    this.configCloseBtn.addEventListener('click', () => this.hide());
    this.configCancelBtn.addEventListener('click', () => this.hide());
    this.configSaveBtn.addEventListener('click', () => this.save());
    this.configWarningBtn.addEventListener('click', () => this.show());
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
    this.currentModelId = modelId || await BackgroundAPI.getCurrentModel();

    if (!this.currentModelId) {
      alert('Please select a model first');
      return;
    }

    // Get model info from background
    const models = await BackgroundAPI.getModelList();
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
 * @param {HTMLSelectElement} selectEl
 * @param {ConfigurationUI} configUI - Configuration UI instance
 */
async function populateModelDropdown(selectEl, configUI) {
  selectEl.innerHTML = '';

  // Get models from background
  const modelListResponse = await BackgroundAPI.getModelList();

  // Check if background isn't ready yet
  if (modelListResponse.error || !modelListResponse.models) {
    const opt = document.createElement('option');
    opt.disabled = true;
    opt.selected = true;
    opt.textContent = 'Initializing...';
    selectEl.appendChild(opt);
    selectEl.disabled = true;
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

    // Return null if no content available
    if (!response || !response.text || response.text.trim().length === 0) {
      console.warn('No text content in response');
      return null;
    }

    console.log(`Received ${response.text.length} characters of content`);
    return response.text;
  } catch (error) {
    console.error('Error retrieving page content:', error);
    console.error('Error details:', error.message, error.stack);
    return null;
  }
}

/* =========================
   Main Initialization
   ========================= */

document.addEventListener('DOMContentLoaded', async () => {
  console.log("Entering main initialization...");

  try {
    // Get all necessary DOM elements
    const summaryEl = document.getElementById('summary');
    const chatBox = document.getElementById('chat-box');
    const form = document.getElementById('chat-form');
    const promptField = document.getElementById('prompt');
    const summaryLoader = document.getElementById('summary-loader');
    const chatLoader = document.getElementById('chat-loader');
    const modelSelect = document.getElementById('model-select');
    const summarizeBtn = document.getElementById('summarize-btn');
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
    const setSummaryLoading = (isLoading) => {
      summaryLoader.style.display = isLoading ? 'block' : 'none';
      summaryEl.style.display = isLoading ? 'none' : 'block';
    };
    const setChatLoading = (isLoading) => {
      chatLoader.style.display = isLoading ? 'block' : 'none';
    };
    const setChatDisabled = (isDisabled) => {
      promptField.disabled = isDisabled;
      form.querySelector('button').disabled = isDisabled;
      promptField.placeholder = isDisabled ? 'Please wait...' : 'Ask anything…';
    };
    const setSummarizeDisabled = (isDisabled) => {
      if (summarizeBtn) {
        summarizeBtn.disabled = isDisabled;
      }
    };

    // Shared state for page content and summary
    let pageText = null;
    let pageSummary = null;

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

    // Update indicator on load
    await updatePageIndicator();

    // Listen for tab changes to update the indicator and clear cached content
    chrome.tabs.onActivated.addListener(async () => {
      await updatePageIndicator();
      // Clear cached page text so next summarize fetches from new tab
      pageText = null;
      console.log('Tab changed: cleared cached page text');
    });

    // Listen for tab URL updates
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.url && tab.active) {
        await updatePageIndicator();
        // Clear cached page text when URL changes
        pageText = null;
        console.log('URL changed: cleared cached page text');
      }
    });

    // Populate model dropdown
    await populateModelDropdown(modelSelect, configUI);

    // Check if current model is configured
    const isConfigured = await configUI.isCurrentModelConfigured();

    // Show initial message in summary area
    if (!isConfigured) {
      summaryEl.textContent = 'Please configure the selected model to start using the assistant.';
      setChatDisabled(true);
    } else {
      summaryEl.textContent = 'Click "Summarize" to generate a summary of this page, or start chatting below.';
      setChatDisabled(false);
    }

    // Add initial warning message to chat
    const initialWarningDiv = document.createElement('div');
    initialWarningDiv.className = 'chat-message ai-message';
    initialWarningDiv.innerHTML = `<strong>💡 Tip:</strong> To chat about the current page, click <strong>Summarize</strong> first to give me context about the page content. You can also chat with me about anything without summarizing.`;
    chatBox.appendChild(initialWarningDiv);

    // Enable chat immediately (no auto-summarization)
    promptField.focus();

    // Set up Summarize button
    if (summarizeBtn) {
      summarizeBtn.addEventListener('click', async () => {
        console.log('Summarize button clicked');

        // Check if model is configured
        const isConfigured = await configUI.isCurrentModelConfigured();
        if (!isConfigured) {
          summaryEl.textContent = 'Please configure the selected model before summarizing.';
          return;
        }

        setSummaryLoading(true);
        setSummarizeDisabled(true);
        setChatDisabled(true);

        // Get page content if not already loaded
        if (!pageText) {
          pageText = await getPageContent();
        }

        if (!pageText) {
          summaryEl.textContent = 'No content available to summarize on this page. This may be an empty page, a restricted page (like chrome:// URLs), or a page with no readable content.';
          setSummaryLoading(false);
          setSummarizeDisabled(false);
          setChatDisabled(false);
          return;
        }

        // Generate summary
        try {
          const fullSummary = await generateFullSummary(pageText);
          console.log("Generated summary: " + fullSummary);

          // Store summary for chat context
          pageSummary = fullSummary;

          // Remove all <think>...</think> blocks and their contents
          const cleanedSummary = fullSummary.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
          console.log(`Cleaned summary: ${cleanedSummary}`);
          renderContent(summaryEl, cleanedSummary);
        } catch (error) {
          console.error('Error generating summary:', error);
          summaryEl.textContent = `Error: ${error.message}`;
        }

        setSummaryLoading(false);
        setSummarizeDisabled(false);
        setChatDisabled(false);
        promptField.focus();
      });
    }

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

      // Build system prompt and user prompt based on available context
      let systemPrompt, chatUserPrompt;

      if (pageSummary) {
        // Chat with page summary context
        systemPrompt = `You are a helpful assistant. Answer the user's question based on the provided summary of a webpage.
If the summary does not contain the answer, you may use your general knowledge.`;

        // Build conversation context with history
        let conversationContext = `--- SUMMARY CONTEXT ---
${pageSummary}
-----------------------

`;

        // Add conversation history
        if (conversationHistory.length > 0) {
          conversationContext += `--- CONVERSATION HISTORY ---\n`;
          for (const turn of conversationHistory) {
            conversationContext += `User: ${turn.user}\nAssistant: ${turn.assistant}\n\n`;
          }
          conversationContext += `-----------------------\n\n`;
        }

        conversationContext += `User Question: "${userPrompt}"\n\nYour Answer:`;
        chatUserPrompt = conversationContext;
      } else {
        // Chat without page context (general assistant)
        systemPrompt = `You are a helpful assistant. Answer the user's question to the best of your ability.`;

        // Build conversation with history only
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
      }

      console.log(`Getting response from model (with context: ${!!pageSummary}, history length: ${conversationHistory.length})`);
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
