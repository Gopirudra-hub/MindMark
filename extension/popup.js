// Bookmart Extension - Popup Script

const API_URL = 'http://localhost:3000/api';
const DASHBOARD_URL = 'http://localhost:5173';

let currentTab = null;
let currentBookmarkId = null;
let pageContent = null;

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentTab();
    await loadCategories();
    setupEventListeners();
});

// Get current tab info
async function loadCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        currentTab = tab;

        document.getElementById('pageTitle').textContent = tab.title || 'Untitled';
        document.getElementById('pageUrl').textContent = tab.url;

        // Try multiple methods to get page content
        pageContent = await extractContent(tab.id);

        // Show content status
        const contentStatus = document.getElementById('contentStatus');
        contentStatus.style.display = 'block';

        if (pageContent && pageContent.length > 200) {
            contentStatus.textContent = `✓ Content extracted (${Math.round(pageContent.length / 1000)}k chars)`;
            contentStatus.style.background = '#d1fae5';
            contentStatus.style.color = '#065f46';
        } else if (pageContent) {
            contentStatus.textContent = '⚠ Limited content extracted';
            contentStatus.style.background = '#fef3c7';
            contentStatus.style.color = '#92400e';
        } else {
            contentStatus.textContent = '✗ Could not extract content';
            contentStatus.style.background = '#fee2e2';
            contentStatus.style.color = '#991b1b';
        }

        // Check if bookmark already exists
        await checkExistingBookmark();
    } catch (error) {
        console.error('Failed to load tab:', error);
        showStatus('error', 'Failed to load page info');
    }
}

// Extract content using multiple methods
async function extractContent(tabId) {
    // Method 1: Try content script message
    try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'extractContent' });
        if (response?.content && response.content.length > 100) {
            return response.content.substring(0, 15000);
        }
    } catch (e) {
        console.log('Content script method failed:', e.message);
    }

    // Method 2: Execute script directly
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
                // Try to find main content
                const selectors = ['article', 'main', '[role="main"]', '.content', '#content', '.markdown-body'];
                let el = null;
                for (const s of selectors) {
                    el = document.querySelector(s);
                    if (el) break;
                }
                if (!el) el = document.body;

                // Get text content, removing scripts/styles
                const clone = el.cloneNode(true);
                clone.querySelectorAll('script, style, nav, header, footer, aside, .sidebar, .ads').forEach(e => e.remove());
                return clone.innerText?.replace(/\s+/g, ' ').trim();
            }
        });
        if (result?.result && result.result.length > 100) {
            return result.result.substring(0, 15000);
        }
    } catch (e) {
        console.log('Execute script method failed:', e.message);
    }

    // Method 3: Simple body text
    try {
        const [result] = await chrome.scripting.executeScript({
            target: { tabId },
            func: () => document.body.innerText
        });
        if (result?.result) {
            return result.result.substring(0, 15000);
        }
    } catch (e) {
        console.log('Body text method failed:', e.message);
    }

    return null;
}

// Load categories from API
async function loadCategories() {
    try {
        const response = await fetch(`${API_URL}/categories`);
        if (!response.ok) throw new Error('Failed to fetch categories');

        const categories = await response.json();
        const select = document.getElementById('categorySelect');

        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat.id;
            option.textContent = cat.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Failed to load categories:', error);
    }
}

// Check if bookmark already exists
async function checkExistingBookmark() {
    try {
        const response = await fetch(`${API_URL}/bookmarks?search=${encodeURIComponent(currentTab.url)}`);
        if (!response.ok) return;

        const data = await response.json();
        const existing = data.bookmarks.find(b => b.url === currentTab.url);

        if (existing) {
            currentBookmarkId = existing.id;
            document.getElementById('saveBtn').textContent = '✓ Bookmark Saved';
            document.getElementById('saveBtn').classList.remove('btn-primary');
            document.getElementById('saveBtn').classList.add('btn-success');
        }
    } catch (error) {
        console.log('Could not check existing bookmark:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    document.getElementById('saveBtn').addEventListener('click', saveBookmark);
    document.getElementById('generateSummaryBtn').addEventListener('click', generateSummary);
    document.getElementById('generateQuestionsBtn').addEventListener('click', generateQuestions);
    document.getElementById('openDashboardBtn').addEventListener('click', openDashboard);
}

// Save bookmark
async function saveBookmark() {
    if (currentBookmarkId) {
        // Already saved, open in dashboard
        chrome.tabs.create({ url: `${DASHBOARD_URL}/bookmarks/${currentBookmarkId}` });
        return;
    }

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    showStatus('loading', '💾 Saving bookmark...');

    try {
        const categoryId = document.getElementById('categorySelect').value;

        // Build payload, omitting empty/undefined values
        const payload = {
            title: currentTab.title || 'Untitled',
            url: currentTab.url
        };

        if (pageContent && pageContent.length > 0) {
            payload.content = pageContent;
            showStatus('loading', `💾 Saving bookmark with ${Math.round(pageContent.length / 1000)}k chars of content...`);
        } else {
            showStatus('loading', '⚠️ Saving bookmark WITHOUT content (AI features won\'t work)...');
        }

        if (categoryId) {
            payload.categoryId = categoryId;
        }

        const response = await fetch(`${API_URL}/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.details?.[0]?.message || 'Failed to save');
        }

        const bookmark = await response.json();
        currentBookmarkId = bookmark.id;

        btn.textContent = '✓ Bookmark Saved';
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-success');

        if (pageContent && pageContent.length > 100) {
            showStatus('success', '✅ Bookmark saved with content! You can generate summary now.');
        } else {
            showStatus('warning', '⚠️ Bookmark saved but NO content. AI features won\'t work for this page.');
        }
    } catch (error) {
        console.error('Failed to save bookmark:', error);
        showStatus('error', `❌ ${error.message}`);
    } finally {
        btn.disabled = false;
    }
}

// Generate summary
async function generateSummary() {
    if (!currentBookmarkId) {
        showStatus('error', '❌ Save bookmark first before generating summary');
        return;
    }

    // Check if content was extracted
    if (!pageContent || pageContent.length < 100) {
        showStatus('error', '❌ No content extracted from page. Cannot generate summary.');
        return;
    }

    const btn = document.getElementById('generateSummaryBtn');
    const originalText = btn.textContent;
    btn.disabled = true;

    try {
        // Step 1: Check AI service status
        showStatus('loading', '🔍 Checking AI service...');
        const statusResponse = await fetch(`${API_URL}/ai/status`);
        if (!statusResponse.ok) {
            throw new Error('AI service is not available. Check if Ollama is running.');
        }
        const aiStatus = await statusResponse.json();

        // Step 2: Start generation
        showStatus('loading', `📝 Generating summary using ${aiStatus.provider === 'local' ? 'Ollama' : 'Cloud API'}... (30-60s)`);
        btn.textContent = '⏳ Generating...';

        const response = await fetch(`${API_URL}/ai/generate-summary`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookmarkId: currentBookmarkId,
                type: 'all'
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Parse specific errors
            if (result.error?.includes('timeout')) {
                throw new Error('AI generation timed out. Model may be loading - try again in 1 minute.');
            } else if (result.error?.includes('no content')) {
                throw new Error('Bookmark has no content. Page content was not saved.');
            } else {
                throw new Error(result.error || 'Failed to generate summary');
            }
        }

        if (result.cached) {
            showStatus('success', '✅ Summary already exists! View in dashboard.');
        } else {
            showStatus('success', '✅ Summary generated successfully!');
        }
        btn.textContent = '✓ Generated';
    } catch (error) {
        console.error('Failed to generate summary:', error);
        showStatus('error', `❌ ${error.message}`);
        btn.textContent = originalText;
    } finally {
        btn.disabled = false;
    }
}

// Generate questions
async function generateQuestions() {
    if (!currentBookmarkId) {
        showStatus('error', '❌ Save bookmark first before generating questions');
        return;
    }

    // Check if content was extracted
    if (!pageContent || pageContent.length < 100) {
        showStatus('error', '❌ No content extracted from page. Cannot generate questions.');
        return;
    }

    const btn = document.getElementById('generateQuestionsBtn');
    const originalText = btn.textContent;
    btn.disabled = true;

    try {
        // Step 1: Check AI service status
        showStatus('loading', '🔍 Checking AI service...');
        const statusResponse = await fetch(`${API_URL}/ai/status`);
        if (!statusResponse.ok) {
            throw new Error('AI service is not available. Check if Ollama is running.');
        }
        const aiStatus = await statusResponse.json();

        // Step 2: Start generation
        showStatus('loading', `❓ Generating questions using ${aiStatus.provider === 'local' ? 'Ollama' : 'Cloud API'}... (60-120s)`);
        btn.textContent = '⏳ Generating...';

        const response = await fetch(`${API_URL}/ai/generate-questions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                bookmarkId: currentBookmarkId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            // Parse specific errors
            if (result.error?.includes('timeout')) {
                throw new Error('AI generation timed out. Model may be loading - try again in 1 minute.');
            } else if (result.error?.includes('no content')) {
                throw new Error('Bookmark has no content. Generate summary first.');
            } else {
                throw new Error(result.error || 'Failed to generate questions');
            }
        }

        if (result.cached) {
            showStatus('success', `✅ ${result.total} questions already exist! View in dashboard.`);
        } else {
            showStatus('success', `✅ ${result.total} questions generated!`);
        }
        btn.textContent = '✓ Generated';
    } catch (error) {
        console.error('Failed to generate questions:', error);
        showStatus('error', `❌ ${error.message}`);
        btn.textContent = originalText;
    } finally {
        btn.disabled = false;
    }
}

// Open dashboard
function openDashboard() {
    if (currentBookmarkId) {
        chrome.tabs.create({ url: `${DASHBOARD_URL}/bookmarks/${currentBookmarkId}` });
    } else {
        chrome.tabs.create({ url: DASHBOARD_URL });
    }
}

// Show status message
function showStatus(type, message) {
    const statusEl = document.getElementById('status');
    statusEl.className = `status ${type}`;

    if (type === 'loading') {
        statusEl.innerHTML = `<span class="spinner"></span> ${message}`;
    } else {
        statusEl.innerHTML = message;
    }

    // Auto-hide non-loading messages after 8 seconds
    if (type !== 'loading') {
        setTimeout(() => {
            statusEl.innerHTML = '';
            statusEl.className = 'status';
        }, 8000);
    }
}
