/**
 * ConfirmationOverlay - Inline overlay for confirming actions
 *
 * Shows a confirmation dialog overlaid on the page where the action
 * will be performed, allowing users to preview and edit before executing.
 */
class ConfirmationOverlay {
  constructor() {
    this.overlay = null;
    this.resolve = null;
    this.reject = null;
  }

  /**
   * Show confirmation overlay
   * @param {Object} options - Configuration options
   * @returns {Promise<Object>} User's decision
   */
  show(options) {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      this.createOverlay(options);
      document.body.appendChild(this.overlay);

      // Focus on the content area if editable
      const contentArea = this.overlay.querySelector('.overlay-content-editable');
      if (contentArea) {
        contentArea.focus();
        // Select all text for easy editing
        contentArea.select();
      }
    });
  }

  /**
   * Create the overlay DOM structure
   * @param {Object} options
   */
  createOverlay(options) {
    const {
      action = 'Action',
      content = '',
      editable = true,
      target = null,
      warning = null,
      buttonText = 'Apply'
    } = options;

    this.overlay = document.createElement('div');
    this.overlay.className = 'browser-assistant-overlay';
    this.overlay.innerHTML = `
      <div class="overlay-backdrop"></div>
      <div class="overlay-dialog">
        <div class="overlay-header">
          <h3>${this.escapeHtml(action)}</h3>
          <button class="overlay-close" aria-label="Close">×</button>
        </div>
        <div class="overlay-body">
          ${warning ? `<div class="overlay-warning">${this.escapeHtml(warning)}</div>` : ''}
          ${editable ? `
            <textarea class="overlay-content-editable" rows="10">${this.escapeHtml(content)}</textarea>
          ` : `
            <div class="overlay-content-preview">${this.escapeHtml(content)}</div>
          `}
          ${target ? `
            <div class="overlay-target">
              <strong>Will be applied to:</strong> ${this.escapeHtml(target)}
            </div>
          ` : ''}
        </div>
        <div class="overlay-footer">
          <button class="overlay-btn overlay-btn-cancel">Cancel</button>
          <button class="overlay-btn overlay-btn-primary overlay-btn-approve">${this.escapeHtml(buttonText)}</button>
        </div>
      </div>
    `;

    // Add styles
    this.injectStyles();

    // Add event listeners
    this.attachEventListeners();
  }

  /**
   * Attach event listeners to overlay elements
   */
  attachEventListeners() {
    const closeBtn = this.overlay.querySelector('.overlay-close');
    const cancelBtn = this.overlay.querySelector('.overlay-btn-cancel');
    const approveBtn = this.overlay.querySelector('.overlay-btn-approve');
    const backdrop = this.overlay.querySelector('.overlay-backdrop');

    closeBtn.addEventListener('click', () => this.cancel());
    cancelBtn.addEventListener('click', () => this.cancel());
    approveBtn.addEventListener('click', () => this.approve());
    backdrop.addEventListener('click', () => this.cancel());

    // Escape key to cancel
    const handleKeydown = (e) => {
      if (e.key === 'Escape') {
        this.cancel();
      }
    };
    document.addEventListener('keydown', handleKeydown);

    // Store handler for cleanup
    this.overlay._keydownHandler = handleKeydown;
  }

  /**
   * User approved the action
   */
  approve() {
    const contentArea = this.overlay.querySelector('.overlay-content-editable');
    const content = contentArea ? contentArea.value : null;

    this.close();
    this.resolve({
      approved: true,
      content: content
    });
  }

  /**
   * User cancelled the action
   */
  cancel() {
    this.close();
    this.resolve({
      approved: false,
      content: null
    });
  }

  /**
   * Close and cleanup overlay
   */
  close() {
    if (this.overlay && this.overlay.parentNode) {
      // Remove event listener
      if (this.overlay._keydownHandler) {
        document.removeEventListener('keydown', this.overlay._keydownHandler);
      }

      this.overlay.parentNode.removeChild(this.overlay);
      this.overlay = null;
    }
  }

  /**
   * Inject styles for the overlay
   */
  injectStyles() {
    // Check if styles are already injected
    if (document.getElementById('browser-assistant-overlay-styles')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'browser-assistant-overlay-styles';
    style.textContent = `
      .browser-assistant-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .overlay-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(2px);
      }

      .overlay-dialog {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        border-radius: 12px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }

      .overlay-header {
        padding: 20px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }

      .overlay-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      }

      .overlay-close {
        background: none;
        border: none;
        font-size: 28px;
        color: #666;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .overlay-close:hover {
        background: #f0f0f0;
        color: #333;
      }

      .overlay-body {
        padding: 20px;
        flex: 1;
        overflow-y: auto;
      }

      .overlay-warning {
        background: #fff3cd;
        border: 1px solid #ffc107;
        border-radius: 6px;
        padding: 12px;
        margin-bottom: 16px;
        color: #856404;
        font-size: 14px;
      }

      .overlay-content-editable {
        width: 100%;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: vertical;
        min-height: 150px;
      }

      .overlay-content-editable:focus {
        outline: none;
        border-color: #4285f4;
        box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.1);
      }

      .overlay-content-preview {
        padding: 12px;
        background: #f8f9fa;
        border-radius: 6px;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
      }

      .overlay-target {
        margin-top: 12px;
        padding: 10px;
        background: #e8f0fe;
        border-radius: 6px;
        font-size: 13px;
        color: #1967d2;
      }

      .overlay-footer {
        padding: 16px 20px;
        border-top: 1px solid #e0e0e0;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .overlay-btn {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
      }

      .overlay-btn-cancel {
        background: #f8f9fa;
        color: #333;
      }

      .overlay-btn-cancel:hover {
        background: #e8e8e8;
      }

      .overlay-btn-primary {
        background: #1a73e8;
        color: white;
      }

      .overlay-btn-primary:hover {
        background: #1557b0;
      }

      .overlay-btn-approve {
        min-width: 100px;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Escape HTML to prevent XSS
   * @param {string} html
   * @returns {string}
   */
  escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }
}
