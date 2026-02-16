// Popup Script
document.addEventListener('DOMContentLoaded', () => {
    const statusText = document.getElementById('status-text');
    const actionButtons = document.querySelectorAll('.action-btn');

    // Load settings
    chrome.storage.sync.get(['autoPlay', 'videoSpeed', 'skipIntro'], (settings) => {
        console.log('Settings loaded:', settings);
    });

    // Handle button clicks
    actionButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const action = button.dataset.action;
            console.log('Action clicked:', action);

            statusText.textContent = 'Processing...';

            try {
                // Get active tab
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!tab.url || !tab.url.includes('coursera.org')) {
                    statusText.textContent = 'Please open a Coursera page';
                    setTimeout(() => { statusText.textContent = 'Ready'; }, 2000);
                    return;
                }

                // Ensure content script is injected first
                await ensureContentScript(tab.id);

                // Handle different actions
                switch (action) {
                    case 'skip-all-videos':
                        await executeAction(tab.id, 'skipAllVideos');
                        statusText.textContent = '⏭⏭ Skipping all videos...';
                        break;

                    case 'auto-quiz':
                        await executeAction(tab.id, 'autoQuiz');
                        statusText.textContent = '✓ Quiz automation started';
                        break;

                    case 'speed-control':
                        await executeAction(tab.id, 'speedControl');
                        statusText.textContent = '✓ Speed set to 2x';
                        break;

                    case 'download-cert':
                        await executeAction(tab.id, 'downloadCert');
                        statusText.textContent = '✓ Downloading certificate';
                        break;

                    case 'settings':
                        chrome.runtime.openOptionsPage();
                        return;
                }

                // Reset status after 5 seconds
                setTimeout(() => { statusText.textContent = 'Ready'; }, 5000);

            } catch (error) {
                console.error('Error:', error);
                statusText.textContent = 'Error: ' + error.message;
                setTimeout(() => { statusText.textContent = 'Ready'; }, 3000);
            }
        });
    });

    // Inject content script if not already present
    async function ensureContentScript(tabId) {
        try {
            // Try to ping the content script
            await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        } catch (e) {
            // Content script not loaded, inject it
            console.log('Injecting content script...');
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['scripts/content.js']
            });
            // Wait a moment for it to initialize
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    async function executeAction(tabId, action) {
        try {
            await chrome.tabs.sendMessage(tabId, { action: action });
        } catch (error) {
            // Retry: inject and send again
            await chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['scripts/content.js']
            });
            await new Promise(resolve => setTimeout(resolve, 500));
            await chrome.tabs.sendMessage(tabId, { action: action });
        }
    }

    // Listen for status updates from content script
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'updateStatus') {
            statusText.textContent = request.status;
        }
    });
});
