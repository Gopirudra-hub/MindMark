// Bookmart Extension - Content Script
// Extracts page content for AI summarization

(function () {
    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'extractContent') {
            const content = extractPageContent();
            sendResponse({ content });
        }
        return true;
    });

    // Extract readable content from page
    function extractPageContent() {
        // Try to get main content
        const selectors = [
            'article',
            'main',
            '[role="main"]',
            '.content',
            '.post-content',
            '.article-content',
            '.entry-content',
            '#content',
            '.markdown-body'
        ];

        let mainElement = null;
        for (const selector of selectors) {
            mainElement = document.querySelector(selector);
            if (mainElement) break;
        }

        // Fall back to body
        if (!mainElement) {
            mainElement = document.body;
        }

        // Clone to avoid modifying original
        const clone = mainElement.cloneNode(true);

        // Remove unwanted elements
        const removeSelectors = [
            'script',
            'style',
            'nav',
            'header',
            'footer',
            'aside',
            '.sidebar',
            '.navigation',
            '.menu',
            '.ad',
            '.advertisement',
            '.social-share',
            '.comments',
            'iframe',
            'noscript'
        ];

        removeSelectors.forEach(selector => {
            clone.querySelectorAll(selector).forEach(el => el.remove());
        });

        // Get text content
        let text = clone.innerText || clone.textContent || '';

        // Clean up whitespace
        text = text
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        // Limit length
        if (text.length > 10000) {
            text = text.substring(0, 10000) + '...';
        }

        return text;
    }
})();
