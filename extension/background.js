// Bookmart Extension - Background Service Worker

const API_URL = 'http://localhost:3000/api';
const DASHBOARD_URL = 'http://localhost:5173';

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveBookmark') {
        handleSaveBookmark(message.data)
            .then(sendResponse)
            .catch(err => sendResponse({ error: err.message }));
        return true; // Keep channel open for async response
    }

    if (message.action === 'openDashboard') {
        chrome.tabs.create({ url: DASHBOARD_URL });
        sendResponse({ success: true });
    }

    if (message.action === 'openBookmark') {
        chrome.tabs.create({ url: `${DASHBOARD_URL}/bookmarks/${message.bookmarkId}` });
        sendResponse({ success: true });
    }
});

// Handle bookmark saving
async function handleSaveBookmark(data) {
    try {
        const response = await fetch(`${API_URL}/bookmarks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to save bookmark');
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        console.log('Bookmart extension installed');
        // Open welcome page or dashboard
        chrome.tabs.create({ url: DASHBOARD_URL });
    }
});

// Context menu for quick save
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: 'saveToBookmart',
        title: 'Save to Bookmart',
        contexts: ['page', 'link']
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'saveToBookmart') {
        const url = info.linkUrl || info.pageUrl;
        const title = tab.title || url;

        try {
            await handleSaveBookmark({ title, url });
            // Show notification
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Bookmart',
                message: 'Bookmark saved successfully!'
            });
        } catch (error) {
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icons/icon128.png',
                title: 'Bookmart Error',
                message: error.message
            });
        }
    }
});
