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
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            await loadTestData();
        }
    });
    
    prevBtn.addEventListener('click', showPreviousQuestion);
    nextBtn.addEventListener('click', showNextQuestion);
    getResultBtn.addEventListener('click', showSubmitModal);
    cancelSubmit.addEventListener('click', hideSubmitModal);
    confirmSubmit.addEventListener('click', submitTest);
    backToDashboard.addEventListener('click', goToDashboard);
    
    document.addEventListener('keydown', handleKeyboardNavigation);
});

// Load test data from sessionStorage
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
        
        // Fetch fresh user plan from Firestore
        await fetchUserPlan();
        
        initializeTest();
    } catch (error) {
        console.error('Error loading test data:', error);
        alert('Error loading test. Please try again.');
        window.location.href = 'dashboard.html';
    }
}

// FIXED: Fetch user's plan from Firestore with proper error handling
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
            console.log("Fresh user plan fetched from Firestore:", testData.plan);
        } else {
            console.log("User document not found, using session data");
        }
    } catch (error) {
        console.error("Error fetching user plan:", error);
        // Keep existing plan data from sessionStorage
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

// FIXED: Save test result ONLY to Firestore (no localStorage fallback)
async function saveTestResultToFirestore(score, correctAnswers) {
    try {
        const user = auth.currentUser;
        if (!user) {
            throw new Error("User not authenticated");
        }
        
        const subjectName = testData.subject ? 
            testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 
            'Unknown Subject';
        
        // Create result data
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
            completedAt: serverTimestamp(),
            timeSpent: (testData.totalTime || (testData.questions.length * 120)) - timeRemaining,
            plan: testData.plan || 'free',
            // Store question IDs for reference
            questionIds: testData.questions.map(q => q.id || 'unknown')
        };
        
        console.log("Saving test result to Firestore:", resultData);
        
        // Save to Firestore
        const docRef = await addDoc(collection(db, "test_results"), resultData);
        console.log('✅ Test result saved to Firestore with ID:', docRef.id);
        return docRef.id;
        
    } catch (error) {
        console.error('❌ Error saving test result to Firestore:', error);
        throw error; // Re-throw to handle in calling function
    }
}

// FIXED: Submit test - only Firestore, no localStorage
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
        
        // FIXED: Save ONLY to Firestore (no localStorage fallback)
        let saveSuccessful = false;
        try {
            await saveTestResultToFirestore(score, correctAnswers);
            saveSuccessful = true;
        } catch (firestoreError) {
            console.error('Firestore save failed:', firestoreError);
            // Show error to user but continue with results
        }
        
        // Generate performance message
        let message = "";
        if (score >= 90) message = "Excellent! You're a master of this subject!";
        else if (score >= 80) message = "Great job! You have a strong understanding.";
        else if (score >= 70) message = "Good work! Keep practicing to improve.";
        else if (score >= 60) message = "Not bad! Review the topics you missed.";
        else message = "Keep practicing! You'll improve with more study.";
        
        // Add save status to message
        if (!saveSuccessful) {
            message += " (Could not save results to server)";
        }
        
        // Show results
        showResults(score, correctAnswers, message);
        
    } catch (error) {
        console.error('Error in submitTest:', error);
        
        // Even on error, show results with calculated score
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
                
                showResults(score, correctAnswers, "Test completed (results not saved to server)");
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
    
    // Clean up sessionStorage
    try {
        sessionStorage.removeItem('currentTest');
        sessionStorage.setItem('previousTest', JSON.stringify({
            ...testData,
            finalScore: score,
            correctAnswers: correctAnswers,
            completedAt: new Date().toISOString()
        }));
    } catch (e) {
        console.warn('Could not update sessionStorage:', e);
    }
}

// =============================================
// REST OF FUNCTIONS (UNCHANGED)
// =============================================

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
    
    questionContent.innerHTML = '';
    
    const hasQuestionText = question.questionText && question.questionText.trim() !== '';
    const hasQuestionImage = question.questionImage;
    
    let questionHTML = '';
    
    if (hasQuestionText && hasQuestionImage) {
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
        questionHTML = `
            <div class="question-text-content">
                ${formatTextForDisplay(question.questionText)}
            </div>
        `;
    } else if (hasQuestionImage) {
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

function updateActiveDot(index) {
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === index) {
            dot.classList.add('active');
        }
    });
}

function updateAnsweredDot(index) {
    const dot = document.querySelector(`.dot[data-index="${index}"]`);
    if (dot) {
        dot.classList.add('answered');
    }
}

function updateProgressBar() {
    if (!testData || !testData.questions) return;
    
    const progress = ((currentQuestionIndex + 1) / testData.questions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

function updateAnsweredCount() {
    if (!testData || !testData.userAnswers) return;
    
    const answered = testData.userAnswers.filter(answer => answer !== null).length;
    answeredCount.textContent = answered;
}

function showPreviousQuestion() {
    if (currentQuestionIndex > 0) {
        loadQuestion(currentQuestionIndex - 1);
    }
}

function showNextQuestion() {
    if (currentQuestionIndex < testData.questions.length - 1) {
        loadQuestion(currentQuestionIndex + 1);
    }
}

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

function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function showSubmitModal() {
    updateAnsweredCount();
    submitModal.style.display = 'flex';
}

function hideSubmitModal() {
    submitModal.style.display = 'none';
}

function autoSubmitTest() {
    getResultBtn.classList.add('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Time\'s Up! Submitting...';
    
    setTimeout(() => {
        submitTest();
    }, 1000);
}

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

function formatTextForDisplay(text) {
    if (!text) return "";
    
    const encodedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    const formatted = encodedText.replace(/\n/g, '<br>');
    return formatted;
}

function goToDashboard() {
    window.location.href = 'dashboard.html';
}

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
