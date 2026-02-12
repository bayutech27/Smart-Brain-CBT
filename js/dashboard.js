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
    setDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import { 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startTestBtn = document.getElementById('startTestBtn');
    const classSelect = document.getElementById('classSelect');
    const subjectSelect = document.getElementById('subjectSelect');
    const logoutBtn = document.getElementById('logoutBtn');
    const userName = document.getElementById('userName');
    const practiceForm = document.getElementById('practiceForm');
    const profileUpload = document.getElementById('profileUpload');
    const profileImg = document.getElementById('profileImg');
    const premiumBanner = document.getElementById('premiumBanner');
    const upgradeBtn = document.getElementById('upgradeBtn');
    const planRestrictions = document.getElementById('planRestrictions');
    const testLimitInfo = document.getElementById('testLimitInfo');
    const testsRemaining = document.getElementById('testsRemaining');
    const userPlanStatus = document.getElementById('userPlanStatus');
    const userPlan = document.getElementById('userPlan');
    const planStatus = document.getElementById('planStatus');
    const planStatusCard = document.getElementById('planStatusCard');
    const planIcon = document.getElementById('planIcon');

    // Dashboard stats elements
    const completedTests = document.getElementById('completedTests');
    const averageScore = document.getElementById('averageScore');
    const performanceMessage = document.getElementById('performanceMessage');
    const testsList = document.getElementById('testsList');
    const viewAllResults = document.getElementById('viewAllResults');

    // Configuration
    const QUESTIONS_TO_FETCH = 20;
    const RECENT_TESTS_LIMIT = 6;
    const FREE_PLAN_WEEKLY_LIMIT = 3;
    const FREE_PLAN_SUBJECTS = ['mathematics', 'english'];
    const PREMIUM_PLAN_DURATION_DAYS = 30;
    
    // Exam type mapping
    const EXAM_TYPE_MAP = {
        'waec': 'WAEC/NECO',
        'jamb': 'JAMB'
    };

    // All available subjects
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
        { value: 'crk', name: 'Christian Religious Knowledge (CRK)' }
    ];

    // User data
    let currentUserData = null;
    let unsubscribeStats = null;

    // --- FIX 5: Welcome banner function (congratulations message) ---
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
            // Auto-remove after 8 seconds as fallback
            setTimeout(() => {
                if (banner.parentNode) banner.remove();
                sessionStorage.removeItem('showWelcome');
            }, 8000);
        }
    }

    // Initialize dashboard functionality
    function initDashboard() {
        console.log("Dashboard initializing...");
        
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = 'index.html';
            } else {
                loadUserData(user.uid);
            }
        });
        
        if (practiceForm) {
            practiceForm.addEventListener('submit', (e) => e.preventDefault());
        }
        
        if (startTestBtn) {
            startTestBtn.addEventListener('click', startPracticeTest);
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    if (unsubscribeStats) unsubscribeStats();
                    await signOut(auth);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Error logging out. Please try again.');
                }
            });
        }
        
        if (viewAllResults) {
            viewAllResults.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Complete results page coming soon!');
            });
        }
        
        if (profileUpload) {
            profileUpload.addEventListener('change', handleProfileUpload);
        }
        
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', upgradeToPremium);
        }
    }

    // =============================================
    // FREE PLAN - 7 DAY RESET COUNTDOWN
    // =============================================
    async function checkAndResetTestCount(userId, userData) {
        try {
            if (userData.plan !== 'free') return;
            
            let lastReset = userData.lastTestResetDate;
            
            if (lastReset && typeof lastReset.toDate === 'function') {
                lastReset = lastReset.toDate();
            } else if (lastReset && lastReset.seconds) {
                lastReset = new Date(lastReset.seconds * 1000);
            } else if (lastReset && typeof lastReset === 'string') {
                lastReset = new Date(lastReset);
            }
            
            const now = new Date();
            
            if (!lastReset) {
                console.log("Initializing weekly test count");
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
            
            const daysDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
            console.log(`Free user: ${daysDiff} days since last reset`);
            
            if (daysDiff >= 7) {
                console.log(`Resetting weekly test count after ${daysDiff} days`);
                
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
        }
    }

    // =============================================
    // PAID PLAN - 30 DAY COUNTDOWN
    // =============================================
    async function checkPlanExpiration(userId, userData) {
        try {
            if (userData.plan === 'free') return false;
            
            let subscriptionDate = userData.subscriptionDate;
            
            if (subscriptionDate && typeof subscriptionDate.toDate === 'function') {
                subscriptionDate = subscriptionDate.toDate();
            } else if (subscriptionDate && subscriptionDate.seconds) {
                subscriptionDate = new Date(subscriptionDate.seconds * 1000);
            } else if (subscriptionDate && typeof subscriptionDate === 'string') {
                subscriptionDate = new Date(subscriptionDate);
            }
            
            if (!subscriptionDate) {
                console.log("Setting subscription date for premium user");
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    subscriptionDate: serverTimestamp()
                });
                return false;
            }
            
            const now = new Date();
            const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
            const daysRemaining = PREMIUM_PLAN_DURATION_DAYS - daysSinceSubscription;
            
            console.log(`Premium user: ${daysSinceSubscription} days used, ${daysRemaining} days remaining`);
            
            if (daysSinceSubscription >= PREMIUM_PLAN_DURATION_DAYS) {
                console.log(`Premium plan expired after ${daysSinceSubscription} days, reverting to free`);
                
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    plan: 'free',
                    planExpiredAt: serverTimestamp(),
                    previousPlan: 'paid',
                    subscriptionDate: null,
                    testsTakenThisWeek: 0,
                    lastTestResetDate: serverTimestamp()
                });
                
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

    // =============================================
    // UPGRADE TO PREMIUM
    // =============================================
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
            
            if (currentUserData) {
                currentUserData.plan = 'paid';
                currentUserData.subscriptionDate = new Date();
                currentUserData.previousPlan = 'free';
                
                updateUIForPlan();
                showPremiumBanner();
                setupSubjectDropdown();
            }
            
            alert(`🎉 Congratulations! You are now a Premium member!\n\n✅ Unlimited tests for all subjects\n✅ Detailed solutions unlocked\n✅ Premium status for 30 days`);
            
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

    // =============================================
    // LOAD USER DATA
    // =============================================
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
                
            } else {
                await createDefaultUserProfile(userId);
                loadUserData(userId);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // =============================================
    // CREATE DEFAULT USER PROFILE
    // =============================================
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
                lastUpgraded: null
            }, { merge: true });
            
            console.log("Default user profile created");
        } catch (error) {
            console.error("Error creating default profile:", error);
        }
    }

    // =============================================
    // DASHBOARD STATS FROM FIRESTORE
    // =============================================
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
            updateRecentTests(snapshot);
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
            if (testData.score !== undefined && testData.score !== null) {
                totalTests++;
                totalScore += testData.score;
            }
        });
        
        if (completedTests) {
            completedTests.textContent = totalTests;
        }
        
        const average = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
        if (averageScore) {
            averageScore.textContent = average;
        }
        
        let message = "Keep practicing!";
        if (average >= 90) message = "Excellent!";
        else if (average >= 80) message = "Great job!";
        else if (average >= 70) message = "Good work!";
        else if (average >= 60) message = "Keep improving!";
        
        if (performanceMessage) {
            performanceMessage.textContent = message;
        }
    }

    function updateRecentTests(snapshot) {
        if (!testsList) return;
        
        if (snapshot.empty) {
            testsList.innerHTML = `
                <div class="test-item placeholder">
                    <div class="test-info">
                        <div class="test-icon">
                            <i class="fas fa-hourglass-half"></i>
                        </div>
                        <div class="test-details">
                            <h4>No tests yet</h4>
                            <p>Take your first practice test!</p>
                        </div>
                    </div>
                    <div class="test-score">0<span class="test-percentage">%</span></div>
                </div>
            `;
            return;
        }
        
        testsList.innerHTML = '';
        
        let count = 0;
        snapshot.forEach((doc) => {
            if (count < RECENT_TESTS_LIMIT) {
                const testData = doc.data();
                const testItem = createTestItem(testData);
                testsList.appendChild(testItem);
                count++;
            }
        });
    }

    function createTestItem(testData) {
        const testItem = document.createElement('div');
        testItem.className = 'test-item';
        
        let timeAgo = 'Recently';
        if (testData.completedAt) {
            const completedDate = testData.completedAt.toDate ? 
                testData.completedAt.toDate() : 
                new Date(testData.completedAt);
            timeAgo = formatTimeAgo(completedDate);
        }
        
        const subjectIcon = getSubjectIcon(testData.subject);
        const subjectName = testData.subjectName || 
            (testData.subject ? testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 'Test');
        
        testItem.innerHTML = `
            <div class="test-info">
                <div class="test-icon">
                    <i class="fas fa-${subjectIcon}"></i>
                </div>
                <div class="test-details">
                    <h4>${subjectName}</h4>
                    <p>${timeAgo}</p>
                </div>
            </div>
            <div class="test-score">${testData.score || 0}<span class="test-percentage">%</span></div>
        `;
        
        return testItem;
    }

    function formatTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMinutes < 1) return 'Just now';
        if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
        if (diffHours < 24) return `${diffHours} hours ago`;
        if (diffDays < 7) return `${diffDays} days ago`;
        return date.toLocaleDateString();
    }

    function getSubjectIcon(subject) {
        const iconMap = {
            'mathematics': 'calculator',
            'english': 'book',
            'physics': 'atom',
            'chemistry': 'flask',
            'biology': 'dna',
            'accounting': 'calculator',
            'literature': 'book-open',
            'government': 'landmark',
            'commerce': 'store',
            'economics': 'chart-line',
            'crk': 'church'
        };
        return iconMap[subject] || 'book';
    }

    // =============================================
    // UPDATE UI BASED ON PLAN
    // =============================================
    function updateUIForPlan() {
        if (!currentUserData) return;
        
        const isFreePlan = currentUserData.plan === 'free';
        const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
        const remainingTests = Math.max(0, FREE_PLAN_WEEKLY_LIMIT - testsTakenThisWeek);
        
        let daysRemaining = 0;
        if (!isFreePlan && currentUserData.subscriptionDate) {
            let subscriptionDate = currentUserData.subscriptionDate;
            
            if (subscriptionDate && typeof subscriptionDate.toDate === 'function') {
                subscriptionDate = subscriptionDate.toDate();
            } else if (subscriptionDate && subscriptionDate.seconds) {
                subscriptionDate = new Date(subscriptionDate.seconds * 1000);
            }
            
            if (subscriptionDate && subscriptionDate instanceof Date) {
                const now = new Date();
                const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
                daysRemaining = Math.max(0, PREMIUM_PLAN_DURATION_DAYS - daysSinceSubscription);
            }
        }
        
        let daysUntilReset = 7;
        if (isFreePlan && currentUserData.lastTestResetDate) {
            let lastReset = currentUserData.lastTestResetDate;
            if (lastReset && typeof lastReset.toDate === 'function') {
                lastReset = lastReset.toDate();
            } else if (lastReset && lastReset.seconds) {
                lastReset = new Date(lastReset.seconds * 1000);
            }
            
            if (lastReset) {
                const now = new Date();
                const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
                daysUntilReset = 7 - daysSinceReset;
            }
        }
        
        if (userPlan) userPlan.textContent = isFreePlan ? 'Free' : 'Premium';
        
        if (planStatus) {
            if (isFreePlan) {
                if (daysUntilReset > 0 && daysUntilReset < 7) {
                    planStatus.textContent = `${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''} until reset`;
                } else {
                    planStatus.textContent = 'Basic Access';
                }
            } else {
                planStatus.textContent = daysRemaining > 0 ? 
                    `${daysRemaining} days remaining` : 
                    'Expiring soon';
            }
        }
        
        if (planStatusCard) {
            if (isFreePlan) {
                planStatusCard.style.borderLeftColor = '#95a5a6';
                planIcon.className = 'fas fa-user';
                planIcon.style.color = '#95a5a6';
            } else {
                planStatusCard.style.borderLeftColor = '#9C27B0';
                planIcon.className = 'fas fa-crown';
                planIcon.style.color = '#FFD700';
            }
        }
        
        if (userPlanStatus) {
            if (isFreePlan) {
                userPlanStatus.innerHTML = `Free Plan • <strong>${remainingTests} tests remaining this week</strong>`;
                if (remainingTests === 0) {
                    userPlanStatus.innerHTML = `Free Plan • <strong>Limit reached - resets in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}</strong>`;
                }
            } else {
                userPlanStatus.innerHTML = `🎉 Premium Member • <strong>${daysRemaining} days remaining</strong>`;
            }
        }
        
        if (testLimitInfo) {
            if (isFreePlan) {
                testLimitInfo.style.display = 'block';
                if (testsRemaining) testsRemaining.textContent = remainingTests;
            } else {
                testLimitInfo.style.display = 'none';
            }
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
        
        if (planRestrictions) {
            planRestrictions.style.display = isFreePlan ? 'block' : 'none';
        }
    }

    function showPremiumBanner() {
        if (!premiumBanner || !currentUserData) return;
        premiumBanner.style.display = currentUserData.plan === 'free' ? 'flex' : 'none';
    }

    // =============================================
    // TEST LIMIT VALIDATION
    // =============================================
    async function validateTestStart() {
        if (!currentUserData) return { valid: false, message: "User data not loaded" };
        
        const isFreePlan = currentUserData.plan === 'free';
        
        if (isFreePlan) {
            const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
            
            if (testsTakenThisWeek >= FREE_PLAN_WEEKLY_LIMIT) {
                let daysUntilReset = 7;
                let lastReset = currentUserData.lastTestResetDate;
                
                if (lastReset) {
                    if (lastReset && typeof lastReset.toDate === 'function') {
                        lastReset = lastReset.toDate();
                    } else if (lastReset && lastReset.seconds) {
                        lastReset = new Date(lastReset.seconds * 1000);
                    }
                    
                    if (lastReset) {
                        const now = new Date();
                        const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
                        daysUntilReset = 7 - daysSinceReset;
                    }
                }
                
                return {
                    valid: false,
                    message: `❌ You have used all ${FREE_PLAN_WEEKLY_LIMIT} tests for this week.\n\n⏰ Next reset in ${daysUntilReset} day${daysUntilReset !== 1 ? 's' : ''}.\n\n⭐ Upgrade to Premium for unlimited tests!`
                };
            }
            
            const selectedSubject = subjectSelect.value;
            if (!FREE_PLAN_SUBJECTS.includes(selectedSubject)) {
                return {
                    valid: false,
                    message: `❌ Free Plan users can only take Mathematics and English.\n\n⭐ Upgrade to Premium for all subjects!`
                };
            }
        }
        
        return { valid: true, message: "" };
    }

    // =============================================
    // START PRACTICE TEST - COUNT INCREMENT REMOVED
    // Count now increments in test.js after successful save
    // =============================================
    async function startPracticeTest() {
        const selectedExam = classSelect.value;
        const selectedSubject = subjectSelect.value;
        
        if (!selectedExam || !selectedSubject) {
            alert('❌ Please select exam and subject');
            return;
        }
        
        const validation = await validateTestStart();
        if (!validation.valid) {
            alert(validation.message);
            return;
        }
        
        try {
            showLoadingState(true);
            
            const firestoreExamType = EXAM_TYPE_MAP[selectedExam] || selectedExam;
            const allQuestions = await fetchQuestions(firestoreExamType, selectedSubject);
            
            if (allQuestions.length < QUESTIONS_TO_FETCH) {
                showLoadingState(false);
                alert(`Only ${allQuestions.length} questions available for "${selectedSubject}".`);
                return;
            }
            
            const shuffledQuestions = shuffleArray([...allQuestions]);
            const selectedQuestions = shuffledQuestions.slice(0, QUESTIONS_TO_FETCH);
            
            const totalTime = selectedQuestions.reduce((total, q) => {
                return total + (parseInt(q.timeLimit) || 120);
            }, 0);
            
            // ⚠️ COUNT INCREMENT REMOVED FROM HERE
            // Test count will be incremented in test.js after successful Firestore save
            
            const testData = {
                testId: generateTestId(),
                examType: firestoreExamType,
                subject: selectedSubject,
                questions: selectedQuestions,
                totalQuestions: selectedQuestions.length,
                totalTime: totalTime,
                startTime: new Date().toISOString(),
                userId: auth.currentUser.uid,
                userAnswers: Array(selectedQuestions.length).fill(null),
                plan: currentUserData.plan || 'free'
            };
            
            sessionStorage.setItem('currentTest', JSON.stringify(testData));
            window.location.href = 'test.html';
            
        } catch (error) {
            console.error('Error starting test:', error);
            showLoadingState(false);
            alert(`❌ Error starting test: ${error.message || 'Please try again.'}`);
        }
    }

    // =============================================
    // FETCH QUESTIONS
    // =============================================
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

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================
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

    function showLoadingState(show) {
        if (!startTestBtn) return;
        
        if (show) {
            startTestBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading Questions...';
            startTestBtn.disabled = true;
        } else {
            startTestBtn.innerHTML = '<i class="fas fa-play-circle"></i> Start Practice Test';
            startTestBtn.disabled = false;
        }
    }

    // =============================================
    // 🖼️ PROFILE PICTURE HANDLING - IMPROVED
    // =============================================
    
    /**
     * Converts a File object to a Base64 data URL.
     */
    function convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    /**
     * Compresses an image to a target maximum size (in KB) by adjusting
     * dimensions and JPEG quality.
     * @param {File} file - Original image file.
     * @param {number} targetSizeKB - Desired maximum file size in kilobytes.
     * @returns {Promise<string>} - Base64 data URL of compressed image.
     */
    async function compressToTargetSize(file, targetSizeKB = 200) {
        // Convert target size to bytes, accounting for base64 overhead (+33%)
        const targetBase64Length = targetSizeKB * 1024 * 1.33;
        
        // Start with reasonable max dimensions
        let maxWidth = 800;
        let maxHeight = 800;
        let quality = 0.8;
        
        let compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, quality);
        
        // If already under target, return it
        if (compressedBase64.length <= targetBase64Length) {
            return compressedBase64;
        }
        
        // Reduce quality step by step
        const qualitySteps = [0.7, 0.6, 0.5, 0.4, 0.3, 0.2];
        for (let q of qualitySteps) {
            compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, q);
            if (compressedBase64.length <= targetBase64Length) {
                return compressedBase64;
            }
        }
        
        // If still too large, reduce dimensions
        const dimensionSteps = [600, 500, 400, 300];
        for (let dim of dimensionSteps) {
            maxWidth = dim;
            maxHeight = dim;
            compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, 0.6);
            if (compressedBase64.length <= targetBase64Length) {
                return compressedBase64;
            }
            // Try lower quality with smaller dimensions
            compressedBase64 = await compressImageWithParams(file, maxWidth, maxHeight, 0.4);
            if (compressedBase64.length <= targetBase64Length) {
                return compressedBase64;
            }
        }
        
        // Last resort: 300px, quality 0.3
        return await compressImageWithParams(file, 300, 300, 0.3);
    }

    /**
     * Internal helper: compresses image with given dimensions and quality.
     */
    function compressImageWithParams(file, maxWidth, maxHeight, quality) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                img.src = e.target.result;
                img.onload = () => {
                    let width = img.width;
                    let height = img.height;
                    
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

    /**
     * Handles profile picture upload: converts to Base64, compresses if file ≥ 1MB,
     * and saves to Firestore under `profilePicture` field.
     */
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
            // Show loading state
            profileImg.src = '';
            profileImg.innerHTML = '<i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>';
            
            let base64;
            const ONE_MB = 1048576; // bytes
            
            if (file.size >= ONE_MB) {
                console.log(`File size: ${(file.size / 1024).toFixed(2)}KB, compressing to ≤200KB...`);
                base64 = await compressToTargetSize(file, 200);
                console.log(`Compressed size: ${Math.round(base64.length / 1024)}KB (base64)`);
            } else {
                // File is under 1MB, just convert to base64 (no compression needed)
                base64 = await convertImageToBase64(file);
                console.log(`Original size (base64): ${Math.round(base64.length / 1024)}KB`);
            }
            
            // Save to Firestore
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                profilePicture: base64,
                profileUpdatedAt: serverTimestamp()
            });
            
            console.log("✅ Profile picture saved to Firestore");
            
            // Update local state
            if (currentUserData) {
                currentUserData.profilePicture = base64;
            }
            
            // Display the image
            profileImg.src = base64;
            profileImg.innerHTML = ''; // Clear loading indicator
            profileImg.alt = "Profile Picture";
            
            alert('✅ Profile picture updated successfully!');
            
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            console.error('Error code:', error.code); // ← helpful for debugging

            // --- FIX 6: Detailed error messages for profile picture permission ---
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

    /**
     * Loads user profile data into the UI, including the profile picture.
     */
    async function loadUserProfile(userData) {
        if (userName) {
            const displayName = userData.fullName || userData.email || 'Student';
            userName.textContent = displayName;
            // --- FIX 7: Show welcome banner after profile loads ---
            showWelcomeBanner(displayName);
        }
        
        if (profileImg) {
            if (userData.profilePicture) {
                console.log("Loading profile picture from Firestore");
                profileImg.src = userData.profilePicture;
                profileImg.alt = "Profile Picture";
                profileImg.innerHTML = '';
            } else {
                console.log("No profile picture found, using default");
                setDefaultProfileImage();
            }
        }
    }

    /**
     * Sets a default avatar using the UI Avatars service.
     */
    function setDefaultProfileImage() {
        if (!profileImg) return;
        
        const user = auth.currentUser;
        let name = 'User';
        
        if (user && user.displayName) {
            name = user.displayName.split(' ')[0];
        } else if (user && user.email) {
            name = user.email.split('@')[0];
        }
        
        profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=4285F4&color=fff&size=120`;
        profileImg.alt = "Default Profile";
        profileImg.innerHTML = '';
    }

    // --- FIX 8: Console hint for Firestore security rules ---
    console.log(`
📌 To fix profile picture permission, update Firestore rules:
  match /users/{userId} {
    allow read: if request.auth.uid == userId;
    allow write: if request.auth.uid == userId;
  }
    `);

    // Initialize dashboard
    initDashboard();
});