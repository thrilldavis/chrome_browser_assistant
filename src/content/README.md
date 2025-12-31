# Content Extractors Guide

This directory contains content extractors that extract text and context from different types of web content (PDFs, Google Docs, regular web pages, etc.).

## Table of Contents

- [Overview](#overview)
- [How Extractors Work](#how-extractors-work)
- [Creating a New Extractor](#creating-a-new-extractor)
- [Complete Examples](#complete-examples)
- [Integration](#integration)
- [Best Practices](#best-practices)

## Overview

Content extractors are specialized classes that:
1. **Detect** if they can handle the current page
2. **Extract** relevant content from the page
3. **Return** structured data (title, text, metadata)

The extension uses these extractors when users click "Summarize" to get page content for the AI model.

## How Extractors Work

### Execution Flow

```
User clicks Summarize
    ↓
content.js receives request
    ↓
Tries extractors in order:
    1. PDFExtractor
    2. GoogleWorkspaceExtractor
    3. Default HTML extraction
    ↓
Returns extracted content
    ↓
Sent to AI model for summarization
```

### Extractor Interface

Each extractor should implement:

```javascript
class YourExtractor {
  // Check if this extractor can handle the current page
  canExtract() {
    return boolean;
  }

  // Extract content from the page
  async extract() {
    return {
      title: string,
      content: string,
      metadata: object
    };
  }
}
```

## Creating a New Extractor

### Step 1: Create Your Extractor File

Create a new file: `your-extractor.js`

```javascript
/**
 * YourExtractor - Extract content from [specific type of page]
 *
 * [Describe what this extractor handles]
 */

console.log('[Browser Assistant] your-extractor.js loaded');

class YourExtractor {
  constructor() {
    // Initialize any required libraries or state
  }

  /**
   * Check if this extractor can handle the current page
   * @returns {boolean}
   */
  canExtract() {
    // Return true if this page can be handled by this extractor
    // Examples:
    // - Check URL pattern
    // - Check for specific DOM elements
    // - Check document type

    return window.location.hostname.includes('example.com');
  }

  /**
   * Extract content from the current page
   * @returns {Promise<Object>} - Extracted content
   */
  async extract() {
    try {
      // Extract title
      const title = this.extractTitle();

      // Extract main content
      const content = this.extractContent();

      // Extract metadata
      const metadata = this.extractMetadata();

      return {
        title: title,
        content: content,
        metadata: metadata
      };

    } catch (error) {
      console.error('[YourExtractor] Error:', error);
      throw error;
    }
  }

  /**
   * Extract the page title
   * @returns {string}
   */
  extractTitle() {
    // Try multiple methods to get the title
    return document.title || 'Untitled';
  }

  /**
   * Extract the main content
   * @returns {string}
   */
  extractContent() {
    // Implement your content extraction logic
    const element = document.querySelector('.main-content');
    if (element) {
      return element.innerText;
    }
    return '';
  }

  /**
   * Extract metadata about the page
   * @returns {Object}
   */
  extractMetadata() {
    return {
      url: window.location.href,
      timestamp: new Date().toISOString(),
      // Add any other relevant metadata
    };
  }
}

// Make it available globally
if (typeof window !== 'undefined') {
  window.yourExtractor = new YourExtractor();
}
```

### Step 2: Add to manifest.json

Add your extractor to the content_scripts array:

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": [
    "libs/pdf.min.js",
    "src/content/pdf-extractor.js",
    "src/content/google-workspace-extractor.js",
    "src/content/your-extractor.js",  // Add here
    "src/content/content.js"
  ]
}]
```

**Important**: Add your extractor BEFORE `content.js` so it's available when content.js runs.

### Step 3: Use in content.js

Modify `content.js` to try your extractor:

```javascript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPageContent') {
    (async () => {
      try {
        let result;

        // Try PDF extractor
        if (window.pdfExtractor && window.pdfExtractor.isPDF()) {
          result = await window.pdfExtractor.extractText();
        }
        // Try Google Workspace extractor
        else if (window.googleWorkspaceExtractor && window.googleWorkspaceExtractor.canExtract()) {
          result = await window.googleWorkspaceExtractor.extract();
        }
        // Try your new extractor
        else if (window.yourExtractor && window.yourExtractor.canExtract()) {
          result = await window.yourExtractor.extract();
        }
        // Default HTML extraction
        else {
          result = {
            title: document.title,
            content: document.body.innerText,
            url: window.location.href
          };
        }

        sendResponse({
          success: true,
          data: result
        });

      } catch (error) {
        sendResponse({
          success: false,
          error: error.message
        });
      }
    })();
    return true;
  }
});
```

## Complete Examples

### Example 1: Simple DOM-Based Extractor

Extract content from a specific website with known structure:

```javascript
/**
 * MediumExtractor - Extract article content from Medium.com
 *
 * Extracts clean article text, title, and author information
 * from Medium blog posts.
 */

console.log('[Browser Assistant] medium-extractor.js loaded');

class MediumExtractor {
  constructor() {
    this.selectors = {
      article: 'article',
      title: 'h1',
      content: 'article section',
      author: '[data-testid="authorName"]',
      publishDate: '[data-testid="storyPublishDate"]'
    };
  }

  canExtract() {
    return window.location.hostname.includes('medium.com') ||
           window.location.hostname.includes('medium.dev');
  }

  async extract() {
    const article = document.querySelector(this.selectors.article);
    if (!article) {
      throw new Error('Could not find article content');
    }

    const title = this.extractTitle();
    const content = this.extractContent(article);
    const metadata = this.extractMetadata();

    return {
      title: title,
      content: content,
      metadata: metadata
    };
  }

  extractTitle() {
    const titleElement = document.querySelector(this.selectors.title);
    return titleElement ? titleElement.innerText.trim() : document.title;
  }

  extractContent(article) {
    // Get all content sections
    const sections = article.querySelectorAll(this.selectors.content);

    let content = [];
    sections.forEach(section => {
      // Skip comments and other non-article elements
      if (!section.closest('[data-testid="comments"]')) {
        content.push(section.innerText.trim());
      }
    });

    return content.join('\n\n');
  }

  extractMetadata() {
    const author = document.querySelector(this.selectors.author);
    const publishDate = document.querySelector(this.selectors.publishDate);

    return {
      url: window.location.href,
      author: author ? author.innerText.trim() : 'Unknown',
      publishDate: publishDate ? publishDate.innerText.trim() : null,
      platform: 'Medium',
      timestamp: new Date().toISOString()
    };
  }
}

if (typeof window !== 'undefined') {
  window.mediumExtractor = new MediumExtractor();
}
```

### Example 2: API-Based Extractor

Extract content by calling an API or using special page features:

```javascript
/**
 * YouTubeExtractor - Extract video information from YouTube
 *
 * Extracts video title, description, transcript, and metadata
 * from YouTube video pages.
 */

console.log('[Browser Assistant] youtube-extractor.js loaded');

class YouTubeExtractor {
  canExtract() {
    return window.location.hostname.includes('youtube.com') &&
           window.location.pathname.includes('/watch');
  }

  async extract() {
    const videoId = this.getVideoId();

    return {
      title: this.extractTitle(),
      content: await this.extractDescription(),
      metadata: {
        videoId: videoId,
        url: window.location.href,
        channel: this.extractChannel(),
        views: this.extractViews(),
        uploadDate: this.extractUploadDate(),
        timestamp: new Date().toISOString()
      }
    };
  }

  getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('v');
  }

  extractTitle() {
    // YouTube uses various selectors for the title
    const titleSelectors = [
      'h1.ytd-video-primary-info-renderer',
      'h1 yt-formatted-string.ytd-watch-metadata',
      'h1.title'
    ];

    for (const selector of titleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.innerText.trim();
      }
    }

    return document.title.replace(' - YouTube', '');
  }

  async extractDescription() {
    // Click "Show more" button if it exists
    const showMoreButton = document.querySelector('#expand');
    if (showMoreButton) {
      showMoreButton.click();
      // Wait for content to expand
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const descriptionElement = document.querySelector(
      '#description-inline-expander yt-formatted-string'
    );

    return descriptionElement ? descriptionElement.innerText.trim() : '';
  }

  extractChannel() {
    const channelLink = document.querySelector('ytd-channel-name a');
    return channelLink ? channelLink.innerText.trim() : 'Unknown';
  }

  extractViews() {
    const viewsElement = document.querySelector(
      'ytd-watch-metadata span.view-count'
    );
    return viewsElement ? viewsElement.innerText.trim() : null;
  }

  extractUploadDate() {
    const dateElement = document.querySelector('#info-strings yt-formatted-string');
    return dateElement ? dateElement.innerText.trim() : null;
  }
}

if (typeof window !== 'undefined') {
  window.youtubeExtractor = new YouTubeExtractor();
}
```

### Example 3: Document Format Extractor

Extract content from a specific document format:

```javascript
/**
 * MarkdownExtractor - Extract content from rendered Markdown files
 *
 * Handles GitHub README files, GitLab markdown, and other
 * markdown rendering platforms.
 */

console.log('[Browser Assistant] markdown-extractor.js loaded');

class MarkdownExtractor {
  constructor() {
    this.platforms = {
      github: {
        hostnames: ['github.com'],
        selectors: {
          title: '.repository-content h1',
          content: '.markdown-body, article.markdown-body',
          fileName: '.final-path'
        }
      },
      gitlab: {
        hostnames: ['gitlab.com'],
        selectors: {
          title: '.file-title-name',
          content: '.md-preview',
          fileName: '.file-title-name'
        }
      }
    };
  }

  canExtract() {
    const hostname = window.location.hostname;

    // Check if we're on a supported platform
    for (const platform of Object.values(this.platforms)) {
      if (platform.hostnames.some(h => hostname.includes(h))) {
        // Check if there's markdown content
        const content = document.querySelector(platform.selectors.content);
        if (content) {
          return true;
        }
      }
    }

    return false;
  }

  async extract() {
    const platform = this.detectPlatform();
    const selectors = platform.selectors;

    return {
      title: this.extractTitle(selectors),
      content: this.extractContent(selectors),
      metadata: {
        url: window.location.href,
        platform: platform.name,
        fileName: this.extractFileName(selectors),
        timestamp: new Date().toISOString()
      }
    };
  }

  detectPlatform() {
    const hostname = window.location.hostname;

    for (const [name, platform] of Object.entries(this.platforms)) {
      if (platform.hostnames.some(h => hostname.includes(h))) {
        return { name, ...platform };
      }
    }

    return null;
  }

  extractTitle(selectors) {
    const titleElement = document.querySelector(selectors.title);
    if (titleElement) {
      return titleElement.innerText.trim();
    }

    const fileName = this.extractFileName(selectors);
    return fileName || document.title;
  }

  extractContent(selectors) {
    const contentElement = document.querySelector(selectors.content);
    if (!contentElement) {
      throw new Error('Could not find markdown content');
    }

    // Get clean text without code blocks' copy buttons etc.
    const clone = contentElement.cloneNode(true);

    // Remove unwanted elements
    const unwanted = clone.querySelectorAll(
      '.js-file-line-container, .zeroclipboard-container, button'
    );
    unwanted.forEach(el => el.remove());

    return clone.innerText.trim();
  }

  extractFileName(selectors) {
    const fileNameElement = document.querySelector(selectors.fileName);
    return fileNameElement ? fileNameElement.innerText.trim() : null;
  }
}

if (typeof window !== 'undefined') {
  window.markdownExtractor = new MarkdownExtractor();
}
```

## Integration

### Priority Order

Extractors are tried in the order they appear in `content.js`. Place more specific extractors before general ones:

```javascript
// Specific extractors first
if (window.pdfExtractor && window.pdfExtractor.isPDF()) {
  // Handle PDFs
}
else if (window.googleWorkspaceExtractor && window.googleWorkspaceExtractor.canExtract()) {
  // Handle Google Docs/Sheets/Slides
}
else if (window.mediumExtractor && window.mediumExtractor.canExtract()) {
  // Handle Medium articles
}
// General fallback last
else {
  // Default HTML extraction
}
```

### Error Handling

Always wrap extraction in try-catch:

```javascript
async extract() {
  try {
    // Extraction logic
    return { title, content, metadata };
  } catch (error) {
    console.error('[YourExtractor] Error:', error);
    // Either throw or return fallback
    throw error;
  }
}
```

## Best Practices

### Detection (canExtract)

- **Be specific**: Check hostname AND content structure
- **Be fast**: This runs on every page, keep it lightweight
- **Be reliable**: Use multiple indicators when possible

```javascript
canExtract() {
  // Good: Multiple checks
  return window.location.hostname.includes('example.com') &&
         document.querySelector('.article-content') !== null;

  // Bad: Too broad
  return true;
}
```

### Content Extraction

- **Clean the text**: Remove navigation, ads, UI elements
- **Preserve structure**: Keep paragraphs, headings if relevant
- **Handle missing elements**: Check for null before accessing

```javascript
extractContent() {
  const main = document.querySelector('main');
  if (!main) {
    throw new Error('Could not find main content');
  }

  // Remove unwanted elements
  const clone = main.cloneNode(true);
  clone.querySelectorAll('nav, aside, .ad').forEach(el => el.remove());

  return clone.innerText.trim();
}
```

### Performance

- **Avoid expensive operations**: Don't make unnecessary API calls
- **Use async when needed**: For waiting on dynamic content
- **Cache selectors**: Store frequently used selectors

```javascript
constructor() {
  // Cache selectors
  this.selectors = {
    title: 'h1.title',
    content: 'article.content',
    author: '.author-name'
  };
}
```

### Metadata

Include useful context:

```javascript
extractMetadata() {
  return {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    author: this.extractAuthor(),
    publishDate: this.extractDate(),
    wordCount: this.content.split(/\s+/).length,
    platform: 'Medium'
  };
}
```

## Testing Your Extractor

1. **Add to manifest.json** content_scripts
2. **Reload the extension** in `chrome://extensions`
3. **Navigate to a test page** that should trigger your extractor
4. **Open DevTools** console to check for loading message
5. **Click Summarize** and check if your extractor is used
6. **Verify extracted content** is clean and complete

### Debug Checklist

- [ ] Loading message appears in console
- [ ] `canExtract()` returns true on target pages
- [ ] `extract()` returns valid data structure
- [ ] No errors in console
- [ ] Content is clean (no UI elements)
- [ ] Title is correct
- [ ] Metadata is useful

## Existing Extractors

### pdf-extractor.js
- Handles PDF documents
- Uses PDF.js library
- Extracts all pages of text

### google-workspace-extractor.js
- Handles Google Docs, Sheets, Slides
- Uses accessibility API
- Special handling for each format

## Common Patterns

### Wait for Dynamic Content

```javascript
async waitForElement(selector, timeout = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const element = document.querySelector(selector);
    if (element) return element;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`Element ${selector} not found`);
}

async extract() {
  const content = await this.waitForElement('.dynamic-content');
  // ...
}
```

### Handle Multiple Selectors

```javascript
querySelector(selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
}

extractTitle() {
  const title = this.querySelector([
    'h1.main-title',
    '.title h1',
    'h1',
    '.post-title'
  ]);
  return title ? title.innerText : document.title;
}
```

### Clean Text Content

```javascript
cleanText(text) {
  return text
    .replace(/\s+/g, ' ')           // Normalize whitespace
    .replace(/^\s+|\s+$/g, '')      // Trim
    .replace(/\n{3,}/g, '\n\n');    // Max 2 newlines
}
```

## Troubleshooting

### Extractor not running
- Check console for loading message
- Verify it's added to manifest.json before content.js
- Check `canExtract()` returns true
- Reload extension after changes

### Missing content
- Check selectors are correct (use DevTools)
- Verify elements exist when extraction runs
- Look for dynamically loaded content (may need to wait)

### Errors in extraction
- Add try-catch blocks
- Log intermediate values
- Check for null before accessing properties
- Handle edge cases (no title, empty content, etc.)
