/**
 * Actions Loader - Loads all action system files
 *
 * This file is loaded by content scripts to initialize the action system.
 * It loads all necessary files in the correct order.
 */

(function() {
  console.log('[Browser Assistant] Loading action system...');

  // Files are loaded in dependency order via manifest.json
  // This file just initializes the system once everything is loaded

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeActions);
  } else {
    initializeActions();
  }

  function initializeActions() {
    console.log('[Browser Assistant] Action system ready');

    // Notify that actions are available
    window.dispatchEvent(new CustomEvent('browser-assistant-actions-ready'));
  }
})();
