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

- **Fallback Provider** (Partial) - AI-powered actions for unknown sites
  - LLM analyzes page structure
  - Generates step-by-step action plans
  - Generic actions on any website (in development)

- **Action Integration**
  - Natural language detection in chat interface
  - Automatic routing between chat and actions
  - Inline confirmation UI with editable previews
  - Safety: never auto-sends, always confirms

### Changed
- Content scripts now load action system on all pages
- Chat interface detects action commands vs regular chat
- Plugin shows action results with success/error indicators

### Technical
- Hybrid action architecture (specific + fallback providers)
- ARIA-based element discovery for robustness
- Intent parsing with pattern matching + LLM fallback
- Per-tab action system instances
- Level 2 safety: confirms critical actions

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
