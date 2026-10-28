// js/dashboard.js - Student Dashboard with Firestore Integration
import { auth, db } from "./main.js";
import {
    collection, query, where, getDocs, orderBy, getDoc, doc,
    updateDoc, serverTimestamp, onSnapshot, setDoc, limit, startAfter
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// ========== CONSTANTS ==========
const WAEC_NECO_QUESTIONS = 50;
const WAEC_NECO_TIME = 40 * 60;
const QUESTIONS_TO_FETCH = 20;
const RECENT_TESTS_PAGE_SIZE = 5;

const DEFAULT_ACADEX_RETURN_URL = 'https://acadex.vercel.app/student/student-portal.html';
const THEME_KEY = 'smartbrain-theme';

const EXAM_TYPE_MAP = {
    'waec': 'WAEC/NECO',
    'jamb': 'JAMB'
};

const ALL_SUBJECTS = [
    { value: 'mathematics', name: 'Mathematics' },
    { value: 'english', name: 'English Language' },
    { value: 'physics', name: 'Physics' },
    { value: 'chemistry', name: 'Chemistry' },
    { value: 'accounting', name: 'Accounting' },
    { value: 'literature', name: 'Literature in English' },
    { value: 'government', name: 'Government' },
    { value: 'commerce', name: 'Commerce' },
    { value: 'biology', name: 'Biology' },
    { value: 'economics', name: 'Economics' },
    { value: 'crk', name: 'Christian Religious Knowledge (CRK)' },
    { value: 'civic', name: 'Civic Education' },
    { value: 'furtherMath', name: 'Further Mathematics' },
    { value: 'geography', name: 'Geography' },
    { value: 'ict', name: 'ICT (Computer Studies)' },
    { value: 'marketing', name: 'Marketing' },
    { value: 'agric', name: 'Agricultural Science' },
    { value: 'yoruba', name: 'Yoruba' }
];

// ========== DOM ELEMENTS ==========
const getElement = (id) => document.getElementById(id);

const startQuickTestBtn = getElement('startQuickTestBtn');
const classSelect = getElement('classSelect');
const subjectSelect = getElement('subjectSelect');
const logoutBtn = getElement('logoutBtn');
const userName = getElement('userName');
const profileUpload = getElement('profileUpload');
const profileImg = getElement('profileImg');
const returnToAcadexBtn = getElement('returnToAcadexBtn');
const themeToggleBtn = getElement('themeToggleBtn');

// JAMB Drill
const additionalSubjectsDiv = getElement('additionalSubjects');
const startJambDrillBtn = getElement('startJambDrillBtn');
const toggleAllSubjectsBtn = getElement('toggleAllSubjectsBtn');

// WAEC/NECO Drill
const waecNecoSubjectSelect = getElement('waecNecoSubjectSelect');
const startWaecNecoDrillBtn = getElement('startWaecNecoDrillBtn');

// Stats
const completedTests = getElement('completedTests');
const averageScore = getElement('averageScore');
const performanceMessage = getElement('performanceMessage');

// ========== STATE ==========
let currentUserData = null;
let unsubscribeStats = null;
let lastVisibleRecentDoc = null;
let weeklyChartInstance = null;
let monthlyChartInstance = null;

// ========== THEME ==========
function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch (e) { /* non-fatal */ }

    if (themeToggleBtn) {
        const icon = themeToggleBtn.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
        const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
        themeToggleBtn.setAttribute('aria-label', label);
        themeToggleBtn.setAttribute('title', label);
    }

    refreshChartsTheme();
}

function initTheme() {
    // Initial theme was already applied by the inline script in <head>.
    // Sync the toggle button's icon to match.
    const current = getCurrentTheme();
    applyTheme(current);

    if (themeToggleBtn) {
        themeToggleBtn.addEventListener('click', () => {
            const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
            applyTheme(next);
        });
    }
}

function getChartTheme() {
    const isDark = getCurrentTheme() === 'dark';
    return {
        isDark,
        lineColor: isDark ? '#409cff' : '#007aff',
        lineFill: isDark ? 'rgba(64, 156, 255, 0.18)' : 'rgba(0, 122, 255, 0.12)',
        linePointBg: isDark ? '#409cff' : '#007aff',
        linePointBorder: isDark ? '#151922' : '#ffffff',
        barFill: isDark ? 'rgba(191, 90, 242, 0.85)' : 'rgba(175, 82, 222, 0.85)',
        barBorder: isDark ? '#bf5af2' : '#af52de',
        legendColor: isDark ? '#cbd5e1' : '#475569',
        tickColor: isDark ? '#94a3b8' : '#94a3b8',
        gridColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(15, 23, 42, 0.06)'
    };
}

function refreshChartsTheme() {
    const theme = getChartTheme();

    [weeklyChartInstance, monthlyChartInstance].forEach(chart => {
        if (!chart) return;
        const ds = chart.data.datasets[0];
        if (chart.config.type === 'line') {
            ds.borderColor = theme.lineColor;
            ds.backgroundColor = theme.lineFill;
            ds.pointBackgroundColor = theme.linePointBg;
            ds.pointBorderColor = theme.linePointBorder;
        } else if (chart.config.type === 'bar') {
            ds.backgroundColor = theme.barFill;
            ds.borderColor = theme.barBorder;
        }
        if (chart.options.plugins?.legend?.labels) chart.options.plugins.legend.labels.color = theme.legendColor;
        if (chart.options.scales?.y?.ticks) chart.options.scales.y.ticks.color = theme.tickColor;
        if (chart.options.scales?.y?.grid) chart.options.scales.y.grid.color = theme.gridColor;
        if (chart.options.scales?.x?.ticks) chart.options.scales.x.ticks.color = theme.tickColor;
        if (chart.options.scales?.x?.grid) chart.options.scales.x.grid.color = theme.gridColor;
        chart.update();
    });
}

// ========== HELPER: SAFE TIMESTAMP CONVERSION ==========
function convertTimestamp(value) {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();
    if (value.seconds !== undefined) return new Date(value.seconds * 1000);
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    if (typeof value === 'number') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    if (value instanceof Date && !isNaN(value.getTime())) return value;
    return null;
}

// ========== UTILITY FUNCTIONS ==========
function showWelcomeBanner(userNameText) {
    const shouldShow = sessionStorage.getItem('showWelcome');
    if (!shouldShow) return;
    const banner = document.createElement('div');
    banner.id = 'welcomeBanner';
    banner.style.cssText = `
        background: linear-gradient(135deg, #34c759, #4ddc75);
        color: #ffffff;
        padding: 1rem 1.2rem;
        border-radius: 16px;
        margin-bottom: 1.5rem;
        text-align: center;
        font-size: 15px;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(52, 199, 89, 0.35);
        animation: fadeIn 0.5s;
    `;
    banner.innerHTML = `
        🎉 Congratulations, <strong>${userNameText}</strong>! Your account is ready.
        <button onclick="this.parentElement.remove(); sessionStorage.removeItem('showWelcome');"
                style="background: rgba(255,255,255,0.25); border: none; color: #ffffff; padding: 0.35rem 1rem; border-radius: 100px; margin-left: 1rem; cursor: pointer; font-weight: 700; font-family: inherit;">
            Dismiss
        </button>
    `;
    const container = document.querySelector('.dashboard-container');
    if (container) {
        container.prepend(banner);
        setTimeout(() => {
            if (banner.parentNode) banner.remove();
            sessionStorage.removeItem('showWelcome');
        }, 8000);
    }
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function generateTestId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function showLoadingState(show, button) {
    if (!button) return;
    if (show) {
        button.dataset.originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        button.disabled = true;
    } else {
        button.innerHTML = button.dataset.originalText || button.innerHTML;
        button.disabled = false;
    }
}

function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ========== ACADEX UI ==========
// If the student came from Acadex (has acadexUid), show "Return to Acadex"
// and hide the Logout button. Otherwise show Logout, hide Return.
function setupAcadexUI() {
    const isFromAcadex = !!(currentUserData && currentUserData.acadexUid);

    // Return to Acadex button
    if (returnToAcadexBtn) {
        if (isFromAcadex) {
            let returnUrl =
                currentUserData.acadexReturnUrl ||
                localStorage.getItem('acadexReturnUrl') ||
                DEFAULT_ACADEX_RETURN_URL;

            if (typeof returnUrl !== 'string' || !/^https?:\/\//i.test(returnUrl)) {
                returnUrl = DEFAULT_ACADEX_RETURN_URL;
            }

            try { localStorage.setItem('acadexReturnUrl', returnUrl); } catch (e) { /* non-fatal */ }

            returnToAcadexBtn.style.display = 'inline-flex';
            returnToAcadexBtn.onclick = () => { window.location.href = returnUrl; };
        } else {
            returnToAcadexBtn.style.display = 'none';
        }
    }

    // Logout button — hide for Acadex-origin students
    if (logoutBtn) {
        logoutBtn.style.display = isFromAcadex ? 'none' : 'inline-flex';
    }
}

// ========== USER DATA LOADING ==========
async function loadUserData(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            currentUserData = userSnap.data();
        } else {
            await createDefaultUserProfile(userId);
            const retrySnap = await getDoc(userRef);
            if (retrySnap.exists()) currentUserData = retrySnap.data();
        }

        loadUserProfile(currentUserData);

        // NEW: Return to Acadex + hide Logout for Acadex users
        setupAcadexUI();

        if (document.getElementById('completedTests') || document.getElementById('averageScore')) {
            setupRealTimeStats(userId);
        }

        setupSubjectDropdown();
        setupJambDrillSubjects();
        populateWaecNecoSubjects();

        if (document.getElementById('recentTestsList')) {
            loadRecentTests(userId);
        }
        if (document.getElementById('weeklyTrendChart')) {
            setTimeout(() => loadAnalytics(userId), 800);
        }
        if (document.getElementById('leaderboardTop10')) {
            setTimeout(() => loadLeaderboard(), 800);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

async function createDefaultUserProfile(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const user = auth.currentUser;
        await setDoc(userRef, {
            fullName: user.displayName || user.email.split('@')[0],
            email: user.email,
            totalTestsTaken: 0,
            profilePicture: '',
            joinedAt: serverTimestamp(),
            status: 'active',
            tutorialCenterId: null
        }, { merge: true });
    } catch (error) {
        console.error("Error creating default profile:", error);
    }
}

// ========== DASHBOARD STATS ==========
function setupRealTimeStats(userId) {
    if (unsubscribeStats) unsubscribeStats();
    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc")
    );
    unsubscribeStats = onSnapshot(q, (snapshot) => {
        updateStatistics(snapshot);
    }, (error) => {
        console.error("Error loading stats from Firestore:", error);
    });
}

function updateStatistics(snapshot) {
    if (snapshot.empty) {
        if (completedTests) completedTests.textContent = "0";
        if (averageScore) averageScore.textContent = "0";
        if (performanceMessage) performanceMessage.textContent = "Start practicing!";
        return;
    }
    let totalTests = 0;
    let totalScore = 0;
    snapshot.forEach((docSnap) => {
        const testData = docSnap.data();
        let score = testData.score;
        if (testData.mode === 'jamb_drill' && testData.totalQuestions) {
            score = (testData.rawScore / testData.totalQuestions) * 100;
        }
        if (score !== undefined && score !== null) {
            totalTests++;
            totalScore += score;
        }
    });
    if (completedTests) completedTests.textContent = totalTests;
    const average = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
    if (averageScore) averageScore.textContent = average;
    let message = "Keep practicing!";
    if (average >= 90) message = "Excellent!";
    else if (average >= 80) message = "Great job!";
    else if (average >= 70) message = "Good work!";
    else if (average >= 60) message = "Keep improving!";
    if (performanceMessage) performanceMessage.textContent = message;
}

// ========== RECENT TESTS ==========
async function loadRecentTests(userId) {
    const recentTestsList = document.getElementById('recentTestsList');
    const loadMoreContainer = document.getElementById('recentTestsMore');
    const loadMoreBtn = document.getElementById('loadMoreRecentBtn');

    if (!recentTestsList) return;

    lastVisibleRecentDoc = null;
    recentTestsList.innerHTML = '<p class="no-tests">Loading...</p>';

    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc"),
        limit(RECENT_TESTS_PAGE_SIZE)
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            recentTestsList.innerHTML = '<p class="no-tests">No tests yet. Start practicing!</p>';
            if (loadMoreContainer) loadMoreContainer.style.display = 'none';
            return;
        }

        const results = [];
        snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }));
        lastVisibleRecentDoc = snapshot.docs[snapshot.docs.length - 1];

        recentTestsList.innerHTML = results.map(test => buildRecentTestHTML(test)).join('');
        if (loadMoreContainer) {
            loadMoreContainer.style.display = results.length === RECENT_TESTS_PAGE_SIZE ? 'block' : 'none';
        }

        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> See more';
            loadMoreBtn.disabled = false;
            loadMoreBtn.onclick = () => loadMoreRecentTests(userId);
        }
    } catch (error) {
        console.error("Error loading recent tests:", error);
        if (recentTestsList) {
            recentTestsList.innerHTML = '<p class="error">Error loading recent tests. Please refresh.</p>';
        }
    }
}

async function loadMoreRecentTests(userId) {
    if (!lastVisibleRecentDoc) return;

    const recentTestsList = document.getElementById('recentTestsList');
    const loadMoreBtn = document.getElementById('loadMoreRecentBtn');
    const loadMoreContainer = document.getElementById('recentTestsMore');

    if (loadMoreBtn) {
        loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        loadMoreBtn.disabled = true;
    }

    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc"),
        startAfter(lastVisibleRecentDoc),
        limit(RECENT_TESTS_PAGE_SIZE)
    );

    try {
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            if (loadMoreContainer) loadMoreContainer.style.display = 'none';
            return;
        }

        const newResults = [];
        snapshot.forEach((d) => newResults.push({ id: d.id, ...d.data() }));

        recentTestsList.insertAdjacentHTML('beforeend',
            newResults.map(test => buildRecentTestHTML(test)).join(''));

        lastVisibleRecentDoc = snapshot.docs[snapshot.docs.length - 1];

        if (newResults.length < RECENT_TESTS_PAGE_SIZE && loadMoreContainer) {
            loadMoreContainer.style.display = 'none';
        } else if (loadMoreContainer) {
            loadMoreContainer.style.display = 'block';
        }
    } catch (error) {
        console.error("Error loading more tests:", error);
        alert("Failed to load more tests. Please try again.");
    } finally {
        if (loadMoreBtn) {
            loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> See more';
            loadMoreBtn.disabled = false;
        }
    }
}

function buildRecentTestHTML(test) {
    const mode = test.mode;
    const completedAt = test.completedAt ? convertTimestamp(test.completedAt) : null;
    const dateStr = completedAt ? completedAt.toLocaleDateString() : 'Unknown date';

    let typeIcon = '<i class="fas fa-pencil-alt"></i>';
    let mainContent = '';

    switch (mode) {
        case 'quick':
            typeIcon = '<i class="fas fa-bolt"></i>';
            mainContent = renderQuickTest(test);
            break;
        case 'waec_neco':
            typeIcon = '<i class="fas fa-school"></i>';
            mainContent = renderWaecNecoTest(test);
            break;
        case 'jamb_drill':
            typeIcon = '<i class="fas fa-graduation-cap"></i>';
            mainContent = renderJambDrillTest(test);
            break;
        default:
            mainContent = renderUnknownTest(test);
    }

    return `
        <div class="recent-test-item">
            <div class="test-header">
                <div class="test-type-badge">${typeIcon}</div>
                <div class="test-date">${escapeHtml(dateStr)}</div>
            </div>
            ${mainContent}
        </div>
    `;
}

function renderQuickTest(test) {
    const subject = test.subjectName || test.subject || 'Unknown';
    const rawScore = test.rawScore !== undefined ? test.rawScore : 0;
    const total = test.totalQuestions || 0;
    const scoreText = total > 0 ? `${rawScore}/${total}` : 'N/A';
    return `
        <div class="test-main">
            <div class="test-subject">${escapeHtml(subject)}</div>
            <div class="test-score">Score: <strong>${scoreText}</strong></div>
        </div>
    `;
}

function renderWaecNecoTest(test) {
    const subject = test.subjectName || test.subject || 'Unknown';
    const subjectScores = test.subjectScores || {};
    const totalRaw = test.rawScore !== undefined ? test.rawScore : 0;
    const totalQuestions = test.totalQuestions || 0;
    let subjectRow = '';
    if (Object.keys(subjectScores).length > 0) {
        for (const [subjValue, scoreObj] of Object.entries(subjectScores)) {
            const subjName = subjValue.charAt(0).toUpperCase() + subjValue.slice(1);
            const raw = scoreObj.correct !== undefined ? scoreObj.correct : (scoreObj.raw || 0);
            const total = scoreObj.total || totalQuestions;
            subjectRow += `<div class="subject-score-row"><span class="subject-name">${escapeHtml(subjName)}:</span> <span class="score-value">${raw}/${total}</span></div>`;
        }
    } else {
        subjectRow = `<div class="subject-score-row"><span class="subject-name">Total:</span> <span class="score-value">${totalRaw}/${totalQuestions}</span></div>`;
    }
    return `
        <div class="test-main">
            <div class="test-subject">${escapeHtml(subject)}</div>
            <div class="subject-scores">${subjectRow}</div>
            <div class="test-total-score">Total: <strong>${totalRaw}/${totalQuestions}</strong></div>
        </div>
    `;
}

function renderJambDrillTest(test) {
    const subjectScores = test.subjectScores || {};
    const subjectsList = test.subjects || [];
    const totalRaw = test.rawScore !== undefined ? test.rawScore : 0;
    const totalQuestions = test.totalQuestions || 0;
    let subjectRows = '';

    if (subjectsList.length > 0) {
        for (const subj of subjectsList) {
            const scoreObj = subjectScores[subj.value] || { correct: 0, total: subj.count || 0 };
            const raw = scoreObj.correct !== undefined ? scoreObj.correct : (scoreObj.raw || 0);
            const total = scoreObj.total || subj.count || 0;
            subjectRows += `<div class="subject-score-row"><span class="subject-name">${escapeHtml(subj.name)}:</span> <span class="score-value">${raw}/${total}</span></div>`;
        }
    } else if (Object.keys(subjectScores).length > 0) {
        for (const [subjValue, scoreObj] of Object.entries(subjectScores)) {
            const subjName = subjValue.charAt(0).toUpperCase() + subjValue.slice(1);
            const raw = scoreObj.correct !== undefined ? scoreObj.correct : (scoreObj.raw || 0);
            const total = scoreObj.total || 0;
            subjectRows += `<div class="subject-score-row"><span class="subject-name">${escapeHtml(subjName)}:</span> <span class="score-value">${raw}/${total}</span></div>`;
        }
    } else {
        subjectRows = `<div class="subject-score-row"><span class="subject-name">Total:</span> <span class="score-value">${totalRaw}/${totalQuestions}</span></div>`;
    }

    let totalPossible = 180;
    if (subjectsList.length) {
        totalPossible = subjectsList.reduce((sum, s) => sum + (s.count || 0), 0);
    }
    const totalScoreText = totalRaw && totalPossible ? `${totalRaw}/${totalPossible}` : 'N/A';

    return `
        <div class="test-main jamb-detail">
            <div class="test-subject">JAMB Drill</div>
            <div class="subject-scores">${subjectRows}</div>
            <div class="test-total-score">Total: <strong>${totalScoreText}</strong></div>
        </div>
    `;
}

function renderUnknownTest(test) {
    const rawScore = test.rawScore !== undefined ? test.rawScore : 0;
    const total = test.totalQuestions || 0;
    const scoreText = total > 0 ? `${rawScore}/${total}` : 'N/A';
    return `
        <div class="test-main">
            <div class="test-subject">${escapeHtml(test.subject || 'Test')}</div>
            <div class="test-score">Score: <strong>${scoreText}</strong></div>
        </div>
    `;
}

// ========== ANALYTICS ==========
async function fetchUserTestResults(userId) {
    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc")
    );
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let scorePercent = data.score;
        if (data.mode === 'jamb_drill' && data.totalQuestions) {
            scorePercent = (data.rawScore / data.totalQuestions) * 100;
        }
        results.push({
            ...data,
            id: docSnap.id,
            scorePercent: Math.round(scorePercent),
            completedAt: data.completedAt?.toDate ? data.completedAt.toDate() : new Date(data.completedAt)
        });
    });
    return results;
}

async function getWeeklyTrend(userId) {
    const results = await fetchUserTestResults(userId);
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const last7Days = results.filter(r => r.completedAt >= sevenDaysAgo);
    const dayMap = new Map();
    last7Days.forEach(r => {
        const dateStr = r.completedAt.toISOString().split('T')[0];
        if (!dayMap.has(dateStr)) dayMap.set(dateStr, []);
        dayMap.get(dateStr).push(r.scorePercent);
    });
    const trend = [];
    for (let i = 0; i < 7; i++) {
        const date = new Date(now);
        date.setDate(now.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const scores = dayMap.get(dateStr) || [];
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        trend.push({ date: dateStr, averageScore: avg });
    }
    return trend.reverse();
}

async function getMonthlyTrend(userId) {
    const results = await fetchUserTestResults(userId);
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(now.getMonth() - 6);
    const recent = results.filter(r => r.completedAt >= sixMonthsAgo);
    const monthMap = new Map();
    recent.forEach(r => {
        const monthKey = r.completedAt.toLocaleString('default', { month: 'short', year: 'numeric' });
        if (!monthMap.has(monthKey)) monthMap.set(monthKey, []);
        monthMap.get(monthKey).push(r.scorePercent);
    });
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(now.getMonth() - i);
        const monthKey = d.toLocaleString('default', { month: 'short', year: 'numeric' });
        const scores = monthMap.get(monthKey) || [];
        const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
        monthly.push({ month: monthKey, averageScore: avg });
    }
    return monthly;
}

async function calculateAverageTime(userId) {
    const results = await fetchUserTestResults(userId);
    let totalTime = 0, totalQuestions = 0;
    results.forEach(r => {
        if (r.timeSpent && r.totalQuestions) {
            totalTime += r.timeSpent;
            totalQuestions += r.totalQuestions;
        }
    });
    if (totalQuestions === 0) return null;
    return (totalTime / totalQuestions).toFixed(1);
}

async function getBestSubject(userId) {
    const results = await fetchUserTestResults(userId);
    const subjectMap = new Map();
    results.forEach(r => {
        const subject = r.subjectName || r.subject || 'Unknown';
        if (!subjectMap.has(subject)) subjectMap.set(subject, { totalScore: 0, count: 0 });
        const entry = subjectMap.get(subject);
        entry.totalScore += r.scorePercent;
        entry.count++;
    });
    let best = null;
    for (let [subject, data] of subjectMap.entries()) {
        if (data.count >= 3) {
            const avg = Math.round(data.totalScore / data.count);
            if (!best || avg > best.avg) best = { subject, averageScore: avg };
        }
    }
    return best;
}

async function getMostImprovedTopic(userId) {
    try {
        const colRef = collection(db, "users", userId, "topicCumulative");
        const snapshot = await getDocs(colRef);
        let best = null;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const totalAnswered = data.totalAnswered || 0;
            if (totalAnswered < 5) return;
            const totalCorrect = data.totalCorrect || 0;
            const currentAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;
            const lastAccuracy = data.lastAccuracy !== undefined ? data.lastAccuracy : null;
            if (lastAccuracy !== null) {
                const improvement = currentAccuracy - lastAccuracy;
                if (improvement > 0 && (!best || improvement > best.improvement)) {
                    best = { topic: data.topic || 'Unknown', improvement: Math.round(improvement) };
                }
            }
        });
        return best;
    } catch (error) {
        console.error("Error fetching topic stats:", error);
        return null;
    }
}

function renderWeeklyChart(data) {
    const ctx = document.getElementById('weeklyTrendChart')?.getContext('2d');
    if (!ctx) return;
    const theme = getChartTheme();
    if (weeklyChartInstance) {
        try { weeklyChartInstance.destroy(); } catch (e) { /* non-fatal */ }
        weeklyChartInstance = null;
    }
    weeklyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.slice(5)),
            datasets: [{
                label: 'Avg Score %',
                data: data.map(d => d.averageScore),
                borderColor: theme.lineColor,
                backgroundColor: theme.lineFill,
                tension: 0.35,
                fill: true,
                pointBackgroundColor: theme.linePointBg,
                pointBorderColor: theme.linePointBorder,
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: theme.legendColor } }
            },
            scales: {
                y: {
                    beginAtZero: true, max: 100,
                    ticks: { color: theme.tickColor },
                    grid: { color: theme.gridColor }
                },
                x: {
                    ticks: { color: theme.tickColor },
                    grid: { color: theme.gridColor }
                }
            }
        }
    });
}

function renderMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    const theme = getChartTheme();
    if (monthlyChartInstance) {
        try { monthlyChartInstance.destroy(); } catch (e) { /* non-fatal */ }
        monthlyChartInstance = null;
    }
    monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.month),
            datasets: [{
                label: 'Avg Score %',
                data: data.map(d => d.averageScore),
                backgroundColor: theme.barFill,
                borderColor: theme.barBorder,
                borderWidth: 1,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: theme.legendColor } }
            },
            scales: {
                y: {
                    beginAtZero: true, max: 100,
                    ticks: { color: theme.tickColor },
                    grid: { color: theme.gridColor }
                },
                x: {
                    ticks: { color: theme.tickColor },
                    grid: { color: theme.gridColor }
                }
            }
        }
    });
}

async function loadAnalytics(userId) {
    if (!document.getElementById('weeklyTrendChart')) return;
    try {
        const weekly = await getWeeklyTrend(userId);
        renderWeeklyChart(weekly);
        const monthly = await getMonthlyTrend(userId);
        renderMonthlyChart(monthly);
        const avgTime = await calculateAverageTime(userId);
        const avgTimeDisplay = getElement('avgTimeDisplay');
        if (avgTimeDisplay) avgTimeDisplay.textContent = avgTime ? avgTime + 's' : '—';
        const bestSubj = await getBestSubject(userId);
        const bestSubjectDisplay = getElement('bestSubjectDisplay');
        const bestSubjectScore = getElement('bestSubjectScore');
        if (bestSubj) {
            if (bestSubjectDisplay) bestSubjectDisplay.textContent = bestSubj.subject;
            if (bestSubjectScore) bestSubjectScore.textContent = `${bestSubj.averageScore}% avg`;
        } else {
            if (bestSubjectDisplay) bestSubjectDisplay.textContent = '—';
            if (bestSubjectScore) bestSubjectScore.textContent = '';
        }
        const improvedTopic = await getMostImprovedTopic(userId);
        const improvedTopicDisplay = getElement('improvedTopicDisplay');
        const improvedTopicDelta = getElement('improvedTopicDelta');
        if (improvedTopic) {
            if (improvedTopicDisplay) improvedTopicDisplay.textContent = improvedTopic.topic;
            if (improvedTopicDelta) improvedTopicDelta.textContent = `+${improvedTopic.improvement}%`;
        } else {
            if (improvedTopicDisplay) improvedTopicDisplay.textContent = '—';
            if (improvedTopicDelta) improvedTopicDelta.textContent = '';
        }
    } catch (error) {
        console.error('Error loading analytics:', error);
    }
}

// ========== LEADERBOARD ==========
async function getAllUsers() {
    const snapshot = await getDocs(collection(db, "users"));
    const users = [];
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        users.push({
            id: docSnap.id,
            fullName: data.fullName || data.email || 'Anonymous',
            email: data.email
        });
    });
    return users;
}

async function getLeaderboardTop10() {
    const users = await getAllUsers();
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const leaderboard = [];
    for (let user of users) {
        const q = query(
            collection(db, "test_results"),
            where("userId", "==", user.id),
            where("completedAt", ">=", sevenDaysAgo)
        );
        const snapshot = await getDocs(q);
        let totalScore = 0, count = 0;
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) {
                score = (data.rawScore / data.totalQuestions) * 100;
            }
            totalScore += score;
            count++;
        });
        if (count > 0) {
            leaderboard.push({ name: user.fullName, averageScore: Math.round(totalScore / count) });
        }
    }
    leaderboard.sort((a, b) => b.averageScore - a.averageScore);
    return leaderboard.slice(0, 10);
}

async function getTopPerSubject() {
    const users = await getAllUsers();
    const subjectMap = {};
    for (let user of users) {
        const q = query(collection(db, "test_results"), where("userId", "==", user.id));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const subject = data.subjectName || data.subject || 'Unknown';
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) {
                score = (data.rawScore / data.totalQuestions) * 100;
            }
            if (!subjectMap[subject]) subjectMap[subject] = [];
            subjectMap[subject].push({ name: user.fullName, score: Math.round(score) });
        });
    }
    const topPerSubject = {};
    for (let subject in subjectMap) {
        subjectMap[subject].sort((a, b) => b.score - a.score);
        topPerSubject[subject] = subjectMap[subject].slice(0, 1);
    }
    return topPerSubject;
}

async function getMostImprovedStudent() {
    const users = await getAllUsers();
    const now = new Date();
    const oneWeekAgo = new Date(now); oneWeekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(now.getDate() - 14);
    const improvements = [];
    for (let user of users) {
        const thisWeekQuery = query(
            collection(db, "test_results"),
            where("userId", "==", user.id),
            where("completedAt", ">=", oneWeekAgo)
        );
        const thisWeekSnap = await getDocs(thisWeekQuery);
        let thisWeekTotal = 0, thisWeekCount = 0;
        thisWeekSnap.forEach(docSnap => {
            const data = docSnap.data();
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) score = (data.rawScore / data.totalQuestions) * 100;
            thisWeekTotal += score; thisWeekCount++;
        });
        const thisWeekAvg = thisWeekCount > 0 ? thisWeekTotal / thisWeekCount : 0;

        const lastWeekQuery = query(
            collection(db, "test_results"),
            where("userId", "==", user.id),
            where("completedAt", ">=", twoWeeksAgo),
            where("completedAt", "<", oneWeekAgo)
        );
        const lastWeekSnap = await getDocs(lastWeekQuery);
        let lastWeekTotal = 0, lastWeekCount = 0;
        lastWeekSnap.forEach(docSnap => {
            const data = docSnap.data();
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) score = (data.rawScore / data.totalQuestions) * 100;
            lastWeekTotal += score; lastWeekCount++;
        });
        const lastWeekAvg = lastWeekCount > 0 ? lastWeekTotal / lastWeekCount : 0;

        if (thisWeekCount > 0 && lastWeekCount > 0) {
            const improvement = Math.round(thisWeekAvg - lastWeekAvg);
            if (improvement > 0) improvements.push({ name: user.fullName, improvement });
        }
    }
    improvements.sort((a, b) => b.improvement - a.improvement);
    return improvements.slice(0, 3);
}

async function getHighestJambScore() {
    const users = await getAllUsers();
    let highest = null;
    for (let user of users) {
        const q = query(
            collection(db, "test_results"),
            where("userId", "==", user.id),
            where("mode", "==", "jamb_drill")
        );
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const score = data.score || 0;
            if (!highest || score > highest.score) highest = { name: user.fullName, score };
        });
    }
    return highest;
}

async function loadLeaderboard() {
    if (!document.getElementById('leaderboardTop10')) return;
    try {
        const top10 = await getLeaderboardTop10();
        const top10Container = getElement('leaderboardTop10');
        if (top10Container) {
            top10Container.innerHTML = top10.length
                ? top10.map((item, i) => `
                    <div class="leaderboard-item">
                        <span class="rank">${i + 1}</span>
                        <span class="name">${item.name}</span>
                        <span class="score">${item.averageScore}%</span>
                    </div>`).join('')
                : '<p class="placeholder">No data this week</p>';
        }

        const topPerSubj = await getTopPerSubject();
        const subjectTabs = getElement('subjectTabsLeaderboard');
        const topList = getElement('topPerSubjectList');
        const subjects = Object.keys(topPerSubj);
        if (subjectTabs && topList) {
            if (subjects.length) {
                subjectTabs.innerHTML = subjects.map(s => `<button class="subject-tab" data-subject="${s}">${s}</button>`).join('');
                const showTopForSubject = (subject) => {
                    const list = topPerSubj[subject] || [];
                    topList.innerHTML = list.map(item => `
                        <div class="leaderboard-item">
                            <span class="name">${item.name}</span>
                            <span class="score">${item.score}%</span>
                        </div>`).join('');
                };
                showTopForSubject(subjects[0]);
                document.querySelectorAll('#subjectTabsLeaderboard .subject-tab').forEach(btn => {
                    btn.addEventListener('click', () => showTopForSubject(btn.dataset.subject));
                });
            } else {
                subjectTabs.innerHTML = '';
                topList.innerHTML = '<p class="placeholder">No subject data</p>';
            }
        }

        const improved = await getMostImprovedStudent();
        const mostImprovedStudent = getElement('mostImprovedStudent');
        const mostImprovedDelta = getElement('mostImprovedDelta');
        if (improved.length) {
            if (mostImprovedStudent) mostImprovedStudent.textContent = improved[0].name;
            if (mostImprovedDelta) mostImprovedDelta.textContent = `+${improved[0].improvement}%`;
        } else {
            if (mostImprovedStudent) mostImprovedStudent.textContent = '—';
            if (mostImprovedDelta) mostImprovedDelta.textContent = '';
        }

        const highest = await getHighestJambScore();
        const highestJambScore = getElement('highestJambScore');
        const highestJambScoreName = getElement('highestJambScoreName');
        if (highest) {
            if (highestJambScore) highestJambScore.textContent = highest.score;
            if (highestJambScoreName) highestJambScoreName.textContent = highest.name;
        } else {
            if (highestJambScore) highestJambScore.textContent = '—';
            if (highestJambScoreName) highestJambScoreName.textContent = '';
        }
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

// ========== SUBJECT DROPDOWNS ==========
function setupSubjectDropdown() {
    if (!subjectSelect) return;
    subjectSelect.innerHTML = '<option value="" disabled selected>Choose subject</option>';
    ALL_SUBJECTS.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.value;
        option.textContent = subject.name;
        subjectSelect.appendChild(option);
    });
}

function populateWaecNecoSubjects() {
    if (!waecNecoSubjectSelect) return;
    waecNecoSubjectSelect.innerHTML = '<option value="" disabled selected>Choose subject</option>';
    ALL_SUBJECTS.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.value;
        option.textContent = subject.name;
        waecNecoSubjectSelect.appendChild(option);
    });
}

// ========== JAMB DRILL ==========
function setupJambDrillSubjects() {
    if (!additionalSubjectsDiv) return;
    additionalSubjectsDiv.innerHTML = '';
    ALL_SUBJECTS.forEach(subject => {
        if (subject.value === 'english') return;
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.alignItems = 'center';
        wrapper.style.gap = '8px';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = subject.value;
        checkbox.id = `subj_${subject.value}`;
        checkbox.className = 'jamb-subject-checkbox';
        const label = document.createElement('label');
        label.htmlFor = `subj_${subject.value}`;
        label.textContent = subject.name + ' (40 questions)';
        label.style.margin = '0';
        label.style.fontWeight = '400';
        wrapper.appendChild(checkbox);
        wrapper.appendChild(label);
        additionalSubjectsDiv.appendChild(wrapper);
    });
    document.querySelectorAll('.jamb-subject-checkbox').forEach(cb => {
        cb.addEventListener('change', validateJambSubjectSelection);
    });
}

function validateJambSubjectSelection() {
    const checkboxes = document.querySelectorAll('.jamb-subject-checkbox:checked');
    const hint = document.getElementById('subjectSelectionHint');
    if (!hint) return;
    if (checkboxes.length === 3) {
        hint.innerHTML = '✅ 3 subjects selected. Ready to start.';
        hint.style.color = '#34c759';
    } else {
        hint.innerHTML = `Select exactly 3 subjects (currently ${checkboxes.length} selected)`;
        hint.style.color = '#ff3b30';
    }
}

// ========== START QUICK TEST ==========
async function startQuickTest() {
    const selectedExam = classSelect.value;
    const selectedSubject = subjectSelect.value;
    if (!selectedExam || !selectedSubject) {
        alert('❌ Please select exam and subject');
        return;
    }
    try {
        showLoadingState(true, startQuickTestBtn);
        const firestoreExamType = EXAM_TYPE_MAP[selectedExam] || selectedExam;
        const allQuestions = await fetchQuestions(firestoreExamType, selectedSubject);
        if (allQuestions.length < QUESTIONS_TO_FETCH) {
            showLoadingState(false, startQuickTestBtn);
            alert(`Only ${allQuestions.length} questions available for "${selectedSubject}".`);
            return;
        }
        const shuffledQuestions = shuffleArray([...allQuestions]);
        const selectedQuestions = shuffledQuestions.slice(0, QUESTIONS_TO_FETCH);
        const totalTime = selectedQuestions.reduce((total, q) => total + (parseInt(q.timeLimit) || 120), 0);
        const testData = {
            testId: generateTestId(),
            mode: 'quick',
            examType: firestoreExamType,
            subject: selectedSubject,
            questions: selectedQuestions,
            totalQuestions: selectedQuestions.length,
            totalTime,
            startTime: new Date().toISOString(),
            userId: auth.currentUser.uid,
            userAnswers: Array(selectedQuestions.length).fill(null)
        };
        sessionStorage.setItem('currentTest', JSON.stringify(testData));
        window.location.href = 'test.html';
    } catch (error) {
        console.error('Error starting test:', error);
        showLoadingState(false, startQuickTestBtn);
        alert(`❌ Error starting test: ${error.message || 'Please try again.'}`);
    }
}

// ========== START JAMB DRILL ==========
async function startJambDrill() {
    const selectedCheckboxes = document.querySelectorAll('.jamb-subject-checkbox:checked');
    if (selectedCheckboxes.length !== 3) {
        alert('❌ Please select exactly 3 additional subjects.');
        return;
    }
    const subjects = [
        { value: 'english', name: 'English Language', count: 60 },
        ...Array.from(selectedCheckboxes).map(cb => {
            const subject = ALL_SUBJECTS.find(s => s.value === cb.value);
            return { value: cb.value, name: subject.name, count: 40 };
        })
    ];
    try {
        showLoadingState(true, startJambDrillBtn);
        const subjectQuestionMap = {};
        for (let subj of subjects) {
            const questions = await fetchQuestions('JAMB', subj.value);
            if (questions.length < subj.count) {
                showLoadingState(false, startJambDrillBtn);
                alert(`Not enough questions for ${subj.name}. Available: ${questions.length}, needed: ${subj.count}.`);
                return;
            }
            const shuffled = shuffleArray(questions);
            const selected = shuffled.slice(0, subj.count).map(q => ({
                ...q, subject: subj.value, subjectName: subj.name
            }));
            subjectQuestionMap[subj.value] = selected;
        }
        const finalQuestions = [];
        subjects.forEach(subj => finalQuestions.push(...subjectQuestionMap[subj.value]));
        const testData = {
            testId: generateTestId(),
            mode: 'jamb_drill',
            examType: 'JAMB',
            subjects,
            questions: finalQuestions,
            totalQuestions: finalQuestions.length,
            totalTime: 120 * 60,
            startTime: new Date().toISOString(),
            userId: auth.currentUser.uid,
            userAnswers: Array(finalQuestions.length).fill(null)
        };
        sessionStorage.setItem('currentTest', JSON.stringify(testData));
        window.location.href = 'test.html';
    } catch (error) {
        console.error('Error starting JAMB Drill:', error);
        showLoadingState(false, startJambDrillBtn);
        alert(`❌ Error starting JAMB Drill: ${error.message || 'Please try again.'}`);
    }
}

// ========== START WAEC/NECO DRILL ==========
async function startWaecNecoDrill() {
    const selectedSubject = waecNecoSubjectSelect.value;
    if (!selectedSubject) {
        alert('❌ Please select a subject');
        return;
    }
    try {
        showLoadingState(true, startWaecNecoDrillBtn);
        const allQuestions = await fetchQuestions('WAEC/NECO', selectedSubject);
        if (allQuestions.length < WAEC_NECO_QUESTIONS) {
            showLoadingState(false, startWaecNecoDrillBtn);
            alert(`Only ${allQuestions.length} WAEC/NECO questions available for "${selectedSubject}".`);
            return;
        }
        const shuffled = shuffleArray([...allQuestions]);
        const selectedQuestions = shuffled.slice(0, WAEC_NECO_QUESTIONS);
        const testData = {
            testId: generateTestId(),
            mode: 'waec_neco',
            examType: 'WAEC/NECO',
            subject: selectedSubject,
            questions: selectedQuestions,
            totalQuestions: selectedQuestions.length,
            totalTime: WAEC_NECO_TIME,
            startTime: new Date().toISOString(),
            userId: auth.currentUser.uid,
            userAnswers: Array(selectedQuestions.length).fill(null)
        };
        sessionStorage.setItem('currentTest', JSON.stringify(testData));
        window.location.href = 'test.html';
    } catch (error) {
        console.error('Error starting WAEC/NECO Drill:', error);
        showLoadingState(false, startWaecNecoDrillBtn);
        alert(`❌ Error starting test: ${error.message || 'Please try again.'}`);
    }
}

// ========== FETCH QUESTIONS ==========
async function fetchQuestions(examType, subject) {
    try {
        const q = query(
            collection(db, "questions"),
            where("examType", "==", examType),
            where("subject", "==", subject)
        );
        const querySnapshot = await getDocs(q);
        const questions = [];
        querySnapshot.forEach((docSnap) => {
            const questionData = docSnap.data();
            const hasContent = (questionData.questionText && questionData.questionText.trim() !== '') || questionData.questionImage;
            const hasCorrectAnswer = questionData.correctAnswer && ['A', 'B', 'C', 'D'].includes(questionData.correctAnswer);
            if (hasContent && hasCorrectAnswer) {
                questions.push({
                    id: docSnap.id,
                    ...questionData,
                    options: questionData.options || {
                        A: questionData.optionA || "",
                        B: questionData.optionB || "",
                        C: questionData.optionC || "",
                        D: questionData.optionD || ""
                    }
                });
            }
        });
        return questions;
    } catch (error) {
        console.error('Error in fetchQuestions:', error);
        throw error;
    }
}

// ========== PROFILE ==========
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function compressImageWithParams(file, maxWidth, maxHeight, quality) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = (e) => {
            img.src = e.target.result;
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', quality));
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function compressToTargetSize(file, targetSizeKB = 200) {
    const targetBase64Length = targetSizeKB * 1024 * 1.33;
    let maxWidth = 800, maxHeight = 800, quality = 0.8;
    let compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, quality);
    if (compressedBase64.length <= targetBase64Length) return compressedBase64;
    for (let q of [0.7, 0.6, 0.5, 0.4, 0.3, 0.2]) {
        compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, q);
        if (compressedBase64.length <= targetBase64Length) return compressedBase64;
    }
    for (let dim of [600, 500, 400, 300]) {
        compressedBase64 = await compressImageWithParams(file, dim, dim, 0.6);
        if (compressedBase64.length <= targetBase64Length) return compressedBase64;
        compressedBase64 = await compressImageWithParams(file, dim, dim, 0.4);
        if (compressedBase64.length <= targetBase64Length) return compressedBase64;
    }
    return await compressImageWithParams(file, 300, 300, 0.3);
}

async function handleProfileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }
    const user = auth.currentUser;
    if (!user) { alert('You must be logged in to upload a profile picture'); return; }
    try {
        profileImg.src = '';
        profileImg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>';
        let base64;
        const ONE_MB = 1048576;
        if (file.size >= ONE_MB) base64 = await compressToTargetSize(file, 200);
        else base64 = await convertImageToBase64(file);
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, { profilePicture: base64, profileUpdatedAt: serverTimestamp() });
        if (currentUserData) currentUserData.profilePicture = base64;
        profileImg.src = base64;
        profileImg.innerHTML = '';
        profileImg.alt = "Profile Picture";
        alert('✅ Profile picture updated successfully!');
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        let userMessage = '❌ Failed to upload profile picture. ';
        if (error.code === 'permission-denied') userMessage += 'Permission denied – your Firestore security rules are blocking this update.';
        else if (error.code === 'not-found') userMessage += 'Your user profile document is missing.';
        else if (error.code === 'resource-exhausted') userMessage += 'The image is too large.';
        else userMessage += error.message || 'Please try again.';
        alert(userMessage);
        setDefaultProfileImage();
    } finally {
        event.target.value = '';
    }
}

async function loadUserProfile(userData) {
    if (!userData) return;
    if (userName) {
        const displayName = userData.fullName || userData.email || 'Student';
        userName.textContent = displayName;
        showWelcomeBanner(displayName);
    }
    if (profileImg) {
        if (userData.profilePicture) {
            profileImg.src = userData.profilePicture;
            profileImg.alt = "Profile Picture";
            profileImg.innerHTML = '';
        } else {
            setDefaultProfileImage();
        }
    }
}

function setDefaultProfileImage() {
    if (!profileImg) return;
    const user = auth.currentUser;
    let name = 'User';
    if (user && user.displayName) name = user.displayName.split(' ')[0];
    else if (user && user.email) name = user.email.split('@')[0];
    profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=007aff&color=fff&size=120&bold=true`;
    profileImg.alt = "Default Profile";
    profileImg.innerHTML = '';
}

// ========== INITIALIZE ==========
function initDashboard() {
    // Theme must be applied immediately, before auth resolves.
    initTheme();

    onAuthStateChanged(auth, (user) => {
        if (!user) {
            window.location.href = '../index.html';
        } else {
            loadUserData(user.uid);
        }
    });

    if (startQuickTestBtn) startQuickTestBtn.addEventListener('click', startQuickTest);
    if (startJambDrillBtn) startJambDrillBtn.addEventListener('click', startJambDrill);
    if (startWaecNecoDrillBtn) startWaecNecoDrillBtn.addEventListener('click', startWaecNecoDrill);
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        try {
            if (unsubscribeStats) unsubscribeStats();
            await signOut(auth);
            window.location.href = '../index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    });
    if (profileUpload) profileUpload.addEventListener('change', handleProfileUpload);

    if (toggleAllSubjectsBtn && additionalSubjectsDiv) {
        toggleAllSubjectsBtn.addEventListener('click', () => {
            const isHidden = additionalSubjectsDiv.style.display === 'none' || additionalSubjectsDiv.style.display === '';
            additionalSubjectsDiv.style.display = isHidden ? 'grid' : 'none';
            toggleAllSubjectsBtn.innerHTML = isHidden
                ? '<i class="fas fa-chevron-up"></i> Hide Subjects'
                : '<i class="fas fa-chevron-down"></i> Show all Subjects';
        });
    }

    populateWaecNecoSubjects();
}

initDashboard();