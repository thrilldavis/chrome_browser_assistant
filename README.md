# Browser Assistant

A Chrome browser extension that lets you chat with AI about web pages and get intelligent summaries of any content you're viewing.

## What It Does

Browser Assistant adds an AI-powered side panel to Chrome that can:

- **Summarize web pages** - Extract and summarize the main content from any webpage using intelligent content parsing (powered by Readability.js)
- **Chat about pages** - Have multi-turn conversations with AI about the current page's content
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

1. Navigate to any webpage
2. Click the extension icon to open the side panel
3. **To chat about the page**: Click "Summarize" first to give the AI context about the page
4. **To chat generally**: Just start typing in the chat box
5. Have a conversation - the AI remembers the context of your discussion

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

#### Interactive Actions
- **Click elements**: "Click the login button"
- **Fill forms**: "Fill out this form with my information"
- **Navigate pages**: "Go to the next page" or "Scroll to the comments"
- **Extract data**: "Get all the links from this page"

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
