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
    limit,
    updateDoc,
    increment,
    serverTimestamp,
    onSnapshot // ADDED: For real-time updates
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

    // New DOM Elements for dynamic updates
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
    const PREMIUM_PLAN_DURATION_DAYS = 30; // 30-day premium subscription
    
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
    let unsubscribeStats = null; // For real-time listener cleanup

    // Initialize dashboard functionality
    function initDashboard() {
        console.log("Dashboard initializing...");
        
        // Check authentication
        onAuthStateChanged(auth, (user) => {
            if (!user) {
                console.log("No user found, redirecting to index.html");
                window.location.href = 'index.html';
            } else {
                console.log("User authenticated, UID:", user.uid);
                loadUserData(user.uid);
            }
        });
        
        // Prevent form submission
        if (practiceForm) {
            practiceForm.addEventListener('submit', (e) => {
                e.preventDefault();
            });
        }
        
        // Start test button
        if (startTestBtn) {
            startTestBtn.addEventListener('click', startPracticeTest);
            console.log("Start test button event listener attached");
        }
        
        // Logout button
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                try {
                    // Clean up real-time listener
                    if (unsubscribeStats) {
                        unsubscribeStats();
                    }
                    await signOut(auth);
                    window.location.href = 'index.html';
                } catch (error) {
                    console.error('Logout error:', error);
                    alert('Error logging out. Please try again.');
                }
            });
        }
        
        // View all results button
        if (viewAllResults) {
            viewAllResults.addEventListener('click', (e) => {
                e.preventDefault();
                alert('Complete results page coming soon!');
            });
        }
        
        // Profile picture upload
        if (profileUpload) {
            profileUpload.addEventListener('change', handleProfileUpload);
        }
        
        // Premium banner upgrade button
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', () => {
                upgradeToPremium();
            });
        }
        
        console.log("Dashboard initialization complete");
    }

    // =============================================
    // PLAN MANAGEMENT FUNCTIONS
    // =============================================

    // Check and handle premium plan expiration
    async function checkPlanExpiration(userId, userData) {
        try {
            const isFreePlan = userData.plan === 'free';
            if (isFreePlan) return false; // Only check for paid users
            
            // ====== FIXED SECTION ======
            // Check if user is 'paid' but missing subscriptionDate (for manual upgrades)
            let subscriptionDate = userData.subscriptionDate?.toDate();
            
            if (!subscriptionDate) {
                console.log("Premium user found without subscription date. Setting start date to NOW.");
                
                // FIX: Set subscription date to CURRENT DATE, not in the past!
                subscriptionDate = new Date(); // TODAY
                
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    subscriptionDate: subscriptionDate // Store as server timestamp
                });
                
                // Also update local data
                if (currentUserData) {
                    currentUserData.subscriptionDate = subscriptionDate;
                }
                
                console.log(`Subscription date set to: ${subscriptionDate.toLocaleDateString()}`);
                return false; // Plan just started, not expired
            }
            // ====== END FIX ======
            
            const now = new Date();
            const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
            
            console.log(`Premium user check: ${daysSinceSubscription} days since subscription (started: ${subscriptionDate.toLocaleDateString()})`);
            
            // If more than 30 days have passed, revert to free plan
            if (daysSinceSubscription >= PREMIUM_PLAN_DURATION_DAYS) {
                console.log(`Premium plan expired (${daysSinceSubscription} days), reverting to free`);
                
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    plan: 'free',
                    planExpiredAt: now,
                    previousPlan: 'paid',
                    subscriptionDate: null // Clear subscription date
                });
                
                // Update local data
                if (currentUserData) {
                    currentUserData.plan = 'free';
                    currentUserData.subscriptionDate = null;
                    currentUserData.planExpiredAt = now;
                    currentUserData.previousPlan = 'paid';
                }
                
                // Show expiration notice
                showExpirationNotice();
                
                return true; // Plan was expired
            } else {
                const daysRemaining = PREMIUM_PLAN_DURATION_DAYS - daysSinceSubscription;
                console.log(`Premium plan active, ${daysRemaining} days remaining`);
                return false; // Plan is still active
            }
            
        } catch (error) {
            console.error("Error checking plan expiration:", error);
            return false;
        }
    }

    // Show expiration notice when premium plan expires
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
            animation: slideDown 0.5s ease-out;
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
        
        // Insert after premium banner or at top of dashboard
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            const premiumBanner = document.getElementById('premiumBanner');
            if (premiumBanner && premiumBanner.style.display !== 'none') {
                dashboardContainer.insertBefore(notice, premiumBanner.nextSibling);
            } else {
                dashboardContainer.insertBefore(notice, dashboardContainer.firstChild);
            }
        }
        
        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (notice.parentNode) {
                notice.style.opacity = '0';
                notice.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (notice.parentNode) {
                        notice.parentNode.removeChild(notice);
                    }
                }, 500);
            }
        }, 10000);
    }

    // FIXED: Check and reset weekly test count for free users
    async function checkAndResetTestCount(userId, userData) {
        try {
            const lastReset = userData.lastTestResetDate?.toDate();
            const now = new Date();
            
            console.log("Checking weekly reset:", {
                lastReset: lastReset,
                now: now,
                testsTakenThisWeek: userData.testsTakenThisWeek || 0
            });
            
            // If lastReset doesn't exist, initialize it
            if (!lastReset) {
                console.log("No last reset date found, initializing...");
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    testsTakenThisWeek: 0,
                    lastTestResetDate: now
                });
                
                if (currentUserData) {
                    currentUserData.testsTakenThisWeek = 0;
                    currentUserData.lastTestResetDate = now;
                }
                
                console.log("Weekly test count initialized to 0");
                return;
            }
            
            // Calculate days difference
            const daysDiff = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));
            console.log(`Days since last reset: ${daysDiff}`);
            
            // Reset if 7 or more days have passed
            if (daysDiff >= 7) {
                console.log(`Resetting weekly test count (${daysDiff} days since last reset)`);
                
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    testsTakenThisWeek: 0,
                    lastTestResetDate: now
                });
                
                console.log("Weekly test count reset to 0");
                
                // Update local data
                if (currentUserData) {
                    currentUserData.testsTakenThisWeek = 0;
                    currentUserData.lastTestResetDate = now;
                }
                
                // Show reset notification for free users
                if (userData.plan === 'free') {
                    console.log("Showing weekly reset notification");
                    showWeeklyResetNotification();
                }
            } else {
                console.log(`No reset needed (${daysDiff} days since last reset, need 7 days)`);
            }
        } catch (error) {
            console.error("Error resetting test count:", error);
        }
    }

    // Show weekly reset notification
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
            animation: slideDown 0.5s ease-out;
        `;
        
        notice.innerHTML = `
            <i class="fas fa-sync-alt"></i> 
            <strong>Weekly Reset Complete!</strong> 
            Your test limit has been refreshed. You now have ${FREE_PLAN_WEEKLY_LIMIT} tests available this week.
        `;
        
        // Insert at top of dashboard
        const dashboardContainer = document.querySelector('.dashboard-container');
        if (dashboardContainer) {
            const firstChild = dashboardContainer.firstChild;
            if (firstChild) {
                dashboardContainer.insertBefore(notice, firstChild);
            } else {
                dashboardContainer.appendChild(notice);
            }
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notice.parentNode) {
                notice.style.opacity = '0';
                notice.style.transition = 'opacity 0.5s ease';
                setTimeout(() => {
                    if (notice.parentNode) {
                        notice.parentNode.removeChild(notice);
                    }
                }, 500);
            }
        }, 5000);
    }

    // Upgrade user to premium
    async function upgradeToPremium() {
        try {
            const user = auth.currentUser;
            if (!user) {
                alert('You must be logged in to upgrade.');
                return;
            }
            
            // Show loading
            if (upgradeBtn) {
                const originalText = upgradeBtn.innerHTML;
                upgradeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
                upgradeBtn.disabled = true;
            }
            
            // In a real app, this would be a payment processing callback
            // For now, we'll simulate successful payment
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                plan: 'paid',
                subscriptionDate: new Date(),
                planExpiredAt: null,
                previousPlan: 'free',
                lastUpgraded: new Date()
            });
            
            // Update local data
            if (currentUserData) {
                currentUserData.plan = 'paid';
                currentUserData.subscriptionDate = new Date();
                currentUserData.previousPlan = 'free';
                
                // Update UI immediately
                updateUIForPlan();
                showPremiumBanner();
                setupSubjectDropdown();
            }
            
            // Show success message
            alert(`🎉 Congratulations! You are now a Premium member!\n\n✅ Unlimited tests for all subjects\n✅ Detailed solutions unlocked\n✅ Premium status for 30 days\n\nYour subscription will automatically renew.`);
            
            // Reset upgrade button
            if (upgradeBtn) {
                upgradeBtn.innerHTML = '<i class="fas fa-rocket"></i> UPGRADE NOW';
                upgradeBtn.disabled = false;
            }
            
        } catch (error) {
            console.error("Error upgrading to premium:", error);
            alert('Error upgrading to premium. Please try again.');
            
            // Reset upgrade button on error
            if (upgradeBtn) {
                upgradeBtn.innerHTML = '<i class="fas fa-rocket"></i> UPGRADE NOW';
                upgradeBtn.disabled = false;
            }
        }
    }

    // =============================================
    // LOAD USER DATA WITH PLAN CHECK
    // =============================================
    async function loadUserData(userId) {
        try {
            const userRef = doc(db, "users", userId);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                currentUserData = userSnap.data();
                console.log("User data loaded:", currentUserData);
                
                // ========== CHECK PREMIUM PLAN EXPIRATION ==========
                const planExpired = await checkPlanExpiration(userId, currentUserData);
                
                // ========== CHECK WEEKLY TEST COUNT RESET ==========
                // IMPORTANT: Check and reset BEFORE using the test count
                await checkAndResetTestCount(userId, currentUserData);
                
                // Load user profile
                loadUserProfile(currentUserData);
                
                // Set up REAL-TIME stats listener
                setupRealTimeStats(userId);
                
                // Update UI based on plan (AFTER reset check)
                updateUIForPlan();
                
                // Show/hide premium banner (ALWAYS show for free users)
                showPremiumBanner();
                
                // Setup subject dropdown based on plan
                setupSubjectDropdown();
                
            } else {
                console.error("User document does not exist!");
                // Create default user document
                await createDefaultUserProfile(userId);
                loadUserData(userId); // Reload
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // Create default user profile
    async function createDefaultUserProfile(userId) {
        try {
            const userRef = doc(db, "users", userId);
            const user = auth.currentUser;
            
            await updateDoc(userRef, {
                fullName: user.displayName || user.email.split('@')[0],
                email: user.email,
                plan: 'free',
                testsTakenThisWeek: 0,
                lastTestResetDate: new Date(), // Initialize reset date
                totalTestsTaken: 0,
                profilePicture: '',
                joinedAt: new Date(),
                status: 'active',
                subscriptionDate: null,
                planExpiredAt: null,
                previousPlan: null,
                lastUpgraded: null
            }, { merge: true });
            
            console.log("Default user profile created with weekly reset initialized");
        } catch (error) {
            console.error("Error creating default profile:", error);
        }
    }

    // Update UI based on user plan
    function updateUIForPlan() {
        if (!currentUserData) return;
        
        const isFreePlan = currentUserData.plan === 'free';
        const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
        const remainingTests = Math.max(0, FREE_PLAN_WEEKLY_LIMIT - testsTakenThisWeek);
        
        console.log("Updating UI with:", {
            isFreePlan: isFreePlan,
            testsTakenThisWeek: testsTakenThisWeek,
            remainingTests: remainingTests,
            lastResetDate: currentUserData.lastTestResetDate
        });
        
        // Calculate days remaining for premium users
        let daysRemaining = 0;
        if (!isFreePlan && currentUserData.subscriptionDate) {
            const subscriptionDate = currentUserData.subscriptionDate.toDate();
            const now = new Date();
            const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
            daysRemaining = Math.max(0, PREMIUM_PLAN_DURATION_DAYS - daysSinceSubscription);
        }
        
        // Update plan status display
        if (userPlan) userPlan.textContent = isFreePlan ? 'Free' : 'Premium';
        
        if (planStatus) {
            if (isFreePlan) {
                planStatus.textContent = 'Basic Access';
            } else {
                planStatus.textContent = daysRemaining > 0 ? 
                    `${daysRemaining} days remaining` : 
                    'Expiring soon';
            }
        }
        
        // Update plan status card styling
        if (planStatusCard) {
            if (isFreePlan) {
                planStatusCard.style.borderLeftColor = '#95a5a6';
                planIcon.className = 'fas fa-user';
                planIcon.style.color = '#95a5a6';
            } else {
                planStatusCard.style.borderLeftColor = '#9C27B0'; // Eggplant color
                planIcon.className = 'fas fa-crown';
                planIcon.style.color = '#FFD700';
            }
        }
        
        // Update welcome message
        if (userPlanStatus) {
            if (isFreePlan) {
                userPlanStatus.innerHTML = `Free Plan • <strong>${remainingTests} tests remaining this week</strong> <i class="fas fa-info-circle" style="color: #4285F4;"></i>`;
            } else {
                if (daysRemaining > 0) {
                    userPlanStatus.innerHTML = `🎉 Premium Member • <strong>${daysRemaining} days remaining</strong> <i class="fas fa-crown" style="color: #FFD700;"></i>`;
                } else {
                    userPlanStatus.innerHTML = `⚠️ Premium Expiring • <strong>Renew now!</strong> <i class="fas fa-exclamation-triangle" style="color: #FF9800;"></i>`;
                }
            }
        }
        
        // Show test limit info for free users
        if (testLimitInfo) {
            if (isFreePlan) {
                testLimitInfo.style.display = 'block';
                if (testsRemaining) testsRemaining.textContent = remainingTests;
            } else {
                testLimitInfo.style.display = 'none';
            }
        }
    }

    // =============================================
    // REAL-TIME STATS LISTENER
    // =============================================
    function setupRealTimeStats(userId) {
        // Clean up previous listener if exists
        if (unsubscribeStats) {
            unsubscribeStats();
        }
        
        // Set up real-time listener for test results
        const q = query(
            collection(db, "test_results"),
            where("userId", "==", userId),
            orderBy("completedAt", "desc")
        );
        
        unsubscribeStats = onSnapshot(q, (snapshot) => {
            console.log("Real-time update received for user:", userId);
            
            // Update statistics
            updateStatistics(snapshot);
            
            // Update recent tests list
            updateRecentTests(snapshot);
        }, (error) => {
            console.error("Error in real-time listener:", error);
        });
    }

    // Update statistics from snapshot
    function updateStatistics(snapshot) {
        if (snapshot.empty) {
            if (completedTests) completedTests.textContent = "0";
            if (averageScore) averageScore.textContent = "0";
            if (performanceMessage) performanceMessage.textContent = "start practicing!";
            return;
        }
        
        let totalTests = 0;
        let totalScore = 0;
        
        snapshot.forEach((doc) => {
            const testData = doc.data();
            if (testData.score) {
                totalTests++;
                totalScore += testData.score;
            }
        });
        
        // Update stats with animation
        if (completedTests) {
            completedTests.textContent = totalTests;
            // Add animation
            completedTests.style.transform = "scale(1.1)";
            setTimeout(() => {
                completedTests.style.transform = "scale(1)";
            }, 300);
        }
        
        const average = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
        if (averageScore) {
            averageScore.textContent = average;
            // Add animation
            averageScore.style.transform = "scale(1.1)";
            setTimeout(() => {
                averageScore.style.transform = "scale(1)";
            }, 300);
        }
        
        // Update performance message
        let message = "practice more!";
        if (average >= 90) message = "excellent!";
        else if (average >= 80) message = "great job!";
        else if (average >= 70) message = "good work!";
        else if (average >= 60) message = "keep improving!";
        
        if (performanceMessage) {
            performanceMessage.textContent = message;
        }
        
        console.log("Statistics updated:", { totalTests, average });
    }

    // Update recent tests from snapshot
    function updateRecentTests(snapshot) {
        if (snapshot.empty) {
            if (testsList) {
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
            }
            return;
        }
        
        if (testsList) {
            testsList.innerHTML = '';
            
            // Take only the most recent tests based on limit
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
    }

    // Setup subject dropdown based on plan
    function setupSubjectDropdown() {
        if (!subjectSelect) return;
        
        // Clear existing options
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
        
        // Show/hide plan restrictions notice
        if (planRestrictions) {
            planRestrictions.style.display = isFreePlan ? 'block' : 'none';
        }
    }

    // Show premium banner for free users (ALWAYS SHOW)
    function showPremiumBanner() {
        if (!premiumBanner || !currentUserData) return;
        
        const isFreePlan = currentUserData.plan === 'free';
        
        if (isFreePlan) {
            premiumBanner.style.display = 'flex';
        } else {
            premiumBanner.style.display = 'none';
        }
    }

    // =============================================
    // TEST LIMIT VALIDATION
    // =============================================
    async function validateTestStart() {
        if (!currentUserData) return { valid: false, message: "User data not loaded" };
        
        const isFreePlan = currentUserData.plan === 'free';
        
        if (isFreePlan) {
            // Check weekly limit
            const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
            console.log("Validating test start:", { testsTakenThisWeek, FREE_PLAN_WEEKLY_LIMIT });
            
            if (testsTakenThisWeek >= FREE_PLAN_WEEKLY_LIMIT) {
                return {
                    valid: false,
                    message: `You have reached your weekly limit of ${FREE_PLAN_WEEKLY_LIMIT} tests on the Free Plan.\n\nUpgrade to Premium for unlimited tests!`
                };
            }
            
            // Check subject restriction
            const selectedSubject = subjectSelect.value;
            if (!FREE_PLAN_SUBJECTS.includes(selectedSubject)) {
                return {
                    valid: false,
                    message: `Free Plan users can only take tests in Mathematics and English.\n\nUpgrade to Premium to access all subjects!`
                };
            }
        }
        
        return { valid: true, message: "" };
    }

    async function incrementTestCount() {
        try {
            const user = auth.currentUser;
            if (!user) return;
            
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                testsTakenThisWeek: increment(1),
                totalTestsTaken: increment(1),
                lastActivity: new Date()
            });
            
            // Update local data
            if (currentUserData) {
                currentUserData.testsTakenThisWeek = (currentUserData.testsTakenThisWeek || 0) + 1;
                currentUserData.totalTestsTaken = (currentUserData.totalTestsTaken || 0) + 1;
                updateUIForPlan();
                console.log("Test count incremented:", currentUserData.testsTakenThisWeek);
            }
        } catch (error) {
            console.error("Error incrementing test count:", error);
        }
    }

    // =============================================
    // START PRACTICE TEST WITH PROPER RANDOM SELECTION
    // =============================================
    async function startPracticeTest() {
        const selectedExam = classSelect.value;
        const selectedSubject = subjectSelect.value;
        
        // Validate selections
        if (!selectedExam || selectedExam === '') {
            alert('❌ Please select an exam type');
            classSelect.focus();
            return;
        }
        
        if (!selectedSubject || selectedSubject === '') {
            alert('❌ Please select a subject');
            subjectSelect.focus();
            return;
        }
        
        // Check plan restrictions
        const validation = await validateTestStart();
        if (!validation.valid) {
            alert(`❌ ${validation.message}`);
            return;
        }
        
        try {
            showLoadingState(true);
            
            const firestoreExamType = EXAM_TYPE_MAP[selectedExam] || selectedExam;
            
            // Fetch ALL questions from Firestore
            const allQuestions = await fetchQuestions(firestoreExamType, selectedSubject);
            
            if (allQuestions.length === 0) {
                showLoadingState(false);
                alert(`No questions found for "${selectedSubject}" in "${selectedExam}".\n\nPlease try another subject or contact admin.`);
                return;
            }
            
            // Check if we have enough questions
            if (allQuestions.length < QUESTIONS_TO_FETCH) {
                showLoadingState(false);
                alert(`Only ${allQuestions.length} questions available for "${selectedSubject}".\n\nPlease try another subject or contact admin to add more questions.`);
                return;
            }
            
            // PROPER RANDOM SELECTION: Shuffle all questions and take the first N
            const shuffledQuestions = shuffleArray([...allQuestions]); // Create a copy and shuffle
            const selectedQuestions = shuffledQuestions.slice(0, QUESTIONS_TO_FETCH);
            
            // Calculate total time
            const totalTime = selectedQuestions.reduce((total, q) => {
                return total + (parseInt(q.timeLimit) || 120);
            }, 0);
            
            // Store user plan info for test page
            const testData = {
                testId: generateTestId(),
                examType: firestoreExamType,
                originalExamType: selectedExam,
                subject: selectedSubject,
                questions: selectedQuestions,
                totalQuestions: selectedQuestions.length,
                totalTime: totalTime,
                startTime: new Date().toISOString(),
                userId: auth.currentUser.uid,
                userAnswers: Array(selectedQuestions.length).fill(null),
                userPlan: currentUserData.plan, // Include plan info
                plan: currentUserData.plan || 'free' // Also store plan separately for test page
            };
            
            // Increment test count for free users BEFORE starting test
            if (currentUserData.plan === 'free') {
                await incrementTestCount();
            }
            
            sessionStorage.setItem('currentTest', JSON.stringify(testData));
            sessionStorage.removeItem('previousTest');
            
            alert(`✅ Test ready!\n\n${selectedQuestions.length} questions loaded.\nTotal time: ${Math.floor(totalTime/60)} minutes`);
            
            window.location.href = 'test.html';
            
        } catch (error) {
            console.error('Error starting test:', error);
            showLoadingState(false);
            
            if (error.code === 'permission-denied') {
                alert('❌ Permission denied. Please make sure you are logged in correctly.');
            } else {
                alert(`❌ Error starting test: ${error.message || 'Please try again.'}`);
            }
        }
    }

    // =============================================
    // FIXED: fetchQuestions function - accepts questions with images only
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
                
                // FIX: Accept questions that have either text OR image AND a correct answer
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
                } else {
                    console.log(`Skipping question ${doc.id}: missing content or correct answer`, {
                        hasText: !!(questionData.questionText && questionData.questionText.trim() !== ''),
                        hasImage: !!questionData.questionImage,
                        hasCorrectAnswer: hasCorrectAnswer
                    });
                }
            });
            
            console.log(`Fetched ${questions.length} valid questions for ${subject} (${examType})`);
            
            return questions;
            
        } catch (error) {
            console.error('Error in fetchQuestions:', error);
            throw error;
        }
    }

    // =============================================
    // PROFILE PICTURE HANDLING & UTILITY FUNCTIONS
    // =============================================
    async function handleProfileUpload(event) {
        const file = event.target.files[0];
        
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('Please select an image file (JPEG, PNG, GIF, etc.)');
            return;
        }
        
        const maxSizeMB = 10;
        if (file.size > maxSizeMB * 1024 * 1024) {
            alert(`Image size should be less than ${maxSizeMB}MB`);
            return;
        }
        
        const user = auth.currentUser;
        if (!user) {
            alert('You must be logged in to upload a profile picture');
            return;
        }
        
        try {
            const originalHTML = profileImg.innerHTML;
            profileImg.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            
            let compressedBase64;
            
            if (file.size > 800 * 1024) {
                compressedBase64 = await compressImage(file, 800, 800, 0.7);
            } else {
                compressedBase64 = await convertImageToBase64(file);
            }
            
            const maxBase64Size = 900000;
            if (compressedBase64.length > maxBase64Size) {
                compressedBase64 = await compressImage(file, 600, 600, 0.4);
                
                if (compressedBase64.length > maxBase64Size) {
                    alert('Image is too large even after compression. Please choose a smaller image.');
                    return;
                }
            }
            
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                profilePicture: compressedBase64,
                profileUpdatedAt: new Date().toISOString()
            });
            
            profileImg.src = compressedBase64;
            profileImg.alt = "Profile Picture";
            
            alert('✅ Profile picture updated successfully!');
            
        } catch (error) {
            console.error('Error uploading profile picture:', error);
            setDefaultProfileImage();
            alert('❌ Failed to upload profile picture. Please try again.');
        } finally {
            event.target.value = '';
        }
    }

    function convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const reader = new FileReader();
            
            reader.onload = (e) => {
                img.src = e.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
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

    async function loadUserProfile(userData) {
        try {
            if (userName) {
                const displayName = userData.fullName || userData.email || 'Student';
                userName.textContent = displayName;
            }
            
            const profilePictureData = userData.profilePicture;
            
            if (profilePictureData) {
                if (profilePictureData.startsWith('data:image')) {
                    if (profileImg) {
                        profileImg.src = profilePictureData;
                        profileImg.alt = "Profile Picture";
                    }
                } else if (profilePictureData.startsWith('http')) {
                    const img = new Image();
                    img.onload = () => {
                        if (profileImg) {
                            profileImg.src = profilePictureData;
                            profileImg.alt = "Profile Picture";
                        }
                    };
                    img.onerror = () => {
                        setDefaultProfileImage();
                    };
                    img.src = profilePictureData;
                } else {
                    setDefaultProfileImage();
                }
            } else {
                setDefaultProfileImage();
            }
        } catch (error) {
            console.error('Error loading user profile:', error);
            setDefaultProfileImage();
        }
    }

    function setDefaultProfileImage() {
        if (!profileImg) return;
        
        const user = auth.currentUser;
        let userNameText = 'User';
        
        if (user && user.displayName) {
            userNameText = user.displayName.split(' ')[0];
        } else if (user && user.email) {
            userNameText = user.email.split('@')[0];
        }
        
        profileImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNameText)}&background=4285F4&color=fff&size=120`;
        profileImg.alt = "Default Profile";
    }

    function createTestItem(testData) {
        const testItem = document.createElement('div');
        testItem.className = 'test-item';
        
        let timeAgo = 'Recently';
        if (testData.completedAt) {
            const completedDate = testData.completedAt.toDate();
            timeAgo = formatTimeAgo(completedDate);
        }
        
        const subjectIcon = getSubjectIcon(testData.subject);
        const subjectName = testData.subject ? 
            testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 
            'Test';
        
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

    function shuffleArray(array) {
        if (!array || array.length === 0) return [];
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
            startTestBtn.style.opacity = '0.7';
        } else {
            startTestBtn.innerHTML = '<i class="fas fa-play-circle"></i> Start Practice Test';
            startTestBtn.disabled = false;
            startTestBtn.style.opacity = '1';
        }
    }

    // Call initDashboard to start everything
    console.log("DOM loaded, calling initDashboard...");
    initDashboard();
});