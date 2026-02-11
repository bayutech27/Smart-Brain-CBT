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
    onSnapshot // For real-time updates
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
    let unsubscribeUserData = null; // For user data real-time updates

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
                    // Clean up real-time listeners
                    if (unsubscribeStats) {
                        unsubscribeStats();
                    }
                    if (unsubscribeUserData) {
                        unsubscribeUserData();
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
    // FIXED: PLAN MANAGEMENT FUNCTIONS
    // =============================================

    // FIXED: Check and handle premium plan expiration
    async function checkPlanExpiration(userId, userData) {
        try {
            const isFreePlan = userData.plan === 'free';
            if (isFreePlan) return false; // Only check for paid users
            
            let subscriptionDate = userData.subscriptionDate;
            
            // FIX: Proper Firestore Timestamp conversion
            if (subscriptionDate && subscriptionDate.toDate) {
                subscriptionDate = subscriptionDate.toDate();
            } else if (subscriptionDate && subscriptionDate.seconds) {
                subscriptionDate = new Date(subscriptionDate.seconds * 1000);
            }
            
            if (!subscriptionDate) {
                console.log("Premium user found without subscription date. Setting start date to NOW.");
                
                const now = new Date();
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    subscriptionDate: serverTimestamp()
                });
                
                console.log(`Subscription date set to: ${now.toLocaleDateString()}`);
                return false; // Plan just started, not expired
            }
            
            const now = new Date();
            const daysSinceSubscription = Math.floor((now - subscriptionDate) / (1000 * 60 * 60 * 24));
            
            console.log(`Premium user check: ${daysSinceSubscription} days since subscription (started: ${subscriptionDate.toLocaleDateString()})`);
            
            // If more than 30 days have passed, revert to free plan
            if (daysSinceSubscription >= PREMIUM_PLAN_DURATION_DAYS) {
                console.log(`Premium plan expired (${daysSinceSubscription} days), reverting to free`);
                
                const userRef = doc(db, "users", userId);
                await updateDoc(userRef, {
                    plan: 'free',
                    planExpiredAt: serverTimestamp(),
                    previousPlan: 'paid',
                    subscriptionDate: null // Clear subscription date
                });
                
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

    // FIXED: Check and reset weekly test count for free users
    async function checkAndResetTestCount(userId, userData) {
        try {
            let lastReset = userData.lastTestResetDate;
            
            // FIX: Proper Firestore Timestamp conversion
            if (lastReset && lastReset.toDate) {
                lastReset = lastReset.toDate();
            } else if (lastReset && lastReset.seconds) {
                lastReset = new Date(lastReset.seconds * 1000);
            }
            
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
                    lastTestResetDate: serverTimestamp()
                });
                
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
                    lastTestResetDate: serverTimestamp()
                });
                
                console.log("Weekly test count reset to 0");
                
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

    // =============================================
    // FIXED: LOAD USER DATA WITH REAL-TIME UPDATES
    // =============================================
    async function loadUserData(userId) {
        try {
            const userRef = doc(db, "users", userId);
            
            // FIX: Set up real-time listener for user data FIRST
            unsubscribeUserData = onSnapshot(userRef, async (userSnap) => {
                if (userSnap.exists()) {
                    currentUserData = userSnap.data();
                    console.log("User data updated from Firestore:", currentUserData);
                    
                    // Check plan expiration and weekly reset
                    await checkPlanExpiration(userId, currentUserData);
                    await checkAndResetTestCount(userId, currentUserData);
                    
                    // Load user profile
                    loadUserProfile(currentUserData);
                    
                    // Set up REAL-TIME stats listener (if not already set up)
                    if (!unsubscribeStats) {
                        setupRealTimeStats(userId);
                    }
                    
                    // Update UI based on plan
                    updateUIForPlan();
                    
                    // Show/hide premium banner
                    showPremiumBanner();
                    
                    // Setup subject dropdown based on plan
                    setupSubjectDropdown();
                    
                } else {
                    console.error("User document does not exist!");
                    // Create default user document
                    await createDefaultUserProfile(userId);
                }
            }, (error) => {
                console.error('Error in user data listener:', error);
            });
            
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    // FIXED: Setup real-time stats with proper error handling
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
            console.log("Real-time test results update received. Docs count:", snapshot.size);
            
            // Update statistics
            updateStatistics(snapshot);
            
            // Update recent tests list
            updateRecentTests(snapshot);
            
        }, (error) => {
            console.error("Error in real-time stats listener:", error);
            // Try to set up again after delay
            setTimeout(() => setupRealTimeStats(userId), 5000);
        });
    }

    // FIXED: Update statistics from snapshot with proper data handling
    function updateStatistics(snapshot) {
        if (snapshot.empty) {
            if (completedTests) completedTests.textContent = "0";
            if (averageScore) averageScore.textContent = "0";
            if (performanceMessage) performanceMessage.textContent = "start practicing!";
            return;
        }
        
        let totalTests = 0;
        let totalScore = 0;
        let validTests = [];
        
        snapshot.forEach((doc) => {
            const testData = doc.data();
            if (testData.score !== undefined && testData.score !== null && testData.totalQuestions) {
                totalTests++;
                totalScore += testData.score;
                validTests.push(testData);
            }
        });
        
        // Update stats with animation
        if (completedTests) {
            completedTests.textContent = totalTests;
            completedTests.style.transform = "scale(1.1)";
            setTimeout(() => {
                completedTests.style.transform = "scale(1)";
            }, 300);
        }
        
        const average = totalTests > 0 ? Math.round(totalScore / totalTests) : 0;
        if (averageScore) {
            averageScore.textContent = average;
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
        
        console.log("Statistics updated in real-time:", { 
            totalTests, 
            average,
            validTestsCount: validTests.length 
        });
    }

    // =============================================
    // FIXED: Update UI based on user plan with real-time data
    // =============================================
    function updateUIForPlan() {
        if (!currentUserData) {
            console.log("No user data available for UI update");
            return;
        }
        
        const isFreePlan = currentUserData.plan === 'free';
        const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
        const remainingTests = Math.max(0, FREE_PLAN_WEEKLY_LIMIT - testsTakenThisWeek);
        
        console.log("Updating UI with real-time data:", {
            isFreePlan: isFreePlan,
            testsTakenThisWeek: testsTakenThisWeek,
            remainingTests: remainingTests,
            lastResetDate: currentUserData.lastTestResetDate
        });
        
        // Calculate days remaining for premium users
        let daysRemaining = 0;
        if (!isFreePlan && currentUserData.subscriptionDate) {
            let subscriptionDate = currentUserData.subscriptionDate;
            
            if (subscriptionDate && subscriptionDate.toDate) {
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
                planStatusCard.style.borderLeftColor = '#9C27B0';
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
    // FIXED: TEST LIMIT VALIDATION WITH REAL-TIME CHECK
    // =============================================
    async function validateTestStart() {
        if (!currentUserData) {
            return { valid: false, message: "User data not loaded. Please refresh the page." };
        }
        
        const isFreePlan = currentUserData.plan === 'free';
        
        if (isFreePlan) {
            // Get fresh data from Firestore to ensure we have latest count
            try {
                const user = auth.currentUser;
                if (user) {
                    const userRef = doc(db, "users", user.uid);
                    const userDoc = await getDoc(userRef);
                    if (userDoc.exists()) {
                        const freshUserData = userDoc.data();
                        const testsTakenThisWeek = freshUserData.testsTakenThisWeek || 0;
                        
                        console.log("Fresh validation check:", { 
                            testsTakenThisWeek, 
                            FREE_PLAN_WEEKLY_LIMIT,
                            remaining: FREE_PLAN_WEEKLY_LIMIT - testsTakenThisWeek 
                        });
                        
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
                }
            } catch (error) {
                console.error("Error in validation check:", error);
                // Fallback to local data if Firestore fails
                const testsTakenThisWeek = currentUserData.testsTakenThisWeek || 0;
                if (testsTakenThisWeek >= FREE_PLAN_WEEKLY_LIMIT) {
                    return {
                        valid: false,
                        message: `Weekly limit reached. Please try again or refresh the page.`
                    };
                }
            }
        }
        
        return { valid: true, message: "" };
    }

    // FIXED: Increment test count with transaction-like approach
    async function incrementTestCount() {
        try {
            const user = auth.currentUser;
            if (!user) {
                console.error("No user logged in");
                return;
            }
            
            const userRef = doc(db, "users", user.uid);
            
            // Get fresh user data
            const userDoc = await getDoc(userRef);
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const currentCount = userData.testsTakenThisWeek || 0;
                
                console.log("Incrementing test count from:", currentCount, "to:", currentCount + 1);
                
                await updateDoc(userRef, {
                    testsTakenThisWeek: increment(1),
                    totalTestsTaken: increment(1),
                    lastActivity: serverTimestamp()
                });
                
                console.log("Test count incremented in Firestore");
            }
        } catch (error) {
            console.error("Error incrementing test count:", error);
            throw error; // Re-throw to handle in calling function
        }
    }

    // =============================================
    // START PRACTICE TEST - FIXED WITH PROPER COUNT INCREMENT
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
        
        // Check plan restrictions with fresh data
        const validation = await validateTestStart();
        if (!validation.valid) {
            alert(`❌ ${validation.message}`);
            return;
        }
        
        try {
            showLoadingState(true);
            
            const firestoreExamType = EXAM_TYPE_MAP[selectedExam] || selectedExam;
            
            // Fetch questions from Firestore
            const allQuestions = await fetchQuestions(firestoreExamType, selectedSubject);
            
            if (allQuestions.length === 0) {
                showLoadingState(false);
                alert(`No questions found for "${selectedSubject}" in "${selectedExam}".\n\nPlease try another subject or contact admin.`);
                return;
            }
            
            if (allQuestions.length < QUESTIONS_TO_FETCH) {
                showLoadingState(false);
                alert(`Only ${allQuestions.length} questions available for "${selectedSubject}".\n\nPlease try another subject or contact admin to add more questions.`);
                return;
            }
            
            // Shuffle and select questions
            const shuffledQuestions = shuffleArray([...allQuestions]);
            const selectedQuestions = shuffledQuestions.slice(0, QUESTIONS_TO_FETCH);
            
            // Calculate total time
            const totalTime = selectedQuestions.reduce((total, q) => {
                return total + (parseInt(q.timeLimit) || 120);
            }, 0);
            
            // FIXED: Increment test count BEFORE creating test data
            if (currentUserData.plan === 'free') {
                console.log("Incrementing test count for free user before test starts");
                await incrementTestCount();
            }
            
            // Create test data
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
                userPlan: currentUserData.plan,
                plan: currentUserData.plan || 'free'
            };
            
            // Store in sessionStorage for test page
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
    // REST OF THE FUNCTIONS (UNCHANGED BUT OPTIMIZED)
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
            
            console.log(`Fetched ${questions.length} valid questions for ${subject} (${examType})`);
            return questions;
            
        } catch (error) {
            console.error('Error in fetchQuestions:', error);
            throw error;
        }
    }

    function showPremiumBanner() {
        if (!premiumBanner || !currentUserData) return;
        
        const isFreePlan = currentUserData.plan === 'free';
        premiumBanner.style.display = isFreePlan ? 'flex' : 'none';
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

    // Utility functions remain the same
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

    // Initialize dashboard
    console.log("DOM loaded, calling initDashboard...");
    initDashboard();
});
