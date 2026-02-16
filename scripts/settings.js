// Settings Script
document.addEventListener('DOMContentLoaded', () => {
    const saveButton = document.getElementById('save-settings');
    const saveStatus = document.getElementById('save-status');

    // Load saved settings
    loadSettings();

    // Save settings
    saveButton.addEventListener('click', () => {
        const settings = {
            autoPlay: document.getElementById('auto-play').checked,
            videoSpeed: parseFloat(document.getElementById('video-speed').value),
            skipIntro: document.getElementById('skip-intro').checked,
            autoQuiz: document.getElementById('auto-quiz').checked,
            quizDelay: parseInt(document.getElementById('quiz-delay').value),
            autoCert: document.getElementById('auto-cert').checked,
            notifications: document.getElementById('notifications').checked
        };

        chrome.storage.sync.set(settings, () => {
            console.log('Settings saved:', settings);

            // Show success message
            saveStatus.textContent = '✓ Settings saved successfully!';
            saveStatus.style.color = '#20c997';

            setTimeout(() => {
                saveStatus.textContent = '';
            }, 3000);
        });
    });

    function loadSettings() {
        chrome.storage.sync.get([
            'autoPlay',
            'videoSpeed',
            'skipIntro',
            'autoQuiz',
            'quizDelay',
            'autoCert',
            'notifications'
        ], (settings) => {
            console.log('Settings loaded:', settings);

            // Set form values
            if (settings.autoPlay !== undefined) {
                document.getElementById('auto-play').checked = settings.autoPlay;
            }
            if (settings.videoSpeed) {
                document.getElementById('video-speed').value = settings.videoSpeed;
            }
            if (settings.skipIntro !== undefined) {
                document.getElementById('skip-intro').checked = settings.skipIntro;
            }
            if (settings.autoQuiz !== undefined) {
                document.getElementById('auto-quiz').checked = settings.autoQuiz;
            }
            if (settings.quizDelay) {
                document.getElementById('quiz-delay').value = settings.quizDelay;
            }
            if (settings.autoCert !== undefined) {
                document.getElementById('auto-cert').checked = settings.autoCert;
            }
            if (settings.notifications !== undefined) {
                document.getElementById('notifications').checked = settings.notifications;
            }
        });
    }
});
