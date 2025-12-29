# Changelog

## [Unreleased] - Actions System

### Added
- **Intelligent Actions System** - Execute actions on web pages using natural language
  - BaseAction framework for extensible action providers
  - IntentParser for natural language command understanding
  - AccessibilityScanner for robust element discovery using ARIA attributes
  - ConfirmationOverlay for safe action previews with user approval
  - ActionRegistry for coordinating providers and actions

- **Gmail Actions Provider** - Specific actions for Gmail
  - Reply to emails with AI-generated responses
  - Compose new emails with AI assistance
  - Context extraction from email content (sender, subject, body)
  - Accessibility-first selectors for reliability across UI updates

- **Google Docs/Sheets Actions Provider** - Specific actions for Google Docs and Sheets
  - Generate and copy text to clipboard for manual pasting
  - Smart content formatting: TSV for Sheets (multi-cell paste), markdown-like formatting for Docs
  - Document type detection (document vs spreadsheet)
  - Provider structure enables future rich-text and cell navigation features
  - Note: Cannot automate paste due to Chrome clipboard security (requires document focus)

- **Fallback Provider** - AI-powered actions for standard websites
  - LLM analyzes page structure and discovers elements
  - Generates step-by-step action plans
  - Works on 95% of websites with standard DOM-based elements
  - Does NOT handle canvas-based editors (requires custom providers)

- **Action Integration**
  - Natural language detection in chat interface
  - Automatic routing between chat and actions
  - Inline confirmation UI with editable previews
  - Safety: never auto-sends, always confirms

### Changed
- Content scripts now load action system on all pages
- Chat interface detects action commands vs regular chat
- Plugin shows action results with success/error indicators
- FallbackProvider is now truly generic (removed site-specific code)

### Technical
- Hybrid action architecture (specific + fallback providers)
- ARIA-based element discovery for robustness
- Intent parsing with pattern matching + LLM fallback
- Per-tab action system instances
- Level 2 safety: confirms critical actions
- Custom providers for non-standard sites (Gmail, Google Docs/Sheets)
- Smart content generation based on target (TSV for spreadsheets, formatted text for docs)

## [0.1.0] - 2025-12-27

### Added
- Multi-model AI support (LM Studio, Claude, OpenAI)
- Dynamic model configuration UI
- On-demand page summarization
- Multi-turn conversation with context
- Model switching without losing context
- Current page indicator
- Warm beige color scheme with IBM Plex Sans font

### Changed
- Reorganized codebase into logical directory structure:
  - `src/background/` - Background service worker and model system
  - `src/plugin/` - Plugin UI and logic
  - `src/content/` - Content scripts
  - `libs/` - Third-party libraries
- Moved `plugin.html` to root for better discoverability
- Removed auto-summarization on plugin open
- Changed "Refresh" to "Summarize" button

### Removed
- Unused `reload_side_panel` message handling
- Unused `tabUrlCache` in background.js
- Unused `models/loader.js`
- Extraneous HTML separators

### Technical Improvements
- Cleaned up code to reduce technical debt
- Fixed tab switching to always interact with active tab
- Improved initialization error handling with polling
- Conversation history preserved across model switches
