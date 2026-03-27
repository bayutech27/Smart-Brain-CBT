// js/dashboard.js - Student Dashboard with Firestore Integration
import { auth, db } from "./main.js";
import { 
    collection, 
    query, 
    where, 
    getDocs,
    orderBy,
    getDoc,
    doc,
    updateDoc,
    increment,
    serverTimestamp,
    onSnapshot,
    setDoc,
    limit
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import { 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// ========== CONSTANTS ==========
const WAEC_NECO_QUESTIONS = 50;
const WAEC_NECO_TIME = 40 * 60; // 40 minutes in seconds

const QUESTIONS_TO_FETCH = 20;
const FREE_PLAN_WEEKLY_LIMIT = 3;
const FREE_PLAN_SUBJECTS = ['mathematics', 'english'];
const PREMIUM_PLAN_DURATION_DAYS = 30;

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
    // New premium subjects
    { value: 'civic', name: 'Civic Education' },
    { value: 'geography', name: 'Geography' },
    { value: 'ict', name: 'ICT (Computer Studies)' },
    { value: 'marketing', name: 'Marketing' },
    { value: 'agric', name: 'Agricultural Science'},
    { value: 'yoruba', name: 'Yoruba'}
];


// ========== DOM ELEMENTS (with null checks) ==========
const getElement = (id) => document.getElementById(id);

const startQuickTestBtn = getElement('startQuickTestBtn');
const classSelect = getElement('classSelect');
const subjectSelect = getElement('subjectSelect');
const logoutBtn = getElement('logoutBtn');
const userName = getElement('userName');
const profileUpload = getElement('profileUpload');
const profileImg = getElement('profileImg');
const premiumBanner = getElement('premiumBanner');
const upgradeBtn = getElement('upgradeBtn');
const planRestrictions = getElement('planRestrictions');
const testLimitInfo = getElement('testLimitInfo');
const testsRemaining = getElement('testsRemaining');
const userPlanStatus = getElement('userPlanStatus');
const userPlan = getElement('userPlan');
const planStatus = getElement('planStatus');
const planStatusCard = getElement('planStatusCard');
const planIcon = getElement('planIcon');

// JAMB Drill
const jambDrillSection = getElement('jambDrillSection');
const jambDrillPremiumNotice = getElement('jambDrillPremiumNotice');
const additionalSubjectsDiv = getElement('additionalSubjects');
const startJambDrillBtn = getElement('startJambDrillBtn');

// WAEC/NECO Drill (Premium only)
const waecNecoDrillSection = getElement('waecNecoDrillSection');
const waecNecoPremiumNotice = getElement('waecNecoPremiumNotice');
const waecNecoSubjectSelect = getElement('waecNecoSubjectSelect');
const startWaecNecoDrillBtn = getElement('startWaecNecoDrillBtn');

// Stats
const completedTests = getElement('completedTests');
const averageScore = getElement('averageScore');
const performanceMessage = getElement('performanceMessage');

// ========== STATE ==========
let currentUserData = null;
let unsubscribeStats = null;
let expirationInterval = null;
let isResetting = false; // lock for weekly reset

// ========== HELPER: SAFE TIMESTAMP CONVERSION ==========
function convertTimestamp(value) {
    if (!value) return null;
    // Firestore Timestamp with toDate()
    if (typeof value.toDate === 'function') {
        return value.toDate();
    }
    // Old format with seconds
    if (value.seconds !== undefined) {
        return new Date(value.seconds * 1000);
    }
    // ISO string or date string
    if (typeof value === 'string') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    // milliseconds number
    if (typeof value === 'number') {
        const d = new Date(value);
        if (!isNaN(d.getTime())) return d;
    }
    // Already a Date object
    if (value instanceof Date && !isNaN(value.getTime())) {
        return value;
    }
    return null;
}

// ========== UTILITY FUNCTIONS ==========
function showWelcomeBanner(userName) {
    const shouldShow = sessionStorage.getItem('showWelcome');
    if (!shouldShow) return;

    const banner = document.createElement('div');
    banner.id = 'welcomeBanner';
    banner.style.cssText = `
        background: linear-gradient(135deg, #4CAF50, #2E7D32);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1.5rem;
        text-align: center;
        font-size: 1.1rem;
        animation: fadeIn 0.5s;
    `;
    banner.innerHTML = `
        <i class="fas fa-tada" style="font-size: 1.5rem; margin-right: 0.5rem;"></i>
        🎉 Congratulations, <strong>${userName}</strong>! Your FREE plan account is ready.
        <button onclick="this.parentElement.remove(); sessionStorage.removeItem('showWelcome');" 
                style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 0.3rem 1rem; border-radius: 20px; margin-left: 1rem; cursor: pointer;">
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

// ========== FIREBASE USER & PLAN MANAGEMENT ==========
async function checkAndResetTestCount(userId, userData) {
    // Prevent concurrent resets
    if (isResetting) return;
    if (userData.plan !== 'free') return;

    try {
        isResetting = true;

        // Safely convert last reset date
        const lastReset = convertTimestamp(userData.lastTestResetDate);
        const now = new Date();

        // If no lastReset, initialize it
        if (!lastReset) {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                testsTakenThisWeek: 0,
                lastTestResetDate: serverTimestamp()
            });
            if (currentUserData) {
                currentUserData.testsTakenThisWeek = 0;
                currentUserData.lastTestResetDate = now;
            }
            return;
        }

        // Calculate full days passed
        const daysDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
        if (daysDiff >= 7) {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                testsTakenThisWeek: 0,
                lastTestResetDate: serverTimestamp()
            });
            if (currentUserData) {
                currentUserData.testsTakenThisWeek = 0;
                currentUserData.lastTestResetDate = now;
            }
            showWeeklyResetNotification();
        }
    } catch (error) {
        console.error("Error resetting test count:", error);
    } finally {
        isResetting = false;
    }
}

async function checkPlanExpiration(userId, userData) {
    if (userData.plan !== 'paid') return false;
    try {
        const subscriptionDate = convertTimestamp(userData.subscriptionDate);
        if (!subscriptionDate) {
            // No subscription date, treat as free? Possibly set it now.
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, { subscriptionDate: serverTimestamp() });
            return false;
        }

        const now = new Date();
        const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
        if (daysSinceSubscription >= PREMIUM_PLAN_DURATION_DAYS) {
            const userRef = doc(db, "users", userId);
            await updateDoc(userRef, {
                plan: 'free',
                planExpiredAt: serverTimestamp(),
                previousPlan: 'paid',
                subscriptionDate: null,
                testsTakenThisWeek: 0,
                lastTestResetDate: serverTimestamp()
            });

            // Refresh local user data after expiration
            if (currentUserData) {
                currentUserData.plan = 'free';
                currentUserData.subscriptionDate = null;
                currentUserData.planExpiredAt = now;
                currentUserData.previousPlan = 'paid';
                currentUserData.testsTakenThisWeek = 0;
                currentUserData.lastTestResetDate = now;
            }

            showExpirationNotice();
            return true;
        }
        return false;
    } catch (error) {
        console.error("Error checking plan expiration:", error);
        return false;
    }
}

function showExpirationNotice() {
    if (document.getElementById('expirationNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'expirationNotice';
    notice.style.cssText = `
        background: linear-gradient(135deg, #ff6b6b, #ff8e53);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin-bottom: 1.5rem;
        text-align: center;
    `;
    notice.innerHTML = `
        <h3 style="margin: 0 0 0.5rem 0; font-size: 1.1rem;">
            <i class="fas fa-clock"></i> Premium Plan Expired
        </h3>
        <p style="margin: 0; font-size: 0.9rem;">
            Your 30-day Premium subscription has ended. You've been reverted to the Free Plan.
            <br>
            <strong>Upgrade again to continue enjoying unlimited tests!</strong>
        </p>
    `;
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.insertBefore(notice, dashboardContainer.firstChild);
    }
    setTimeout(() => {
        if (notice.parentNode) notice.remove();
    }, 10000);
}

function showWeeklyResetNotification() {
    if (document.getElementById('weeklyResetNotice')) return;
    const notice = document.createElement('div');
    notice.id = 'weeklyResetNotice';
    notice.style.cssText = `
        background: linear-gradient(135deg, #4CAF50, #2E7D32);
        color: white;
        padding: 0.8rem;
        border-radius: 8px;
        margin-bottom: 1rem;
        text-align: center;
        font-size: 0.9rem;
    `;
    notice.innerHTML = `
        <i class="fas fa-sync-alt"></i> 
        <strong>Weekly Reset Complete!</strong> 
        Your test limit has been refreshed. You now have ${FREE_PLAN_WEEKLY_LIMIT} tests available this week.
    `;
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) {
        dashboardContainer.insertBefore(notice, dashboardContainer.firstChild);
    }
    setTimeout(() => {
        if (notice.parentNode) notice.remove();
    }, 5000);
}

async function upgradeToPremium() {
    try {
        const user = auth.currentUser;
        if (!user) {
            alert('You must be logged in to upgrade.');
            return;
        }
        if (upgradeBtn) {
            upgradeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            upgradeBtn.disabled = true;
        }
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            plan: 'paid',
            subscriptionDate: serverTimestamp(),
            planExpiredAt: null,
            previousPlan: 'free',
            lastUpgraded: serverTimestamp()
        });

        // Re-fetch the updated document to get accurate server timestamps
        const updatedSnap = await getDoc(userRef);
        if (updatedSnap.exists()) {
            currentUserData = updatedSnap.data();
        }

        updateUIForPlan();
        showPremiumBanner();
        setupSubjectDropdown();
        setupJambDrillSubjects();
        populateWaecNecoSubjects();
        updateJambDrillVisibility();
        updateWaecNecoVisibility();

        alert(`🎉 Congratulations! You are now a Premium member!\n\n✅ Unlimited tests for all subjects\n✅ Detailed solutions unlocked\n✅ JAMB Drill access\n✅ WAEC/NECO Drill access\n✅ Premium status for 30 days`);
        if (upgradeBtn) {
            upgradeBtn.innerHTML = '<i class="fas fa-rocket"></i> UPGRADE NOW';
            upgradeBtn.disabled = false;
        }
    } catch (error) {
        console.error("Error upgrading to premium:", error);
        alert('Error upgrading to premium. Please try again.');
        if (upgradeBtn) {
            upgradeBtn.innerHTML = '<i class="fas fa-rocket"></i> UPGRADE NOW';
            upgradeBtn.disabled = false;
        }
    }
}

// ========== USER DATA LOADING ==========
async function loadUserData(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            currentUserData = userSnap.data();
            await checkPlanExpiration(userId, currentUserData);
            if (currentUserData.plan !== userSnap.data().plan) {
                const updatedSnap = await getDoc(userRef);
                if (updatedSnap.exists()) {
                    currentUserData = updatedSnap.data();
                }
            }
            await checkAndResetTestCount(userId, currentUserData);
            const finalSnap = await getDoc(userRef);
            if (finalSnap.exists()) {
                currentUserData = finalSnap.data();
            }
            loadUserProfile(currentUserData);
            setupRealTimeStats(userId);
            updateUIForPlan();
            showPremiumBanner();
            setupSubjectDropdown();
            setupJambDrillSubjects();
            populateWaecNecoSubjects();
            updateJambDrillVisibility();
            updateWaecNecoVisibility();
            // Load recent tests
            loadRecentTests(userId);
            setTimeout(() => {
                loadAnalytics(userId);
                loadLeaderboard();
            }, 1000);

            // Start background expiration monitor (every hour)
            startExpirationMonitor(userId);
        } else {
            await createDefaultUserProfile(userId);
            loadUserData(userId);
        }
    } catch (error) {
        console.error('Error loading user data:', error);
    }
}

function startExpirationMonitor(userId) {
    if (expirationInterval) clearInterval(expirationInterval);
    expirationInterval = setInterval(async () => {
        if (!auth.currentUser || !currentUserData) return;
        await checkPlanExpiration(userId, currentUserData);
    }, 60 * 60 * 1000); // 1 hour
}

async function createDefaultUserProfile(userId) {
    try {
        const userRef = doc(db, "users", userId);
        const user = auth.currentUser;
        await setDoc(userRef, {
            fullName: user.displayName || user.email.split('@')[0],
            email: user.email,
            plan: 'free',
            testsTakenThisWeek: 0,
            lastTestResetDate: serverTimestamp(),
            totalTestsTaken: 0,
            profilePicture: '',
            joinedAt: serverTimestamp(),
            status: 'active',
            subscriptionDate: null,
            planExpiredAt: null,
            previousPlan: null,
            lastUpgraded: null,
            tutorialCenterId: null
        }, { merge: true });
        console.log("Default user profile created");
    } catch (error) {
        console.error("Error creating default profile:", error);
    }
}

// ========== DASHBOARD STATS ==========
function setupRealTimeStats(userId) {
    if (unsubscribeStats) {
        unsubscribeStats();
    }
    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc")
    );
    unsubscribeStats = onSnapshot(q, (snapshot) => {
        console.log("Loading dashboard stats from Firestore:", snapshot.size, "tests found");
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
    snapshot.forEach((doc) => {
        const testData = doc.data();
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

// ========== RECENT TESTS (Enhanced) ==========
let unsubscribeRecentTests = null;

function loadRecentTests(userId) {
    if (unsubscribeRecentTests) {
        unsubscribeRecentTests();
    }

    const recentTestsList = document.getElementById('recentTestsList');
    if (!recentTestsList) return;

    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc"),
        limit(10)
    );

    unsubscribeRecentTests = onSnapshot(q, (snapshot) => {
        if (snapshot.empty) {
            recentTestsList.innerHTML = '<p class="no-tests">No tests yet. Start practicing!</p>';
            return;
        }

        const results = [];
        snapshot.forEach((doc) => {
            const test = doc.data();
            const mode = test.mode;
            const completedAt = test.completedAt ? convertTimestamp(test.completedAt) : null;
            const dateStr = completedAt ? completedAt.toLocaleDateString() : 'Unknown date';

            let typeIcon = '';
            let typeLabel = '';
            let mainContent = '';

            switch (mode) {
                case 'quick':
                    typeIcon = '<i class="fas fa-bolt"></i>';
                    typeLabel = 'Quick Test';
                    mainContent = renderQuickTest(test, dateStr);
                    break;
                case 'waec_neco':
                    typeIcon = '<i class="fas fa-school"></i>';
                    typeLabel = 'WAEC/NECO';
                    mainContent = renderWaecNecoTest(test, dateStr);
                    break;
                case 'jamb_drill':
                    typeIcon = '<i class="fas fa-graduation-cap"></i>';
                    typeLabel = 'JAMB Drill';
                    mainContent = renderJambDrillTest(test, dateStr);
                    break;
                default:
                    typeIcon = '<i class="fas fa-pencil-alt"></i>';
                    typeLabel = 'Test';
                    mainContent = renderUnknownTest(test, dateStr);
            }

            results.push(`
                <div class="recent-test-item">
                    <div class="test-header">
                        <div class="test-type-badge" title="${typeLabel}">${typeIcon}</div>
                        <div class="test-date">${escapeHtml(dateStr)}</div>
                    </div>
                    ${mainContent}
                </div>
            `);
        });

        recentTestsList.innerHTML = results.join('');
    }, (error) => {
        console.error("Error loading recent tests:", error);
        if (recentTestsList) {
            recentTestsList.innerHTML = '<p class="error">Error loading recent tests. Please refresh.</p>';
        }
    });
}

function renderQuickTest(test, dateStr) {
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

function renderWaecNecoTest(test, dateStr) {
    const subject = test.subjectName || test.subject || 'Unknown';
    const subjectScores = test.subjectScores || {};
    const totalRaw = test.rawScore !== undefined ? test.rawScore : 0;
    const totalQuestions = test.totalQuestions || 0;

    let subjectRow = '';

    // If per-subject scores exist, display them
    if (Object.keys(subjectScores).length > 0) {
        // For WAEC/NECO, there's only one subject, but we still iterate to be safe
        for (const [subjValue, scoreObj] of Object.entries(subjectScores)) {
            const subjName = subjValue.charAt(0).toUpperCase() + subjValue.slice(1);
            const raw = scoreObj.correct !== undefined ? scoreObj.correct : (scoreObj.raw || 0);
            const total = scoreObj.total || totalQuestions;
            subjectRow += `<div class="subject-score-row"><span class="subject-name">${escapeHtml(subjName)}:</span> <span class="score-value">${raw}/${total}</span></div>`;
        }
    } else {
        // Fallback to showing only total score
        subjectRow = `<div class="subject-score-row"><span class="subject-name">Total:</span> <span class="score-value">${totalRaw}/${totalQuestions}</span></div>`;
    }

    return `
        <div class="test-main">
            <div class="test-subject">${escapeHtml(subject)}</div>
            <div class="subject-scores">
                ${subjectRow}
            </div>
            <div class="test-total-score">Total: <strong>${totalRaw}/${totalQuestions}</strong></div>
        </div>
    `;
}

function renderJambDrillTest(test, dateStr) {
    const subjectScores = test.subjectScores || {};
    const subjectsList = test.subjects || []; // array of { value, name, count }
    const totalRaw = test.rawScore !== undefined ? test.rawScore : 0;
    const totalQuestions = test.totalQuestions || 0;

    let subjectRows = '';

    // Build rows for each subject in the test's subjects list
    if (subjectsList.length > 0) {
        for (const subj of subjectsList) {
            const subjValue = subj.value;
            const subjName = subj.name;
            const totalQ = subj.count || 0;
            const scoreObj = subjectScores[subjValue] || { correct: 0, total: totalQ };
            const raw = scoreObj.correct !== undefined ? scoreObj.correct : (scoreObj.raw || 0);
            const total = scoreObj.total || totalQ;
            subjectRows += `<div class="subject-score-row"><span class="subject-name">${escapeHtml(subjName)}:</span> <span class="score-value">${raw}/${total}</span></div>`;
        }
    } else if (Object.keys(subjectScores).length > 0) {
        // Fallback: iterate over subjectScores if subjectsList missing
        for (const [subjValue, scoreObj] of Object.entries(subjectScores)) {
            const subjName = subjValue.charAt(0).toUpperCase() + subjValue.slice(1);
            const raw = scoreObj.correct !== undefined ? scoreObj.correct : (scoreObj.raw || 0);
            const total = scoreObj.total || 0;
            subjectRows += `<div class="subject-score-row"><span class="subject-name">${escapeHtml(subjName)}:</span> <span class="score-value">${raw}/${total}</span></div>`;
        }
    } else {
        // No subject data, show only total
        subjectRows = `<div class="subject-score-row"><span class="subject-name">Total:</span> <span class="score-value">${totalRaw}/${totalQuestions}</span></div>`;
    }

    // Compute total possible (sum of counts from subjectsList)
    let totalPossible = 180; // default
    if (subjectsList.length) {
        totalPossible = subjectsList.reduce((sum, s) => sum + (s.count || 0), 0);
    }
    const totalScoreText = totalRaw && totalPossible ? `${totalRaw}/${totalPossible}` : 'N/A';

    return `
        <div class="test-main jamb-detail">
            <div class="test-subject">JAMB Drill</div>
            <div class="subject-scores">
                ${subjectRows}
            </div>
            <div class="test-total-score">Total: <strong>${totalScoreText}</strong></div>
        </div>
    `;
}

function renderUnknownTest(test, dateStr) {
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

// Helper to prevent XSS
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// ========== ANALYTICS FUNCTIONS ==========
async function fetchUserTestResults(userId) {
    const q = query(
        collection(db, "test_results"),
        where("userId", "==", userId),
        orderBy("completedAt", "desc")
    );
    const snapshot = await getDocs(q);
    const results = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        let scorePercent = data.score;
        if (data.mode === 'jamb_drill' && data.totalQuestions) {
            scorePercent = (data.rawScore / data.totalQuestions) * 100;
        }
        results.push({
            ...data,
            id: doc.id,
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
        const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
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
        const avg = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0;
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
        snapshot.forEach(doc => {
            const data = doc.data();
            const totalAnswered = data.totalAnswered || 0;
            if (totalAnswered < 5) return;
            const totalCorrect = data.totalCorrect || 0;
            const currentAccuracy = totalAnswered > 0 ? (totalCorrect / totalAnswered) * 100 : 0;
            const lastAccuracy = data.lastAccuracy !== undefined ? data.lastAccuracy : null;
            if (lastAccuracy !== null) {
                const improvement = currentAccuracy - lastAccuracy;
                if (improvement > 0 && (!best || improvement > best.improvement)) {
                    best = {
                        topic: data.topic || 'Unknown',
                        improvement: Math.round(improvement)
                    };
                }
            }
        });
        return best;
    } catch (error) {
        console.error("Error fetching topic stats:", error);
        return null;
    }
}

// ========== RENDER ANALYTICS ==========
function renderWeeklyChart(data) {
    const ctx = document.getElementById('weeklyTrendChart')?.getContext('2d');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(d => d.date.slice(5)),
            datasets: [{
                label: 'Avg Score %',
                data: data.map(d => d.averageScore),
                borderColor: '#6A11CB',
                backgroundColor: 'rgba(106,17,203,0.1)',
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

function renderMonthlyChart(data) {
    const ctx = document.getElementById('monthlyChart')?.getContext('2d');
    if (!ctx) return;
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.month),
            datasets: [{
                label: 'Avg Score %',
                data: data.map(d => d.averageScore),
                backgroundColor: '#9C27B0'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 100 } }
        }
    });
}

async function loadAnalytics(userId) {
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

// ========== LEADERBOARD FUNCTIONS ==========
async function getAllUsers() {
    const snapshot = await getDocs(collection(db, "users"));
    const users = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        users.push({
            id: doc.id,
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
        snapshot.forEach(doc => {
            const data = doc.data();
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) {
                score = (data.rawScore / data.totalQuestions) * 100;
            }
            totalScore += score;
            count++;
        });
        if (count > 0) {
            const avg = Math.round(totalScore / count);
            leaderboard.push({ name: user.fullName, averageScore: avg });
        }
    }
    leaderboard.sort((a,b) => b.averageScore - a.averageScore);
    return leaderboard.slice(0, 10);
}

async function getTopPerSubject() {
    const users = await getAllUsers();
    const subjectMap = {};
    for (let user of users) {
        const q = query(collection(db, "test_results"), where("userId", "==", user.id));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            const data = doc.data();
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
        const list = subjectMap[subject];
        list.sort((a,b) => b.score - a.score);
        topPerSubject[subject] = list.slice(0, 1);
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
        thisWeekSnap.forEach(doc => {
            const data = doc.data();
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) {
                score = (data.rawScore / data.totalQuestions) * 100;
            }
            thisWeekTotal += score;
            thisWeekCount++;
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
        lastWeekSnap.forEach(doc => {
            const data = doc.data();
            let score = data.score;
            if (data.mode === 'jamb_drill' && data.totalQuestions) {
                score = (data.rawScore / data.totalQuestions) * 100;
            }
            lastWeekTotal += score;
            lastWeekCount++;
        });
        const lastWeekAvg = lastWeekCount > 0 ? lastWeekTotal / lastWeekCount : 0;

        if (thisWeekCount > 0 && lastWeekCount > 0) {
            const improvement = Math.round(thisWeekAvg - lastWeekAvg);
            if (improvement > 0) {
                improvements.push({ name: user.fullName, improvement });
            }
        }
    }
    improvements.sort((a,b) => b.improvement - a.improvement);
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
        snapshot.forEach(doc => {
            const data = doc.data();
            const score = data.score || 0;
            if (!highest || score > highest.score) {
                highest = { name: user.fullName, score };
            }
        });
    }
    return highest;
}

async function loadLeaderboard() {
    try {
        const top10 = await getLeaderboardTop10();
        const top10Container = getElement('leaderboardTop10');
        if (top10Container) {
            if (top10.length) {
                top10Container.innerHTML = top10.map((item, i) => `
                    <div class="leaderboard-item">
                        <span class="rank">${i+1}</span>
                        <span class="name">${item.name}</span>
                        <span class="score">${item.averageScore}%</span>
                    </div>
                `).join('');
            } else {
                top10Container.innerHTML = '<p class="placeholder">No data this week</p>';
            }
        }

        const topPerSubj = await getTopPerSubject();
        const subjectTabs = getElement('subjectTabsLeaderboard');
        const topList = getElement('topPerSubjectList');
        const subjects = Object.keys(topPerSubj);
        if (subjectTabs && topList) {
            if (subjects.length) {
                subjectTabs.innerHTML = subjects.map(s => `<button class="subject-tab" data-subject="${s}">${s}</button>`).join('');
                function showTopForSubject(subject, data) {
                    const list = data[subject] || [];
                    topList.innerHTML = list.map(item => `
                        <div class="leaderboard-item">
                            <span class="name">${item.name}</span>
                            <span class="score">${item.score}%</span>
                        </div>
                    `).join('');
                }
                showTopForSubject(subjects[0], topPerSubj);
                document.querySelectorAll('#subjectTabsLeaderboard .subject-tab').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const subj = btn.dataset.subject;
                        showTopForSubject(subj, topPerSubj);
                    });
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

// ========== UI UPDATE BASED ON PLAN ==========
function updateUIForPlan() {
    if (!currentUserData) return;
    const isFreePlan = currentUserData.plan === 'free';
    const isPaidPlan = currentUserData.plan === 'paid';
    const isUnlimitedPlan = currentUserData.plan === 'unlimited';
    const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
    const remainingTests = Math.max(0, FREE_PLAN_WEEKLY_LIMIT - testsTakenThisWeek);

    let daysRemaining = 0;
    if (isPaidPlan && currentUserData.subscriptionDate) {
        const subscriptionDate = convertTimestamp(currentUserData.subscriptionDate);
        if (subscriptionDate) {
            const now = new Date();
            const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
            daysRemaining = Math.max(0, PREMIUM_PLAN_DURATION_DAYS - daysSinceSubscription);
        }
    }

    let daysUntilReset = 7;
    if (isFreePlan && currentUserData.lastTestResetDate) {
        const lastReset = convertTimestamp(currentUserData.lastTestResetDate);
        if (lastReset) {
            const now = new Date();
            const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
            daysUntilReset = 7 - daysSinceReset;
        }
    }

    if (userPlan) {
        if (isFreePlan) userPlan.textContent = 'Free';
        else if (isPaidPlan) userPlan.textContent = 'Premium';
        else if (isUnlimitedPlan) userPlan.textContent = 'Unlimited';
    }
    if (planStatus) {
        if (isFreePlan) {
            if (daysUntilReset > 0 && daysUntilReset < 7) {
                planStatus.textContent = `${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''} until reset`;
            } else {
                planStatus.textContent = 'Basic Access';
            }
        } else if (isPaidPlan) {
            planStatus.textContent = daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expiring soon';
        } else if (isUnlimitedPlan) {
            planStatus.textContent = 'Lifetime Access';
        }
    }
    if (planStatusCard && planIcon) {
        if (isFreePlan) {
            planStatusCard.style.borderLeftColor = '#95a5a6';
            planIcon.className = 'fas fa-user';
            planIcon.style.color = '#95a5a6';
        } else if (isPaidPlan) {
            planStatusCard.style.borderLeftColor = '#9C27B0';
            planIcon.className = 'fas fa-crown';
            planIcon.style.color = '#FFD700';
        } else if (isUnlimitedPlan) {
            planStatusCard.style.borderLeftColor = '#00bcd4';
            planIcon.className = 'fas fa-infinity';
            planIcon.style.color = '#00bcd4';
        }
    }
    if (userPlanStatus) {
        if (isFreePlan) {
            userPlanStatus.innerHTML = `Free Plan • <strong>${remainingTests} tests remaining this week</strong>`;
            if (remainingTests === 0) {
                userPlanStatus.innerHTML = `Free Plan • <strong>Limit reached - resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}</strong>`;
            }
        } else if (isPaidPlan) {
            userPlanStatus.innerHTML = `🎉 Premium Member • <strong>${daysRemaining} days remaining</strong>`;
        } else if (isUnlimitedPlan) {
            userPlanStatus.innerHTML = `♾️ Unlimited Plan • <strong>Lifetime Access</strong>`;
        }
    }
    if (testLimitInfo) {
        testLimitInfo.style.display = isFreePlan ? 'block' : 'none';
        if (testsRemaining && isFreePlan) testsRemaining.textContent = remainingTests;
    }
}

function setupSubjectDropdown() {
    if (!subjectSelect) return;
    subjectSelect.innerHTML = '<option value="" disabled selected>Choose subject</option>';
    const isFreePlan = currentUserData?.plan === 'free';
    const subjectsToShow = isFreePlan ? FREE_PLAN_SUBJECTS : ALL_SUBJECTS.map(s => s.value);
    ALL_SUBJECTS.forEach(subject => {
        if (subjectsToShow.includes(subject.value)) {
            const option = document.createElement('option');
            option.value = subject.value;
            option.textContent = subject.name;
            subjectSelect.appendChild(option);
        }
    });
    if (planRestrictions) planRestrictions.style.display = isFreePlan ? 'block' : 'none';
}

function showPremiumBanner() {
    if (!premiumBanner || !currentUserData) return;
    premiumBanner.style.display = currentUserData.plan === 'free' ? 'flex' : 'none';
}

// ========== JAMB DRILL ==========
function setupJambDrillSubjects() {
    if (!additionalSubjectsDiv) return;
    const isPremium = currentUserData?.plan !== 'free';
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
        if (!isPremium && subject.value !== 'mathematics') {
            checkbox.disabled = true;
            wrapper.style.opacity = '0.5';
        }
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
    if (checkboxes.length === 3) {
        hint.innerHTML = '✅ 3 subjects selected. Ready to start.';
        hint.style.color = '#28a745';
    } else {
        hint.innerHTML = `Select exactly 3 subjects (currently ${checkboxes.length} selected)`;
        hint.style.color = '#dc3545';
    }
}

function updateJambDrillVisibility() {
    if (!jambDrillSection || !jambDrillPremiumNotice) return;
    const isPremium = currentUserData?.plan !== 'free';
    if (isPremium) {
        jambDrillPremiumNotice.style.display = 'none';
        jambDrillSection.style.display = 'block';
        if (startJambDrillBtn) startJambDrillBtn.disabled = false;
    } else {
        jambDrillPremiumNotice.style.display = 'block';
        jambDrillSection.style.display = 'block';
        if (startJambDrillBtn) startJambDrillBtn.disabled = true;
    }
}

// ========== WAEC/NECO DRILL (Premium only) ==========
function updateWaecNecoVisibility() {
    if (!waecNecoDrillSection || !waecNecoPremiumNotice) return;
    const isPremium = currentUserData?.plan !== 'free';
    if (isPremium) {
        waecNecoPremiumNotice.style.display = 'none';
        waecNecoDrillSection.style.display = 'block';
        if (startWaecNecoDrillBtn) startWaecNecoDrillBtn.disabled = false;
    } else {
        waecNecoPremiumNotice.style.display = 'block';
        waecNecoDrillSection.style.display = 'block';
        if (startWaecNecoDrillBtn) startWaecNecoDrillBtn.disabled = true;
    }
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

// ========== TEST LIMIT VALIDATION ==========
async function validateQuickTestStart() {
    if (!currentUserData) return { valid: false, message: "User data not loaded" };
    if (currentUserData.plan !== 'free') return { valid: true, message: "" };
    const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
    if (testsTakenThisWeek >= FREE_PLAN_WEEKLY_LIMIT) {
        let daysUntilReset = 7;
        const lastReset = convertTimestamp(currentUserData.lastTestResetDate);
        if (lastReset) {
            const now = new Date();
            const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
            daysUntilReset = 7 - daysSinceReset;
        }
        return {
            valid: false,
            message: `❌ You have used all ${FREE_PLAN_WEEKLY_LIMIT} tests for this week.\n\n⏰ Next reset in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}.\n\n⭐ Upgrade to Premium for unlimited tests!`
        };
    }
    return { valid: true, message: "" };
}

// ========== START QUICK TEST ==========
async function startQuickTest() {
    const selectedExam = classSelect.value;
    const selectedSubject = subjectSelect.value;
    if (!selectedExam || !selectedSubject) {
        alert('❌ Please select exam and subject');
        return;
    }
    const validation = await validateQuickTestStart();
    if (!validation.valid) {
        alert(validation.message);
        return;
    }
    if (currentUserData?.plan === 'free' && !FREE_PLAN_SUBJECTS.includes(selectedSubject)) {
        alert('❌ Free Plan users can only take Mathematics and English.\n\n⭐ Upgrade to Premium for all subjects!');
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
            userAnswers: Array(selectedQuestions.length).fill(null),
            plan: currentUserData.plan || 'free'
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
    if (currentUserData?.plan === 'free') {
        alert('❌ JAMB Drill is a Premium feature. Please upgrade to access.');
        return;
    }
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
                ...q,
                subject: subj.value,
                subjectName: subj.name
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
            userAnswers: Array(finalQuestions.length).fill(null),
            plan: currentUserData.plan || 'paid'
        };
        sessionStorage.setItem('currentTest', JSON.stringify(testData));
        window.location.href = 'test.html';
    } catch (error) {
        console.error('Error starting JAMB Drill:', error);
        showLoadingState(false, startJambDrillBtn);
        alert(`❌ Error starting JAMB Drill: ${error.message || 'Please try again.'}`);
    }
}

// ========== START WAEC/NECO DRILL (Premium only) ==========
async function startWaecNecoDrill() {
    if (currentUserData?.plan === 'free') {
        alert('❌ WAEC/NECO Drill is a Premium feature. Please upgrade to access.');
        return;
    }

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
            alert(`Only ${allQuestions.length} WAEC/NECO questions available for "${selectedSubject}". Please add more.`);
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
            userAnswers: Array(selectedQuestions.length).fill(null),
            plan: currentUserData.plan || 'paid'
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
        querySnapshot.forEach((doc) => {
            const questionData = doc.data();
            const hasContent = (
                (questionData.questionText && questionData.questionText.trim() !== '') ||
                questionData.questionImage
            );
            const hasCorrectAnswer = questionData.correctAnswer && 
                ['A', 'B', 'C', 'D'].includes(questionData.correctAnswer);
            if (hasContent && hasCorrectAnswer) {
                questions.push({
                    id: doc.id,
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

// ========== PROFILE PICTURE HANDLING ==========
function convertImageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function compressToTargetSize(file, targetSizeKB = 200) {
    const targetBase64Length = targetSizeKB * 1024 * 1.33;
    let maxWidth = 800, maxHeight = 800, quality = 0.8;
    let compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, quality);
    if (compressedBase64.length <= targetBase64Length) return compressedBase64;
    const qualitySteps = [0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
    for (let q of qualitySteps) {
        compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, q);
        if (compressedBase64.length <= targetBase64Length) return compressedBase64;
    }
    const dimensionSteps = [600, 500, 400, 300];
    for (let dim of dimensionSteps) {
        maxWidth = dim; maxHeight = dim;
        compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, 0.6);
        if (compressedBase64.length <= targetBase64Length) return compressedBase64;
        compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, 0.4);
        if (compressedBase64.length <= targetBase64Length) return compressedBase64;
    }
    return await compressImageWithParams(file, 300, 300, 0.3);
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
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                resolve(compressedBase64);
            };
            img.onerror = reject;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleProfileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    const user = auth.currentUser;
    if (!user) {
        alert('You must be logged in to upload a profile picture');
        return;
    }
    try {
        profileImg.src = '';
        profileImg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>';
        let base64;
        const ONE_MB = 1048576;
        if (file.size >= ONE_MB) {
            console.log(`File size: ${(file.size / 1024).toFixed(2)}KB, compressing to ≤200KB...`);
            base64 = await compressToTargetSize(file, 200);
            console.log(`Compressed size: ${Math.round(base64.length / 1024)}KB (base64)`);
        } else {
            base64 = await convertImageToBase64(file);
            console.log(`Original size (base64): ${Math.round(base64.length / 1024)}KB`);
        }
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            profilePicture: base64,
            profileUpdatedAt: serverTimestamp()
        });
        console.log("✅ Profile picture saved to Firestore");
        if (currentUserData) currentUserData.profilePicture = base64;
        profileImg.src = base64;
        profileImg.innerHTML = '';
        profileImg.alt = "Profile Picture";
        alert('✅ Profile picture updated successfully!');
    } catch (error) {
        console.error('Error uploading profile picture:', error);
        let userMessage = '❌ Failed to upload profile picture. ';
        if (error.code === 'permission-denied') {
            userMessage += 'Permission denied – your Firestore security rules are blocking this update.\n';
            userMessage += 'Please ask the administrator to add the following rule:\n\n';
            userMessage += 'allow update: if request.auth.uid == resource.id;\n';
            userMessage += '(This allows users to update their own document.)';
        } else if (error.code === 'not-found') {
            userMessage += 'Your user profile document is missing. Try refreshing the page.';
        } else if (error.code === 'resource-exhausted') {
            userMessage += 'The image is too large. We already compress it, but please try a smaller image.';
        } else {
            userMessage += error.message || 'Please try again.';
        }
        alert(userMessage);
        setDefaultProfileImage();
    } finally {
        event.target.value = '';
    }
}

async function loadUserProfile(userData) {
    if (userName) {
        const displayName = userData.fullName || userData.email || 'Student';
        userName.textContent = displayName;
        showWelcomeBanner(displayName);
    }
    if (profileImg) {
        if (userData.profilePicture) {
            console.log("Loading profile picture from Firestore");
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
    profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff&size=120`;
    profileImg.alt = "Default Profile";
    profileImg.innerHTML = '';
}

// ========== INITIALIZE DASHBOARD ==========
function initDashboard() {
    console.log("Dashboard initializing...");
    onAuthStateChanged(auth, (user) => {
        if (!user) {
            if (expirationInterval) clearInterval(expirationInterval);
            window.location.href = 'index.html';
        } else {
            loadUserData(user.uid);
        }
    });

    // Event listeners (only for buttons, NOT for upgrade links inside notices)
    if (startQuickTestBtn) startQuickTestBtn.addEventListener('click', startQuickTest);
    if (startJambDrillBtn) startJambDrillBtn.addEventListener('click', startJambDrill);
    if (startWaecNecoDrillBtn) startWaecNecoDrillBtn.addEventListener('click', startWaecNecoDrill);
    if (logoutBtn) logoutBtn.addEventListener('click', async () => {
        try {
            if (unsubscribeStats) unsubscribeStats();
            if (expirationInterval) clearInterval(expirationInterval);
            if (unsubscribeRecentTests) unsubscribeRecentTests();
            await signOut(auth);
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            alert('Error logging out. Please try again.');
        }
    });
    if (profileUpload) profileUpload.addEventListener('change', handleProfileUpload);
    if (upgradeBtn) upgradeBtn.addEventListener('click', upgradeToPremium);

    populateWaecNecoSubjects(); // initial population
}

// Start everything
initDashboard();

