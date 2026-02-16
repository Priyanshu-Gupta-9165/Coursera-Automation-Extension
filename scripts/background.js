// Background Service Worker
console.log('Coursera Automation Extension loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // Set default settings
        chrome.storage.sync.set({
            autoPlay: true,
            videoSpeed: 2,
            skipIntro: true,
            autoQuiz: false,
            quizDelay: 3,
            autoCert: false,
            notifications: true
        });
        console.log('Extension installed with default settings');
    }
});

// Handle keyboard commands
chrome.commands.onCommand.addListener((command) => {
    if (command === 'open_popup') {
        chrome.action.openPopup();
    } else if (command === 'refresh_quiz') {
        // Send message to active tab to refresh quiz
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'refreshQuiz' });
            }
        });
    }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Message received:', request);

    if (request.action === 'updateStatus') {
        // Broadcast status to popup if open
        chrome.runtime.sendMessage({
            action: 'statusUpdate',
            status: request.status
        }).catch(() => {
            // Popup not open, ignore
        });
    }

    sendResponse({ success: true });
    return true;
});

// Handle extension icon click
chrome.action.onClicked.addListener((tab) => {
    console.log('Extension icon clicked');
});
