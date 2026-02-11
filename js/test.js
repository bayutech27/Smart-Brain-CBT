// test.js - Test Page with Firestore Questions
import { auth, db } from "./main.js";
import { 
    collection,
    addDoc,
    getDoc,
    doc,
    updateDoc,
    increment,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import { 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// DOM Elements
const testSubject = document.getElementById('testSubject');
const questionCounter = document.getElementById('questionCounter');
const currentQuestionSpan = document.getElementById('currentQuestion');
const totalQuestionsSpan = document.getElementById('totalQuestions');
const timerElement = document.getElementById('timer');
const questionContent = document.getElementById('questionContent');
const questionText = document.getElementById('questionText');
const optionsContainer = document.getElementById('optionsContainer');
const progressBar = document.getElementById('progressBar');
const questionDots = document.getElementById('questionDots');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const getResultBtn = document.getElementById('getResultBtn');
const submitModal = document.getElementById('submitModal');
const resultsModal = document.getElementById('resultsModal');
const cancelSubmit = document.getElementById('cancelSubmit');
const confirmSubmit = document.getElementById('confirmSubmit');
const answeredCount = document.getElementById('answeredCount');
const totalQuestionsModal = document.getElementById('totalQuestionsModal');
const finalScore = document.getElementById('finalScore');
const correctCount = document.getElementById('correctCount');
const totalQuestionsCount = document.getElementById('totalQuestionsCount');
const performanceMessage = document.getElementById('performanceMessage');
const backToDashboard = document.getElementById('backToDashboard');

// Test data from sessionStorage
let testData = null;
let timeRemaining = 0;
let timerInterval = null;
let currentQuestionIndex = 0;

// Initialize test page
document.addEventListener('DOMContentLoaded', () => {
    // Set current year
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    // Check authentication
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            await loadTestData();
        }
    });
    
    // Event listeners
    prevBtn.addEventListener('click', showPreviousQuestion);
    nextBtn.addEventListener('click', showNextQuestion);
    getResultBtn.addEventListener('click', showSubmitModal);
    cancelSubmit.addEventListener('click', hideSubmitModal);
    confirmSubmit.addEventListener('click', submitTest);
    backToDashboard.addEventListener('click', goToDashboard);
    
    // Keyboard navigation
    document.addEventListener('keydown', handleKeyboardNavigation);
});

// Load test data from sessionStorage AND fetch user plan
async function loadTestData() {
    const savedTest = sessionStorage.getItem('currentTest');
    
    if (!savedTest) {
        alert('No test found. Please start a test from the dashboard.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    try {
        testData = JSON.parse(savedTest);
        console.log("Test data loaded:", testData);
        
        // Fetch user's plan from Firestore if not already in testData
        if (!testData.plan) {
            await fetchUserPlan();
        }
        
        initializeTest();
    } catch (error) {
        console.error('Error loading test data:', error);
        alert('Error loading test. Please try again.');
        window.location.href = 'dashboard.html';
    }
}

// Fetch user's plan from Firestore
async function fetchUserPlan() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in");
            testData.plan = 'free';
            return;
        }
        
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            testData.plan = userData.plan || 'free';
            console.log("User plan fetched from Firestore:", testData.plan);
        } else {
            console.log("User document not found, defaulting to free plan");
            testData.plan = 'free';
        }
    } catch (error) {
        console.error("Error fetching user plan:", error);
        testData.plan = 'free';
    }
}

// Initialize test
function initializeTest() {
    if (!testData || !testData.questions) {
        console.error("Test data or questions missing:", testData);
        alert('Error: Test questions not loaded properly.');
        window.location.href = 'dashboard.html';
        return;
    }
    
    const subjectName = testData.subject ? 
        testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 
        'Unknown Subject';
    testSubject.innerHTML = `<i class="fas fa-book"></i> ${subjectName} - ${testData.examType || 'Test'}`;
    
    totalQuestionsSpan.textContent = testData.totalQuestions || testData.questions.length;
    totalQuestionsModal.textContent = testData.totalQuestions || testData.questions.length;
    
    timeRemaining = testData.totalTime || (testData.questions.length * 120);
    updateTimerDisplay();
    startTimer();
    
    generateQuestionDots();
    
    if (!testData.userAnswers) {
        testData.userAnswers = Array(testData.questions.length).fill(null);
    }
    
    loadQuestion(0);
    updateProgressBar();
    updateAnsweredCount();
}

// Load question with image support
function loadQuestion(index) {
    if (!testData || !testData.questions || index < 0 || index >= testData.questions.length) {
        console.error("Invalid question index or questions missing");
        return;
    }
    
    currentQuestionIndex = index;
    const question = testData.questions[index];
    
    if (!question) {
        console.error("Question not found at index:", index);
        return;
    }
    
    // Clear question content
    questionContent.innerHTML = '';
    
    // Check if we have question text, image, or both
    const hasQuestionText = question.questionText && question.questionText.trim() !== '';
    const hasQuestionImage = question.questionImage;
    
    let questionHTML = '';
    
    if (hasQuestionText && hasQuestionImage) {
        // Display both text and image
        questionHTML = `
            <div class="question-text-content">
                ${formatTextForDisplay(question.questionText)}
            </div>
            <div class="question-image-container">
                <img src="${question.questionImage}" 
                     alt="Question image" 
                     class="question-image">
                <div class="image-label">
                    <i class="fas fa-image"></i> Question Image
                </div>
            </div>
        `;
    } else if (hasQuestionText) {
        // Display only text
        questionHTML = `
            <div class="question-text-content">
                ${formatTextForDisplay(question.questionText)}
            </div>
        `;
    } else if (hasQuestionImage) {
        // Display only image
        questionHTML = `
            <div class="question-image-container">
                <img src="${question.questionImage}" 
                     alt="Question image" 
                     class="question-image">
                <div class="image-label">
                    <i class="fas fa-image"></i> Question Image
                </div>
            </div>
        `;
    } else {
        // No content - show error
        questionHTML = `<div class="question-text-content">Question content not available</div>`;
    }
    
    questionContent.innerHTML = questionHTML;
    currentQuestionSpan.textContent = index + 1;
    optionsContainer.innerHTML = '';
    
    const options = question.options || {
        A: question.optionA || "",
        B: question.optionB || "",
        C: question.optionC || "",
        D: question.optionD || ""
    };
    
    ['A', 'B', 'C', 'D'].forEach(letter => {
        if (options[letter]) {
            const optionElement = document.createElement('div');
            optionElement.className = 'option';
            optionElement.dataset.option = letter;
            
            if (testData.userAnswers[index] === letter) {
                optionElement.classList.add('selected');
            }
            
            optionElement.innerHTML = `
                <div class="option-letter">${letter}</div>
                <div class="option-text">${options[letter]}</div>
            `;
            
            optionElement.addEventListener('click', () => selectOption(letter));
            optionsContainer.appendChild(optionElement);
        }
    });
    
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === testData.questions.length - 1;
    updateActiveDot(index);
    updateProgressBar();
}

// Select option
function selectOption(optionLetter) {
    document.querySelectorAll('.option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`.option[data-option="${optionLetter}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    testData.userAnswers[currentQuestionIndex] = optionLetter;
    updateAnsweredDot(currentQuestionIndex);
    updateAnsweredCount();
}

// Generate question dots
function generateQuestionDots() {
    if (!testData || !testData.questions) return;
    
    questionDots.innerHTML = '';
    
    for (let i = 0; i < testData.questions.length; i++) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        if (i === currentQuestionIndex) {
            dot.classList.add('active');
        }
        if (testData.userAnswers && testData.userAnswers[i] !== null) {
            dot.classList.add('answered');
        }
        dot.dataset.index = i;
        dot.addEventListener('click', () => {
            loadQuestion(i);
        });
        questionDots.appendChild(dot);
    }
}

// Update active dot
function updateActiveDot(index) {
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === index) {
            dot.classList.add('active');
        }
    });
}

// Update answered dot
function updateAnsweredDot(index) {
    const dot = document.querySelector(`.dot[data-index="${index}"]`);
    if (dot) {
        dot.classList.add('answered');
    }
}

// Update progress bar
function updateProgressBar() {
    if (!testData || !testData.questions) return;
    
    const progress = ((currentQuestionIndex + 1) / testData.questions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

// Update answered count
function updateAnsweredCount() {
    if (!testData || !testData.userAnswers) return;
    
    const answered = testData.userAnswers.filter(answer => answer !== null).length;
    answeredCount.textContent = answered;
}

// Show previous question
function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
    }
}

// Show next question
function showNextQuestion() {
    if (currentQuestionIndex < testData.questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    }
}

// Start timer
function startTimer() {
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 300) {
            timerElement.classList.add('warning');
        }
        
        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            autoSubmitTest();
        }
    }, 1000);
}

// Update timer display
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Show submit modal
function showSubmitModal() {
    updateAnsweredCount();
    submitModal.style.display = 'flex';
}

// Hide submit modal
function hideSubmitModal() {
    submitModal.style.display = 'none';
}

// Auto submit when time runs out
function autoSubmitTest() {
    getResultBtn.classList.add('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Time\'s Up! Submitting...';
    
    setTimeout(() => {
        submitTest();
    }, 1000);
}

// ⭐⭐ FIXED: Update ONLY total test count when test is submitted (NOT weekly count) ⭐⭐
async function updateTotalTestCountInFirestore() {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in to update test count");
            return;
        }
        
        // Get fresh user data
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            const userData = userDoc.data();
            
            console.log("Updating total test count (weekly count already updated):", { 
                plan: userData.plan,
                currentTotal: userData.totalTestsTaken || 0 
            });
            
            // ⭐⭐ ONLY update totalTestsTaken, NOT testsTakenThisWeek ⭐⭐
            // (weekly count was already updated in dashboard.js when test started)
            const userRef = doc(db, "users", user.uid);
            await updateDoc(userRef, {
                totalTestsTaken: increment(1), // Only increment total
                lastActivity: serverTimestamp()
            });
            
            console.log("✅ Total test count incremented in Firestore");
        }
    } catch (error) {
        console.error("❌ Error updating total test count in Firestore:", error);
        // Don't throw error here - we don't want to prevent test submission
        // if there's an issue with updating the count
    }
}

// Save test result to Firestore - FIXED VERSION
async function saveTestResultToFirestore(score, correctAnswers) {
    try {
        const user = auth.currentUser;
        if (!user) {
            console.error("No user logged in to save test result");
            throw new Error("User not authenticated");
        }
        
        const subjectName = testData.subject ? 
            testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 
            'Unknown Subject';
        
        // Prepare questions data without images to reduce size
        const questionsData = testData.questions.map((q, index) => ({
            id: q.id || `q-${index}`,
            questionText: q.questionText ? (q.questionText.length > 100 ? q.questionText.substring(0, 100) + "..." : q.questionText) : "",
            hasQuestionImage: !!q.questionImage,
            correctAnswer: q.correctAnswer || "",
            userAnswer: testData.userAnswers[index] || null
        }));
        
        // Create a lean result data object
        const resultData = {
            userId: user.uid,
            userName: user.displayName || user.email || "Anonymous",
            testId: testData.testId || `test-${Date.now()}`,
            examType: testData.examType || "Practice",
            subject: testData.subject || "general",
            subjectName: subjectName,
            score: score,
            totalQuestions: testData.questions.length,
            correctAnswers: correctAnswers,
            userAnswers: testData.userAnswers,
            questions: questionsData,
            completedAt: serverTimestamp(),
            timeSpent: (testData.totalTime || (testData.questions.length * 120)) - timeRemaining,
            plan: testData.plan || 'free'
        };
        
        console.log("Saving test result to Firestore:", resultData);
        
        // Try to save to Firestore
        const docRef = await addDoc(collection(db, "test_results"), resultData);
        console.log('✅ Test result saved to Firestore with ID:', docRef.id);
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Error saving test result to Firestore:', error);
        console.error('Error details:', {
            name: error.name,
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        // Check for specific Firestore errors
        if (error.code === 'permission-denied') {
            throw new Error("Permission denied. Check Firestore rules.");
        } else if (error.code === 'invalid-argument') {
            throw new Error("Invalid data format. Some data may be too large or malformed.");
        } else if (error.message && error.message.includes('size')) {
            throw new Error("Data too large for Firestore. Try reducing image sizes.");
        }
        
        throw error;
    }
}

// Alternative: Save to localStorage if Firestore fails
function saveTestResultToLocalStorage(score, correctAnswers) {
    try {
        const user = auth.currentUser;
        const resultData = {
            userId: user?.uid || "anonymous",
            testId: testData.testId || `test-${Date.now()}`,
            subject: testData.subject,
            examType: testData.examType,
            score: score,
            correctAnswers: correctAnswers,
            totalQuestions: testData.questions.length,
            completedAt: new Date().toISOString(),
            timeSpent: (testData.totalTime || (testData.questions.length * 120)) - timeRemaining
        };
        
        // Get existing results or initialize empty array
        const existingResults = JSON.parse(localStorage.getItem('localTestResults') || '[]');
        existingResults.push(resultData);
        
        // Save back to localStorage (limit to last 50 tests)
        const limitedResults = existingResults.slice(-50);
        localStorage.setItem('localTestResults', JSON.stringify(limitedResults));
        
        console.log('✅ Test result saved to localStorage:', resultData);
        return 'local-' + Date.now();
        
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
        throw error;
    }
}

// Submit test - FIXED WITH PROPER COUNT UPDATES
async function submitTest() {
    hideSubmitModal();
    if (timerInterval) {
        clearInterval(timerInterval);
    }
    
    getResultBtn.classList.add('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating Score...';
    
    try {
        // Calculate score
        let correctAnswers = 0;
        testData.questions.forEach((question, index) => {
            const userAnswer = testData.userAnswers[index];
            const correctAnswer = question.correctAnswer;
            
            if (userAnswer === correctAnswer) {
                correctAnswers++;
            }
        });
        
        const score = Math.round((correctAnswers / testData.questions.length) * 100);
        
        // ⭐⭐ FIXED: Update ONLY total test count (weekly count already updated) ⭐⭐
        console.log("Updating total test count for completed test...");
        await updateTotalTestCountInFirestore();
        
        let saveSuccessful = false;
        let saveMethod = '';
        
        // Try to save to Firestore first
        try {
            await saveTestResultToFirestore(score, correctAnswers);
            saveSuccessful = true;
            saveMethod = 'firestore';
        } catch (firestoreError) {
            console.warn('Firestore save failed, trying localStorage:', firestoreError);
            
            // Fallback to localStorage
            try {
                await saveTestResultToLocalStorage(score, correctAnswers);
                saveSuccessful = true;
                saveMethod = 'localStorage';
            } catch (localStorageError) {
                console.error('Both save methods failed:', localStorageError);
                saveSuccessful = false;
            }
        }
        
        if (!saveSuccessful) {
            // Even if save fails, still show results
            console.warn('Could not save test result, but showing results anyway');
        }
        
        // Generate performance message
        let message = "";
        if (score >= 90) message = "Excellent! You're a master of this subject!";
        else if (score >= 80) message = "Great job! You have a strong understanding.";
        else if (score >= 70) message = "Good work! Keep practicing to improve.";
        else if (score >= 60) message = "Not bad! Review the topics you missed.";
        else message = "Keep practicing! You'll improve with more study.";
        
        // Add save status to message
        if (saveMethod === 'localStorage') {
            message += " (Results saved locally)";
        } else if (!saveSuccessful) {
            message += " (Could not save results)";
        }
        
        // Show results immediately
        showResults(score, correctAnswers, message);
        
    } catch (error) {
        console.error('Error in submitTest:', error);
        
        // Even on error, try to show results with basic score calculation
        try {
            let correctAnswers = 0;
            if (testData && testData.questions && testData.userAnswers) {
                testData.questions.forEach((question, index) => {
                    const userAnswer = testData.userAnswers[index];
                    const correctAnswer = question.correctAnswer;
                    
                    if (userAnswer === correctAnswer) {
                        correctAnswers++;
                    }
                });
                
                const score = testData.questions.length > 0 ? 
                    Math.round((correctAnswers / testData.questions.length) * 100) : 0;
                
                showResults(score, correctAnswers, "Test completed (score calculation may be approximate)");
            } else {
                throw new Error("Invalid test data");
            }
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            getResultBtn.classList.remove('btn-loading');
            getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';
            alert('Error submitting test. Please try again or contact support.');
        }
    }
}

// Show results modal
function showResults(score, correctAnswers, message) {
    getResultBtn.classList.remove('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';
    
    finalScore.textContent = score;
    correctCount.textContent = correctAnswers;
    totalQuestionsCount.textContent = testData.questions.length;
    performanceMessage.textContent = message;
    
    resultsModal.style.display = 'flex';
    addSolutionButton();
    
    // Save to sessionStorage for backup
    try {
        sessionStorage.removeItem('currentTest');
        sessionStorage.setItem('previousTest', JSON.stringify({
            ...testData,
            finalScore: score,
            correctAnswers: correctAnswers,
            completedAt: new Date().toISOString()
        }));
    } catch (e) {
        console.warn('Could not save to sessionStorage:', e);
    }
}

// Add solution button to results modal
function addSolutionButton() {
    console.log("Adding solution button...");
    
    const premiumNotification = document.getElementById('premiumNotification');
    if (premiumNotification) {
        premiumNotification.style.display = 'block';
    }
    
    const isPremium = testData && (
        testData.plan === 'paid' || 
        testData.plan === 'premium' || 
        testData.plan === 'pro' || 
        testData.plan === 'monthly' || 
        testData.plan === 'yearly'
    );
    
    console.log('Is premium check:', isPremium);
    
    const modalButtons = document.querySelector('#resultsModal .modal-buttons');
    if (!modalButtons) {
        console.error('Modal buttons container not found!');
        return;
    }
    
    const existingBtn = document.getElementById('solutionBtn');
    if (existingBtn) {
        existingBtn.remove();
    }
    
    const solutionBtn = document.createElement('button');
    solutionBtn.id = 'solutionBtn';
    solutionBtn.className = 'modal-btn';
    solutionBtn.innerHTML = '<i class="fas fa-lightbulb"></i> View Detailed Solutions';
    
    if (isPremium) {
        solutionBtn.style.backgroundColor = '#17a2b8';
        solutionBtn.style.cursor = 'pointer';
        solutionBtn.title = 'Click to view detailed solutions';
        solutionBtn.addEventListener('click', () => {
            console.log('Premium user clicked solution button');
            resultsModal.style.display = 'none';
            showSolutionsModal(testData.questions, testData.userAnswers);
        });
    } else {
        solutionBtn.style.backgroundColor = '#6c757d';
        solutionBtn.style.opacity = '0.7';
        solutionBtn.style.cursor = 'not-allowed';
        solutionBtn.title = 'Upgrade to Premium to view detailed solutions';
        solutionBtn.addEventListener('click', () => {
            alert('Upgrade to Premium to access detailed solutions!\n\nPremium benefits include:\n✓ Unlimited tests\n✓ All subjects\n✓ Detailed explanations\n✓ Performance analytics\n✓ No ads\n\nContact admin to upgrade your account.');
        });
    }
    
    const backToDashboardBtn = document.getElementById('backToDashboard');
    if (backToDashboardBtn) {
        modalButtons.insertBefore(solutionBtn, backToDashboardBtn);
    } else {
        modalButtons.appendChild(solutionBtn);
    }
    
    console.log('Solution button added successfully');
}

// Function to show solutions modal with image support
function showSolutionsModal(questions, userAnswers) {
    console.log('Showing solutions modal');
    const modal = document.getElementById('solutionModal');
    const modalBody = document.getElementById('solutionModalBody');
    
    if (!modal || !modalBody) {
        console.error('Solution modal elements not found');
        return;
    }
    
    modalBody.innerHTML = '';
    const solutionsContainer = document.createElement('div');
    solutionsContainer.className = 'solutions-container';
    
    questions.forEach((question, index) => {
        const solutionItem = document.createElement('div');
        solutionItem.className = 'solution-item';
        
        const userAnswer = userAnswers[index];
        const correctAnswer = question.correctAnswer;
        const isCorrect = userAnswer === correctAnswer;
        
        // Check if we have solution text, image, or both
        const hasSolutionText = question.solution && question.solution.trim() !== '';
        const hasSolutionImage = question.solutionImage;
        
        // Build solution content
        let solutionContent = '';
        
        if (hasSolutionText && hasSolutionImage) {
            const processedText = processSolutionText(question.solution);
            solutionContent = `
                <div class="solution-text-preserved">${processedText}</div>
                <div class="solution-image-container">
                    <img src="${question.solutionImage}" 
                         alt="Solution image" 
                         class="solution-image">
                    <div class="image-label">
                        <i class="fas fa-image"></i> Solution Image
                    </div>
                </div>
            `;
        } else if (hasSolutionText) {
            const processedText = processSolutionText(question.solution);
            solutionContent = `<div class="solution-text-preserved">${processedText}</div>`;
        } else if (hasSolutionImage) {
            solutionContent = `
                <div class="solution-image-container">
                    <img src="${question.solutionImage}" 
                         alt="Solution image" 
                         class="solution-image">
                    <div class="image-label">
                        <i class="fas fa-image"></i> Solution Image
                    </div>
                </div>
            `;
        } else {
            solutionContent = '<div class="solution-text-preserved">No detailed solution available for this question.</div>';
        }
        
        // Also check question content for display
        let questionContent = '';
        const hasQuestionText = question.questionText && question.questionText.trim() !== '';
        const hasQuestionImage = question.questionImage;
        
        if (hasQuestionText && hasQuestionImage) {
            questionContent = `
                <p><strong>Question:</strong> ${formatTextForDisplay(question.questionText)}</p>
                <div class="question-image-container" style="margin: 10px 0;">
                    <img src="${question.questionImage}" 
                         alt="Question image" 
                         style="max-width: 200px; max-height: 150px;">
                    <div class="image-label">
                        <i class="fas fa-image"></i> Question Image
                    </div>
                </div>
            `;
        } else if (hasQuestionText) {
            questionContent = `<p><strong>Question:</strong> ${formatTextForDisplay(question.questionText)}</p>`;
        } else if (hasQuestionImage) {
            questionContent = `
                <div class="question-image-container" style="margin: 10px 0;">
                    <img src="${question.questionImage}" 
                         alt="Question image" 
                         style="max-width: 200px; max-height: 150px;">
                    <div class="image-label">
                        <i class="fas fa-image"></i> Question Image
                    </div>
                </div>
            `;
        }
        
        solutionItem.innerHTML = `
            <h4><i class="fas fa-question-circle"></i> Question ${index + 1}</h4>
            ${questionContent}
            <div class="solution-options">
                <p><strong>Your Answer:</strong> <span class="user-answer">${userAnswer || 'Not answered'}</span> 
                <span class="${isCorrect ? 'option-correct' : 'option-incorrect'}">
                    ${isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span></p>
                <p><strong>Correct Answer:</strong> <span class="correct-answer">${correctAnswer || 'Not specified'}</span></p>
            </div>
            <div class="option-explanation">
                <p><strong>Explanation:</strong></p>
                ${solutionContent}
            </div>
        `;
        
        const separator = document.createElement('hr');
        separator.style.margin = '20px 0';
        separator.style.border = 'none';
        separator.style.borderTop = '1px solid #eee';
        solutionItem.appendChild(separator);
        
        solutionsContainer.appendChild(solutionItem);
    });
    
    modalBody.appendChild(solutionsContainer);
    
    const backButtonContainer = document.createElement('div');
    backButtonContainer.style.marginTop = '30px';
    backButtonContainer.style.paddingTop = '20px';
    backButtonContainer.style.borderTop = '2px solid #eee';
    backButtonContainer.style.textAlign = 'center';
    
    const backButton = document.createElement('button');
    backButton.className = 'modal-btn confirm';
    backButton.id = 'backToDashboardFromSolution';
    backButton.innerHTML = '<i class="fas fa-tachometer-alt"></i> Back to Dashboard';
    backButton.style.marginTop = '10px';
    backButton.style.padding = '12px 30px';
    backButton.style.fontSize = '1rem';
    backButton.style.backgroundColor = '#28a745';
    backButton.style.color = 'white';
    backButton.style.border = 'none';
    backButton.style.borderRadius = '5px';
    backButton.style.cursor = 'pointer';
    backButton.style.transition = 'all 0.3s ease';
    
    backButton.addEventListener('mouseenter', () => {
        backButton.style.backgroundColor = '#218838';
        backButton.style.transform = 'translateY(-2px)';
    });
    
    backButton.addEventListener('mouseleave', () => {
        backButton.style.backgroundColor = '#28a745';
        backButton.style.transform = 'translateY(0)';
    });
    
    backButton.addEventListener('click', goToDashboard);
    
    backButtonContainer.appendChild(backButton);
    modalBody.appendChild(backButtonContainer);
    
    modal.style.display = 'flex';
    
    const closeBtn = document.getElementById('closeSolutionModal');
    if (closeBtn) {
        closeBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    const escapeHandler = function(e) {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}

// Process solution text for display
function processSolutionText(text) {
    if (!text) return '';
    
    let processedText = text;
    
    // Handle superscript (^) notation
    processedText = processedText.replace(/\^(\d+)/g, '<sup>$1</sup>');
    
    // Handle subscript (_) notation
    processedText = processedText.replace(/_(\d+)/g, '<sub>$1</sub>');
    
    // Handle chemical formulas with subscripts
    processedText = processedText.replace(/([A-Z][a-z]?)(\d+)/g, function(match, element, number) {
        return element + '<sub>' + number + '</sub>';
    });
    
    // Handle common mathematical expressions
    processedText = processedText.replace(/x\^2/g, 'x<sup>2</sup>');
    processedText = processedText.replace(/x\^3/g, 'x<sup>3</sup>');
    processedText = processedText.replace(/y\^2/g, 'y<sup>2</sup>');
    
    // Convert newlines to <br> tags
    processedText = processedText.replace(/\n/g, '<br>');
    
    // Convert multiple spaces to non-breaking spaces
    processedText = processedText.replace(/  /g, ' &nbsp;');
    
    return processedText;
}

// Format text for HTML display
function formatTextForDisplay(text) {
    if (!text) return "";
    
    const encodedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    // Convert newlines to <br> for display
    const formatted = encodedText.replace(/\n/g, '<br>');
    
    return formatted;
}

// Go back to dashboard
function goToDashboard() {
    window.location.href = 'dashboard.html';
}

// Handle keyboard navigation
function handleKeyboardNavigation(e) {
    if (submitModal.style.display === 'flex' || resultsModal.style.display === 'flex') {
        if (e.key === 'Escape') {
            hideSubmitModal();
            resultsModal.style.display = 'none';
        }
        return;
    }
    
    switch(e.key) {
        case '1':
        case 'A':
        case 'a':
            selectOption('A');
            break;
        case '2':
        case 'B':
        case 'b':
            selectOption('B');
            break;
        case '3':
        case 'C':
        case 'c':
            selectOption('C');
            break;
        case '4':
        case 'D':
        case 'd':
            selectOption('D');
            break;
        case 'ArrowLeft':
            if (currentQuestionIndex > 0) {
                loadQuestion(currentQuestionIndex - 1);
            }
            break;
        case 'ArrowRight':
            if (currentQuestionIndex < testData.questions.length - 1) {
                loadQuestion(currentQuestionIndex + 1);
            }
            break;
        case 'Enter':
            if (currentQuestionIndex < testData.questions.length - 1) {
                loadQuestion(currentQuestionIndex + 1);
            } else {
                showSubmitModal();
            }
            break;
        case 'Escape':
            showSubmitModal();
            break;
    }
}

// Helper function to show error toast
function showErrorToast(message) {
    const toast = document.createElement('div');
    toast.style.position = 'fixed';
    toast.style.top = '20px';
    toast.style.right = '20px';
    toast.style.backgroundColor = '#dc3545';
    toast.style.color = 'white';
    toast.style.padding = '15px';
    toast.style.borderRadius = '5px';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => document.body.removeChild(toast), 500);
    }, 3000);
}