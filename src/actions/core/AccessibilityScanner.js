/**
 * AccessibilityScanner - Scans pages for actionable elements using ARIA attributes
 *
 * This scanner uses accessibility attributes (ARIA) to find and identify
 * interactive elements on the page. This approach is more robust than
 * CSS selectors because accessibility attributes are semantic and less
 * likely to change across UI updates.
 */
class AccessibilityScanner {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5000; // Cache results for 5 seconds
  }

  /**
   * Scans the page for all actionable elements
   * @returns {Object} Categorized actionable elements
   */
  scanPage() {
    const cacheKey = 'full_scan';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    const actions = {
      buttons: this.findButtons(),
      inputs: this.findInputs(),
      links: this.findLinks(),
      regions: this.findRegions(),
      dialogs: this.findDialogs()
    };

    this.addToCache(cacheKey, actions);
    return actions;
  }

  /**
   * Find all buttons on the page
   * @returns {Array<Object>}
   */
  findButtons() {
    const buttons = [];
    const selectors = [
      '[role="button"]',
      'button',
      'input[type="button"]',
      'input[type="submit"]'
    ];

    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      if (!this.isVisible(el)) return;

      buttons.push({
        label: this.getAccessibleLabel(el),
        element: el,
        type: 'button',
        ariaLabel: el.getAttribute('aria-label'),
        id: el.id,
        class: el.className
      });
    });

    return buttons;
  }

  /**
   * Find all text inputs and textareas
   * @returns {Array<Object>}
   */
  findInputs() {
    const inputs = [];
    const selectors = [
      '[role="textbox"]',
      'textarea',
      'input[type="text"]',
      'input[type="email"]',
      '[contenteditable="true"]'
    ];

    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      if (!this.isVisible(el)) return;

      inputs.push({
        label: this.getAccessibleLabel(el),
        element: el,
        type: this.getInputType(el),
        ariaLabel: el.getAttribute('aria-label'),
        placeholder: el.getAttribute('placeholder'),
        id: el.id,
        class: el.className
      });
    });

    return inputs;
  }

  /**
   * Find all links
   * @returns {Array<Object>}
   */
  findLinks() {
    const links = [];

    document.querySelectorAll('a[href], [role="link"]').forEach(el => {
      if (!this.isVisible(el)) return;

      links.push({
        label: this.getAccessibleLabel(el) || el.textContent.trim(),
        element: el,
        type: 'link',
        href: el.getAttribute('href'),
        ariaLabel: el.getAttribute('aria-label')
      });
    });

    return links;
  }

  /**
   * Find major page regions
   * @returns {Array<Object>}
   */
  findRegions() {
    const regions = [];
    const selectors = [
      '[role="main"]',
      '[role="region"]',
      '[role="article"]',
      'main',
      'article'
    ];

    document.querySelectorAll(selectors.join(', ')).forEach(el => {
      regions.push({
        label: this.getAccessibleLabel(el) || 'Unnamed region',
        element: el,
        type: 'region',
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label')
      });
    });

    return regions;
  }

  /**
   * Find dialogs and modals
   * @returns {Array<Object>}
   */
  findDialogs() {
    const dialogs = [];

    document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog').forEach(el => {
      if (!this.isVisible(el)) return;

      dialogs.push({
        label: this.getAccessibleLabel(el) || 'Dialog',
        element: el,
        type: 'dialog',
        ariaLabel: el.getAttribute('aria-label'),
        modal: el.getAttribute('aria-modal') === 'true'
      });
    });

    return dialogs;
  }

  /**
   * Find element by accessible label
   * @param {string} label - Label to search for
   * @param {string} type - Element type (button, input, etc.)
   * @returns {Element|null}
   */
  findByLabel(label, type = null) {
    const normalizedLabel = label.toLowerCase().trim();

    // Try aria-label first
    let selector = `[aria-label*="${label}" i]`;
    if (type) {
      selector = `${type}${selector}, [role="${type}"]${selector}`;
    }

    let element = document.querySelector(selector);
    if (element && this.isVisible(element)) return element;

    // Try placeholder
    element = document.querySelector(`[placeholder*="${label}" i]`);
    if (element && this.isVisible(element)) return element;

    // Try text content for buttons
    const buttons = this.findButtons();
    const matchedButton = buttons.find(b =>
      b.label.toLowerCase().includes(normalizedLabel)
    );
    if (matchedButton) return matchedButton.element;

    return null;
  }

  /**
   * Get accessible label for an element
   * @param {Element} element
   * @returns {string}
   */
  getAccessibleLabel(element) {
    // Check aria-label
    if (element.hasAttribute('aria-label')) {
      return element.getAttribute('aria-label');
    }

    // Check aria-labelledby
    if (element.hasAttribute('aria-labelledby')) {
      const labelId = element.getAttribute('aria-labelledby');
      const labelEl = document.getElementById(labelId);
      if (labelEl) return labelEl.textContent.trim();
    }

    // Check associated label
    if (element.id) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent.trim();
    }

    // Check placeholder
    if (element.hasAttribute('placeholder')) {
      return element.getAttribute('placeholder');
    }

    // Check title
    if (element.hasAttribute('title')) {
      return element.getAttribute('title');
    }

    // Check text content for buttons
    if (element.tagName === 'BUTTON' || element.getAttribute('role') === 'button') {
      return element.textContent.trim();
    }

    return '';
  }

  /**
   * Get input type
   * @param {Element} element
   * @returns {string}
   */
  getInputType(element) {
    if (element.getAttribute('role') === 'textbox') return 'textbox';
    if (element.tagName === 'TEXTAREA') return 'textarea';
    if (element.getAttribute('contenteditable') === 'true') return 'contenteditable';
    return element.getAttribute('type') || 'text';
  }

  /**
   * Check if element is visible
   * @param {Element} element
   * @returns {boolean}
   */
  isVisible(element) {
    if (!element) return false;

    const style = window.getComputedStyle(element);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    if (style.opacity === '0') return false;

    const rect = element.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return false;

    return true;
  }

  /**
   * Cache management
   */
  getFromCache(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  addToCache(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  clearCache() {
    this.cache.clear();
  }
}
