# Changelog

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
