# Browser Assistant

A Chrome browser extension that lets you chat with AI about web pages and get intelligent summaries of any content you're viewing.

## What It Does

Browser Assistant adds an AI-powered side panel to Chrome that can:

- **Summarize web pages** - Extract and summarize the main content from any webpage using intelligent content parsing (powered by Readability.js)
- **Chat about pages** - Have multi-turn conversations with AI about the current page's content
- **Execute actions** - Perform actions on web pages with natural language commands (reply to emails, compose messages, and more)
- **General chat** - Use it as a general AI assistant even without page context
- **Switch models on the fly** - Change between different AI models without losing your conversation history

## Features

### Multi-Model Support
Choose from multiple AI providers:
- **LM Studio** - Run models locally on your machine
- **Claude** (Anthropic) - Use Claude models via API
- **OpenAI** - Use GPT models via API

### Smart Page Understanding
- Automatically extracts main content from web pages (articles, blog posts, documentation)
- Filters out navigation, ads, and other non-content elements
- Provides clean, focused summaries

### Conversation Context
- Maintains conversation history across multiple turns
- Preserves context when switching between AI models
- Tracks the current page you're viewing

### User-Friendly Interface
- Clean, warm beige color scheme with IBM Plex Sans font
- Side panel design keeps your browsing uninterrupted
- Current page indicator shows which page you're chatting about
- Visual feedback for loading states

### Intelligent Actions System (NEW!)
Execute actions on web pages using natural language commands.

#### Supported Sites

**Gmail Actions:**
- **Reply to emails**: Type "reply to this email" to generate an AI-powered response
- **Compose emails**: Type "compose email to john@example.com about the project" to draft new messages
- Uses accessibility-first approach for reliability across Gmail UI updates

**Google Docs/Sheets Actions:**
- **Write text**: Type "write a summary of the project in the document" to add text
- **How it works**: Due to Chrome's clipboard security restrictions (documents lose focus when you interact with the extension), the action copies generated text to your clipboard and prompts you to paste manually with Cmd+V/Ctrl+V
- **Why a custom provider**: Google Docs uses canvas-based rendering (text is pixels, not DOM). While we currently copy to clipboard, this provider structure enables future enhancements like rich formatting, cell navigation in Sheets, and structured data pasting
- **What we tried**: Automated approaches tested included `document.execCommand('insertText')`, clipboard paste with keyboard simulation, File menu refocusing tricks, and character-by-character keyboard events - all failed due to Chrome's security model requiring document focus for clipboard access

**Generic Actions (Any Website):**
- Works on 95% of websites with standard DOM-based text inputs and buttons
- AI analyzes the page structure and generates action plans
- Example: "fill in the contact form with my details"
- Example: "click the submit button"

#### Provider Architecture

**Why Custom Providers?**

This extension uses a hybrid architecture with three types of action providers:

1. **Specific Providers** (Gmail, Google Docs/Sheets)
   - Built for sites with unique interfaces
   - More reliable and feature-rich
   - Required when sites don't use standard web elements

2. **Fallback Provider** (Generic)
   - Works on most standard websites
   - Uses ARIA accessibility attributes to discover elements
   - Handles standard inputs, buttons, and forms

**When We Build Custom Providers:**

We create custom providers for sites that use non-standard rendering:

- **Gmail**: Complex interface with dynamic elements - custom provider ensures reliability
- **Google Docs/Sheets**: Canvas-based rendering - text is pixels, not DOM elements - requires keyboard simulation
- **Future**: Salesforce, ServiceNow, Figma, etc. - each has unique requirements

Most websites use standard HTML elements and work perfectly with the generic fallback provider.

**How Actions Work:**
1. Type a natural language command (e.g., "reply to this email saying I'll be out of office")
2. AI analyzes your intent and the page context
3. Generates appropriate content
4. Shows you a confirmation overlay with editable preview
5. Executes the action only after your approval

**Safety Features:**
- Always shows confirmation before executing
- Never auto-sends emails - only fills compose areas
- All generated content is editable before applying
- Uses ARIA accessibility attributes for robust, reliable interactions

## Installation

1. Clone or download this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top-right corner)
4. Click "Load unpacked"
5. Select the `chrome_browser_assistant` directory

## Setup

### Configure Your AI Model

1. Click the extension icon in Chrome to open the side panel
2. Select your preferred model from the dropdown (LM Studio, Claude, or OpenAI)
3. Click the ⚙️ Configure button
4. Enter your API credentials:
   - **LM Studio**: Endpoint URL (default: `http://localhost:1234/v1/chat/completions`)
   - **Claude**: API key from [console.anthropic.com](https://console.anthropic.com/)
   - **OpenAI**: API key from [platform.openai.com](https://platform.openai.com/)

### Using the Extension

**Basic Usage:**
1. Navigate to any webpage
2. Click the extension icon to open the side panel
3. **To chat about the page**: Click "Summarize" first to give the AI context about the page
4. **To chat generally**: Just start typing in the chat box
5. Have a conversation - the AI remembers the context of your discussion

**Using Actions:**

*Gmail Example:*
1. Open Gmail and view an email
2. Open the Browser Assistant side panel
3. Type an action command:
   - "reply to this email"
   - "reply saying I'll be out of office next week"
   - "compose email to john@example.com about the project update"
4. Review the AI-generated content in the confirmation overlay
5. Edit if needed, then click "Apply" to fill Gmail's compose area
6. Review in Gmail and send when ready

*Google Docs Example:*
1. Open a Google Doc or Sheet
2. Place your cursor where you want the text to appear
3. Open the Browser Assistant side panel
4. Type an action command:
   - "write a brief summary of the meeting"
   - "write hello world in the document"
   - "add a list of project milestones"
5. Review the AI-generated text in the confirmation overlay
6. Edit if needed, then click "Copy & Close"
7. Paste into your document with Cmd+V (Mac) or Ctrl+V (Windows)

## Known Limitations

### Content Script Loading
- **Page reload required**: After installing or reloading the extension, you must reload any open tabs before the summarization feature will work
- **How to fix**: Simply refresh (F5 or Cmd+R) the webpage you want to summarize

### Restricted Pages
The extension cannot access content from certain Chrome system pages:
- `chrome://` URLs (extensions, settings, etc.)
- `chrome-extension://` URLs
- `edge://` URLs (if using Edge)
- Some security-restricted domains

**Workaround**: The extension works perfectly on regular websites (news sites, blogs, documentation, articles, etc.)

### API Requirements
- **LM Studio**: Requires LM Studio running locally with a loaded model
- **Claude/OpenAI**: Requires valid API keys and may incur usage costs

## Future Updates

### Planned Features

#### Expanded Actions
- **Salesforce integration**: Add notes, update opportunities, create tasks
- **ServiceNow integration**: Update incidents, add comments, resolve tickets
- **Dynamic actions**: AI-powered actions on any website (partially implemented)
- **Form automation**: Fill complex forms with AI assistance
- **Data extraction**: Extract and format data from tables and lists

#### Enhanced Understanding
- **Multi-page context**: Summarize and remember content across multiple tabs
- **PDF support**: Summarize PDF documents in addition to web pages
- **Screenshot analysis**: Understand and describe images and screenshots
- **Video transcription**: Get summaries of YouTube videos and other video content

#### Advanced Features
- **Custom prompts**: Save and reuse common prompts
- **Export conversations**: Save chat history and summaries
- **Keyboard shortcuts**: Quick access to common actions
- **Dark mode**: Toggle between light and dark themes

#### Developer Features
- **Plugin system**: Allow custom actions and integrations
- **Local-only mode**: Run completely offline with local models
- **Data privacy controls**: Fine-grained control over what data is sent to AI models

## Technical Details

### Architecture
```
chrome_browser_assistant/
├── src/
│   ├── actions/        # Action system (NEW!)
│   │   ├── base/       # BaseAction class
│   │   ├── core/       # Registry, scanner, parser
│   │   ├── ui/         # Confirmation overlays
│   │   └── providers/  # Site-specific & fallback providers
│   │       ├── gmail/         # Gmail-specific actions
│   │       ├── googledocs/    # Google Docs/Sheets actions
│   │       └── fallback/      # Generic actions for any site
│   ├── background/     # Service worker & model registry
│   ├── plugin/         # Side panel UI & logic
│   └── content/        # Content extraction scripts
├── libs/               # Third-party libraries
├── icons/              # Extension icons
└── plugin.html         # Main UI entry point
```

### Built With
- Chrome Extension Manifest V3
- Readability.js for content extraction
- Marked.js for Markdown rendering
- DOMPurify for content sanitization

## Privacy & Security

- **Local processing**: Page content is extracted locally in your browser
- **API calls**: Use the API you want to, either local or remote
- **No tracking**: This extension does not collect or transmit any analytics or usage data
- **Your API keys**: Stored locally in Chrome's storage API, never transmitted elsewhere

## Contributing

This is a personal project, but suggestions and feedback are welcome! Feel free to open issues for bugs or feature requests.

## License

Apache 2.0 license

## Version

Current version: 0.1.0 (December 2025)

See [CHANGELOG.md](CHANGELOG.md) for release history.
