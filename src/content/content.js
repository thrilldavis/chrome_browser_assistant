// content.js
console.log('content.js loaded');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Ping-pong to check if content script is loaded
  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return true;
  }

  if (request.action === 'get_page_text') {
    // Handle extraction asynchronously
    (async () => {
      try {
        // Check if this is a PDF file
        const pdfExtractor = new PDFExtractor();

        if (pdfExtractor.isPDF()) {
          console.log('content.js: PDF detected, extracting text...');

          const pdfUrl = pdfExtractor.getPDFUrl();
          if (!pdfUrl) {
            sendResponse({
              text: '',
              html: '',
              title: document.title || '',
              isPDF: true,
              error: 'Could not determine PDF URL'
            });
            return;
          }

          const result = await pdfExtractor.extractText(pdfUrl);

          if (result.success) {
            console.log(`content.js: PDF extraction successful - ${result.text.length} characters`);
            sendResponse({
              text: result.text,
              html: '',
              title: result.title,
              isPDF: true,
              pageCount: result.pageCount
            });
          } else {
            console.error('content.js: PDF extraction failed:', result.error);
            sendResponse({
              text: '',
              html: '',
              title: result.title,
              isPDF: true,
              error: result.error || 'Failed to extract PDF text'
            });
          }
          return;
        }

        // Check if this is a Google Workspace document
        const workspaceExtractor = new GoogleWorkspaceExtractor();

        if (workspaceExtractor.isGoogleWorkspace()) {
          console.log('content.js: Google Workspace document detected, extracting content...');

          const result = await workspaceExtractor.extractContent();

          if (result.success && result.text) {
            console.log(`content.js: Google Workspace extraction successful - ${result.text.length} characters`);
            sendResponse({
              text: result.text,
              html: '',
              title: result.title,
              isGoogleWorkspace: true,
              workspaceType: result.type,
              ...result
            });
          } else {
            console.error('content.js: Google Workspace extraction failed:', result.error);
            sendResponse({
              text: '',
              html: '',
              title: result.title,
              isGoogleWorkspace: true,
              error: result.error || 'Failed to extract Google Workspace content'
            });
          }
          return;
        }

        // 1) Prefer Readability (works on a cloned DOM to avoid mutating the page)
        const docClone = document.cloneNode(true);
        const article = new Readability(docClone).parse(); // requires Readability to be injected first

        if (article && (article.textContent || article.content)) {
          console.log(`content.js: article text from Readability`);
          // Return both plain text and HTML for flexible rendering in the plugin
          sendResponse({
            text: article.textContent || '',
            html: article.content || '',
            title: article.title || '',
            excerpt: article.excerpt || '',
            byline: article.byline || ''
          });
          return;
        }

        console.log(`content.js: article text from fallback`);
        // 2) Fallbacks: try semantic containers before body
        const mainEl =
          document.querySelector('main, article, [role="main"]') ||
          // looser fallback: the largest texty section among common containers
          [...document.querySelectorAll('article, main, #content, .content, .post, section')]
            .sort((a, b) => (b.innerText || '').length - (a.innerText || '').length)[0];

        const fallbackText = (mainEl?.innerText || document.body.innerText || '').trim();
        sendResponse({ text: fallbackText, html: '', title: document.title || '' });
      } catch (e) {
        console.error('Extraction error:', e);
        sendResponse({ text: (document.body.innerText || '').trim(), html: '', title: document.title || '' });
      }
    })();

    return true; // Required for async sendResponse
  }

  // Handle action execution requests
  if (request.action === 'execute_action') {
    // Execute asynchronously
    (async () => {
      try {
        const registry = window.browserAssistantActionRegistry;
        if (!registry) {
          sendResponse({
            success: false,
            error: 'Action system not initialized'
          });
          return;
        }

        // Ensure registry is initialized before accessing actions
        await registry.initialize();

        let result;

        // Check if this is a direct action execution (from quick action button)
        // or a command-based execution (from chat)
        if (request.actionKey) {
          // Direct action execution - get the action by key and run it
          console.log('content.js: Executing action by key:', request.actionKey, 'with input:', request.userInput);

          const action = registry.actions.get(request.actionKey);
          if (!action) {
            sendResponse({
              success: false,
              error: `Action '${request.actionKey}' not found`
            });
            return;
          }

          result = await action.run(request.userInput || '');
        } else if (request.command) {
          // Command-based execution - parse and execute
          console.log('content.js: Executing action command:', request.command);
          result = await registry.handleCommand(request.command);
        } else {
          sendResponse({
            success: false,
            error: 'Missing actionKey or command'
          });
          return;
        }

        sendResponse({
          success: result.success,
          message: result.message,
          data: result.data
        });
      } catch (error) {
        console.error('Error executing action:', error);
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();

    return true; // Indicate async response
  }

  // Check if input is an action command
  if (request.action === 'is_action_command') {
    const registry = window.browserAssistantActionRegistry;
    if (registry) {
      const isAction = registry.isActionCommand(request.input);
      sendResponse({ isAction: isAction });
    } else {
      sendResponse({ isAction: false });
    }
    return true;
  }
});
