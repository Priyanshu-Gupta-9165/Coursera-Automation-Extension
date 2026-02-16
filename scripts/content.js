// Content Script - Coursera Automation
console.log('✅ Coursera Automation loaded');

let quizAnswers = {};
let isSkippingAll = false;
let skipAllInterval = null;

// Init
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

function init() {
    console.log('🚀 Coursera Automation initialized');

    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('📨 Message:', request.action);
        try {
            switch (request.action) {
                case 'ping':
                    sendResponse({ success: true, loaded: true });
                    break;
                case 'skipVideo':
                    skipVideoPlus();
                    break;
                case 'skipAllVideos':
                    skipAllVideos();
                    break;
                case 'autoQuiz':
                    automateQuizSmart();
                    break;
                case 'refreshQuiz':
                    refreshQuizAnswers();
                    break;
                case 'speedControl':
                    setVideoSpeed();
                    break;
                case 'downloadCert':
                    downloadCertificate();
                    break;
            }
            sendResponse({ success: true });
        } catch (error) {
            console.error('❌ Error:', error);
            sendResponse({ success: false, error: error.message });
        }
        return true;
    });

    detectQuizFeedback();
    checkAndResumeSkipAll();
}

// ============================================================
// SKIP SINGLE VIDEO
// ============================================================
function skipVideoPlus() {
    try {
        const video = document.querySelector('video');
        if (!video) {
            updateStatus('⚠ No video found');
            return;
        }

        updateStatus('⏭ Skipping video...');
        video.currentTime = Math.max(0, video.duration - 2);
        video.playbackRate = 16;
        video.play();

        video.addEventListener('ended', () => {
            setTimeout(() => {
                clickNextButton();
                updateStatus('✅ Video completed');
            }, 500);
        }, { once: true });
    } catch (error) {
        console.error('Skip video error:', error);
        updateStatus('❌ Error: ' + error.message);
    }
}

// ============================================================
// SKIP ALL VIDEOS - Uses polling loop (works with SPA)
// ============================================================
async function skipAllVideos() {
    const stored = await chrome.storage.local.get(['skipAllMode']);

    if (stored.skipAllMode || isSkippingAll) {
        // STOP
        stopSkipAll();
        return;
    }

    // Count videos
    updateStatus('🔍 Scanning course...');
    const totalVideos = countTotalVideos();

    // START
    await chrome.storage.local.set({
        skipAllMode: true,
        videoProgress: { current: 0, total: totalVideos }
    });

    isSkippingAll = true;
    updateStatus('📊 Found ' + totalVideos + ' videos. Starting...');

    // Wait 2 sec then start loop
    setTimeout(() => runSkipLoop(), 2000);
}

function stopSkipAll() {
    isSkippingAll = false;
    if (skipAllInterval) {
        clearInterval(skipAllInterval);
        skipAllInterval = null;
    }
    chrome.storage.local.set({ skipAllMode: false, videoProgress: null });
    updateStatus('⏸ Auto-skip stopped');
}

function countTotalVideos() {
    // Count video items in left sidebar / navigation
    let count = 0;

    // Method 1: lecture links in sidebar
    const lectureLinks = document.querySelectorAll('a[href*="/lecture/"]');
    if (lectureLinks.length > 0) return lectureLinks.length;

    // Method 2: item list with video icons  
    const items = document.querySelectorAll('[data-testid="lesson-item"], li[class*="item"]');
    if (items.length > 0) return items.length;

    // Fallback
    return 1;
}

async function runSkipLoop() {
    if (!isSkippingAll) return;

    const stored = await chrome.storage.local.get(['skipAllMode', 'videoProgress']);
    if (!stored.skipAllMode) {
        isSkippingAll = false;
        return;
    }

    const progress = stored.videoProgress || { current: 0, total: 1 };

    try {
        // Wait for video to appear (Coursera SPA may take time)
        const video = await waitForVideo(5000);

        if (video) {
            progress.current += 1;
            await chrome.storage.local.set({ videoProgress: progress });
            updateStatus('⏭ Completing video ' + progress.current + '/' + progress.total + '...');

            // Skip to end
            video.currentTime = Math.max(0, video.duration - 1);
            video.playbackRate = 16;
            video.play();

            // Wait for video to finish
            await waitForVideoEnd(video);

            updateStatus('✅ Done ' + progress.current + '/' + progress.total + ' | Next...');

            // Small delay before clicking next
            await sleep(1000);

            // Click next
            const clicked = clickNextButton();

            if (clicked) {
                // Wait for Coursera SPA to load new content
                await sleep(3000);

                // Wait for old video to be replaced or removed
                await waitForNewContent(video);

                // Continue loop
                if (isSkippingAll) {
                    runSkipLoop();
                }
            } else {
                updateStatus('🎉 All ' + progress.total + ' videos completed!');
                stopSkipAll();
            }
        } else {
            // No video on this page, try clicking next to skip non-video items
            updateStatus('➡ No video, skipping item...');
            const clicked = clickNextButton();

            if (clicked) {
                await sleep(3000);
                if (isSkippingAll) {
                    runSkipLoop();
                }
            } else {
                updateStatus('🎉 Course completed! (' + progress.current + ' videos done)');
                stopSkipAll();
            }
        }
    } catch (error) {
        console.error('Skip all error:', error);
        updateStatus('❌ Error: ' + error.message);
        stopSkipAll();
    }
}

// ============================================================
// HELPERS FOR SKIP ALL
// ============================================================

// Wait for a video element to appear on page
function waitForVideo(timeout) {
    return new Promise((resolve) => {
        const video = document.querySelector('video');
        if (video && video.duration > 0) {
            resolve(video);
            return;
        }

        let elapsed = 0;
        const check = setInterval(() => {
            elapsed += 300;
            const v = document.querySelector('video');
            if (v && v.duration > 0) {
                clearInterval(check);
                resolve(v);
            } else if (elapsed >= timeout) {
                clearInterval(check);
                resolve(null);
            }
        }, 300);
    });
}

// Wait for video to finish playing
function waitForVideoEnd(video) {
    return new Promise((resolve) => {
        const check = setInterval(() => {
            if (video.ended || video.currentTime >= video.duration - 0.5) {
                clearInterval(check);
                resolve();
            }
        }, 200);

        // Safety timeout: max 30 seconds
        setTimeout(() => {
            clearInterval(check);
            resolve();
        }, 30000);
    });
}

// Wait for new content to load (detect that old video is gone or new one appeared)
function waitForNewContent(oldVideo) {
    return new Promise((resolve) => {
        let waited = 0;
        const check = setInterval(() => {
            waited += 500;
            const currentVideo = document.querySelector('video');

            // New video loaded (different element or different src)
            if (currentVideo && currentVideo !== oldVideo) {
                clearInterval(check);
                resolve();
                return;
            }

            // No video anymore (non-video page)
            if (!currentVideo) {
                clearInterval(check);
                resolve();
                return;
            }

            // URL changed (SPA navigation happened)
            if (waited >= 5000) {
                clearInterval(check);
                resolve();
            }
        }, 500);
    });
}

// Click the Next button - tries multiple selectors
function clickNextButton() {
    // Coursera Next button selectors (multiple patterns)
    const selectors = [
        'button[data-testid="next-button"]',
        'button[aria-label="Next"]',
        'button[aria-label="Go to next item"]',
        'a[aria-label="Next"]',
        'a[aria-label="Go to next item"]',
        'button.css-1pnkbfa',
        '[data-track-component="click_next"]',
        'button[class*="next"]',
        'a[class*="next"]'
    ];

    for (const selector of selectors) {
        const btn = document.querySelector(selector);
        if (btn && !btn.disabled) {
            btn.click();
            console.log('✅ Clicked next:', selector);
            return true;
        }
    }

    // Fallback: find any button with "Next" text
    const allButtons = document.querySelectorAll('button, a[role="button"]');
    for (const btn of allButtons) {
        const text = btn.textContent.trim();
        if (text === 'Next' || text === 'Go to next item' || text.includes('Next Item')) {
            if (!btn.disabled) {
                btn.click();
                console.log('✅ Clicked next (text match):', text);
                return true;
            }
        }
    }

    console.log('⚠ No next button found');
    return false;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Auto-resume on page load (handles full page reload)
async function checkAndResumeSkipAll() {
    const stored = await chrome.storage.local.get(['skipAllMode', 'videoProgress']);
    if (stored.skipAllMode) {
        isSkippingAll = true;
        const p = stored.videoProgress || { current: 0, total: '?' };
        updateStatus('🔄 Resuming (' + p.current + '/' + p.total + ')...');
        setTimeout(() => runSkipLoop(), 2000);
    }
}

// ============================================================
// SMART QUIZ AUTOMATION
// ============================================================
async function automateQuizSmart() {
    try {
        updateStatus('🔄 Loading quiz answers...');
        await sleep(10000);

        updateStatus('🧠 Analyzing quiz...');
        const storedData = await chrome.storage.local.get(['quizAnswers']);
        const previousAnswers = storedData.quizAnswers || {};
        const quizId = getQuizId();
        const quizData = previousAnswers[quizId] || {};

        const questions = document.querySelectorAll(
            '[data-testid="quiz-question"], .rc-FormPartsQuestion, .rc-QuizQuestion, [class*="Question"]'
        );

        if (questions.length === 0) {
            updateStatus('⚠ No quiz questions found');
            return;
        }

        updateStatus('📝 Found ' + questions.length + ' questions');
        let answeredCount = 0;

        for (let i = 0; i < questions.length; i++) {
            const question = questions[i];
            const questionText = getQuestionText(question);
            const questionHash = hashString(questionText);
            const previousAnswer = quizData[questionHash];

            if (previousAnswer && previousAnswer.correct) {
                const options = question.querySelectorAll('input[type="radio"], input[type="checkbox"]');
                const targetOption = Array.from(options).find(opt => {
                    const label = opt.closest('label') || opt.parentElement;
                    return label.textContent.trim().includes(previousAnswer.answerText);
                });

                if (targetOption && !targetOption.checked) {
                    targetOption.click();
                    answeredCount++;
                    updateStatus('✅ ' + answeredCount + '/' + questions.length + ' (known)');
                }
            } else {
                const options = question.querySelectorAll('input[type="radio"]:not(:checked), input[type="checkbox"]:not(:checked)');
                if (options.length > 0) {
                    options[0].click();
                    answeredCount++;
                    updateStatus('🤔 ' + answeredCount + '/' + questions.length + ' (guessing)');
                }
            }

            await sleep(500);
        }

        updateStatus('✅ Answered ' + answeredCount + ' questions');

        setTimeout(() => {
            const submitButton = document.querySelector(
                '[data-testid="submit-button"], button[type="submit"], [class*="submit"]'
            );
            if (submitButton && !submitButton.disabled) {
                updateStatus('📤 Submitting quiz...');
                submitButton.click();
                setTimeout(() => storeQuizResults(), 2000);
            }
        }, 2000);
    } catch (error) {
        console.error('Quiz error:', error);
        updateStatus('❌ Error: ' + error.message);
    }
}

// ============================================================
// QUIZ HELPERS
// ============================================================
async function refreshQuizAnswers() {
    updateStatus('🔄 Refreshing answers...');
    const checked = document.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked');
    checked.forEach(input => { input.checked = false; });
    await automateQuizSmart();
}

function detectQuizFeedback() {
    const observer = new MutationObserver(() => {
        const feedback = document.querySelectorAll('[class*="feedback"], [class*="correct"], [class*="incorrect"]');
        if (feedback.length > 0) storeQuizResults();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

async function storeQuizResults() {
    try {
        const quizId = getQuizId();
        const storedData = await chrome.storage.local.get(['quizAnswers']);
        const allAnswers = storedData.quizAnswers || {};
        if (!allAnswers[quizId]) allAnswers[quizId] = {};

        const questions = document.querySelectorAll(
            '[data-testid="quiz-question"], .rc-FormPartsQuestion, .rc-QuizQuestion, [class*="Question"]'
        );

        questions.forEach(question => {
            const questionText = getQuestionText(question);
            const questionHash = hashString(questionText);
            const isCorrect = question.querySelector('[class*="correct"]') !== null;
            const selectedInput = question.querySelector('input:checked');

            if (selectedInput && isCorrect) {
                const answerLabel = selectedInput.closest('label') || selectedInput.parentElement;
                allAnswers[quizId][questionHash] = {
                    questionText: questionText,
                    answerText: answerLabel.textContent.trim(),
                    correct: true,
                    timestamp: Date.now()
                };
            }
        });

        await chrome.storage.local.set({ quizAnswers: allAnswers });
        console.log('💾 Quiz results stored');
    } catch (error) {
        console.error('Store quiz error:', error);
    }
}

function getQuizId() {
    const url = window.location.href;
    const match = url.match(/quiz\/([^/]+)/);
    return match ? match[1] : hashString(url);
}

function getQuestionText(el) {
    const t = el.querySelector('[class*="question-text"], [class*="QuestionText"], p, div');
    return t ? t.textContent.trim() : '';
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + c;
        hash = hash & hash;
    }
    return hash.toString(36);
}

// ============================================================
// OTHER FEATURES
// ============================================================
async function setVideoSpeed() {
    try {
        const settings = await chrome.storage.sync.get(['videoSpeed']);
        const video = document.querySelector('video');
        if (video) {
            const speed = settings.videoSpeed || 2;
            video.playbackRate = speed;
            updateStatus('⚡ Speed: ' + speed + 'x');
        } else {
            updateStatus('⚠ No video found');
        }
    } catch (error) {
        console.error('Speed error:', error);
    }
}

function downloadCertificate() {
    try {
        const btn = document.querySelector(
            'a[href*="certificate"], a[href*="accomplishment"], [class*="certificate"]'
        );
        if (btn) {
            btn.click();
            updateStatus('📜 Downloading certificate');
        } else {
            updateStatus('⚠ Certificate not available');
        }
    } catch (error) {
        console.error('Cert error:', error);
    }
}

// ============================================================
// STATUS UPDATE
// ============================================================
function updateStatus(status) {
    console.log('📊', status);
    chrome.runtime.sendMessage({
        action: 'updateStatus',
        status: status
    }).catch(() => { });
}

console.log('✅ Coursera Automation ready');
