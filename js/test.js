// js/test.js - Test Page with Firestore Integration
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

// Test data
let testData = null;
let timeRemaining = 0;
let timerInterval = null;
let currentQuestionIndex = 0;
let currentUser = null;

// Initialize test page
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentYear').textContent = new Date().getFullYear();
    
    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = 'index.html';
        } else {
            currentUser = user;
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
    
    document.addEventListener('keydown', handleKeyboardNavigation);
});

// =============================================
// LOAD TEST DATA
// =============================================
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
        
        initializeTest();
    } catch (error) {
        console.error('Error loading test data:', error);
        alert('Error loading test. Please try again.');
        window.location.href = 'dashboard.html';
    }
}

// =============================================
// INITIALIZE TEST
// =============================================
function initializeTest() {
    if (!testData || !testData.questions) {
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

// =============================================
// LOAD QUESTION
// =============================================
function loadQuestion(index) {
    if (!testData || !testData.questions || index < 0 || index >= testData.questions.length) {
        return;
    }
    
    currentQuestionIndex = index;
    const question = testData.questions[index];
    
    if (!question) return;
    
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
                <img src="${question.questionImage}" alt="Question image" class="question-image">
            </div>
        `;
    } else if (hasQuestionText) {
        questionHTML = `<div class="question-text-content">${formatTextForDisplay(question.questionText)}</div>`;
    } else if (hasQuestionImage) {
        questionHTML = `
            <div class="question-image-container">
                <img src="${question.questionImage}" alt="Question image" class="question-image">
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

// =============================================
// SELECT OPTION
// =============================================
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

// =============================================
// QUESTION DOTS
// =============================================
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
        dot.addEventListener('click', () => loadQuestion(i));
        questionDots.appendChild(dot);
    }
}

function updateActiveDot(index) {
    document.querySelectorAll('.dot').forEach((dot, i) => {
        dot.classList.remove('active');
        if (i === index) dot.classList.add('active');
    });
}

function updateAnsweredDot(index) {
    const dot = document.querySelector(`.dot[data-index="${index}"]`);
    if (dot) dot.classList.add('answered');
}

// =============================================
// PROGRESS & NAVIGATION
// =============================================
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
    if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1);
}

function showNextQuestion() {
    if (currentQuestionIndex < testData.questions.length - 1) loadQuestion(currentQuestionIndex + 1);
}

// =============================================
// TIMER
// =============================================
function startTimer() {
    updateTimerDisplay();
    
    timerInterval = setInterval(() => {
        timeRemaining--;
        updateTimerDisplay();
        
        if (timeRemaining <= 300) timerElement.classList.add('warning');
        
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

// =============================================
// SUBMIT MODAL
// =============================================
function showSubmitModal() {
    updateAnsweredCount();
    submitModal.style.display = 'flex';
}

function hideSubmitModal() {
    submitModal.style.display = 'none';
}

function autoSubmitTest() {
    getResultBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Time\'s Up! Submitting...';
    setTimeout(() => submitTest(), 1000);
}

// =============================================
// SAVE TEST RESULT TO FIRESTORE
// MATCHES YOUR EXACT DATA STRUCTURE
// =============================================
async function saveTestResultToFirestore(score, correctAnswers) {
    try {
        if (!currentUser) {
            throw new Error("User not authenticated");
        }
        
        const subjectName = testData.subject ? 
            testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 
            'Unknown Subject';
        
        // Get user's display name
        let userName = currentUser.displayName || '';
        if (!userName && currentUser.email) {
            userName = currentUser.email.split('@')[0];
        }
        if (!userName) {
            userName = 'Anonymous';
        }
        
        // Create questions array EXACTLY as in your example
        const questionsData = testData.questions.map((q, index) => ({
            id: q.id || `q-${index}`,
            questionText: q.questionText || "",
            hasQuestionImage: !!q.questionImage,
            correctAnswer: q.correctAnswer || "",
            userAnswer: testData.userAnswers[index] || null
        }));
        
        // Create userAnswers array EXACTLY as in your example
        const userAnswersArray = testData.userAnswers.map(answer => answer || null);
        
        // Create result data object MATCHING YOUR EXACT STRUCTURE
        const resultData = {
            completedAt: serverTimestamp(),
            correctAnswers: correctAnswers,
            examType: testData.examType || "Practice",
            plan: testData.plan || 'free',
            questions: questionsData,
            score: score,
            subject: testData.subject || "general",
            subjectName: subjectName,
            testId: testData.testId || `test-${Date.now()}`,
            timeSpent: (testData.totalTime || (testData.questions.length * 120)) - timeRemaining,
            totalQuestions: testData.questions.length,
            userAnswers: userAnswersArray,
            userId: currentUser.uid,
            userName: userName
        };
        
        console.log("Saving test result to Firestore with EXACT structure:", resultData);
        
        // SAVE TO FIRESTORE - test_results collection
        const docRef = await addDoc(collection(db, "test_results"), resultData);
        
        console.log('✅ Test result saved to Firestore with ID:', docRef.id);
        
        // Show success message
        showToast('✅ Test result saved successfully!', 'success');
        
        // =============================================
        // INCREMENT TEST COUNTS AFTER SUCCESSFUL SAVE
        // This ensures count only increments when test is actually saved
        // =============================================
        if (testData.plan === 'free') {
            await incrementTestCounts();
        }
        
        return docRef.id;
        
    } catch (error) {
        console.error('❌ ERROR SAVING TO FIRESTORE:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        showToast(`❌ Failed to save test result: ${error.message || 'Unknown error'}`, 'error');
        throw error;
    }
}

// =============================================
// INCREMENT TEST COUNTS IN FIRESTORE
// Called ONLY after successful test save
// =============================================
async function incrementTestCounts() {
    try {
        if (!currentUser) {
            console.error("No user logged in");
            return;
        }
        
        const userRef = doc(db, "users", currentUser.uid);
        
        console.log("Incrementing test counts for user:", currentUser.uid);
        
        // Increment both weekly and total counts
        await updateDoc(userRef, {
            testsTakenThisWeek: increment(1),
            totalTestsTaken: increment(1),
            lastActivity: serverTimestamp()
        });
        
        console.log("✅ Test counts incremented successfully");
        console.log(`testsTakenThisWeek +1, totalTestsTaken +1`);
        
    } catch (error) {
        console.error("❌ Error incrementing test counts:", error);
        console.error("Error code:", error.code);
        console.error("Error message:", error.message);
        
        // Don't throw - we don't want to prevent showing results if this fails
        showToast('⚠️ Test saved but failed to update test count. Contact support.', 'warning');
    }
}

// =============================================
// TOAST NOTIFICATION
// =============================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    
    let bgColor = '#4CAF50';
    if (type === 'error') bgColor = '#f44336';
    if (type === 'warning') bgColor = '#ff9800';
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 15px 20px;
        border-radius: 8px;
        z-index: 9999;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        font-size: 14px;
        animation: slideIn 0.3s ease-out;
        max-width: 300px;
    `;
    
    let icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';
    
    toast.innerHTML = `${icon} ${message}`;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.5s';
        setTimeout(() => document.body.removeChild(toast), 500);
    }, 5000);
}

// =============================================
// SUBMIT TEST
// =============================================
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
        
        console.log(`Score calculated: ${score}% (${correctAnswers}/${testData.questions.length})`);
        
        // === SAVE TO FIRESTORE - MUST SUCCEED ===
        await saveTestResultToFirestore(score, correctAnswers);
        
        // Generate performance message
        let message = "";
        if (score >= 90) message = "Excellent! You're a master of this subject!";
        else if (score >= 80) message = "Great job! You have a strong understanding.";
        else if (score >= 70) message = "Good work! Keep practicing to improve.";
        else if (score >= 60) message = "Not bad! Review the topics you missed.";
        else message = "Keep practicing! You'll improve with more study.";
        
        // Show results
        showResults(score, correctAnswers, message);
        
    } catch (error) {
        console.error('Error in submitTest:', error);
        
        getResultBtn.classList.remove('btn-loading');
        getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';
        
        alert(`❌ Error submitting test: ${error.message || 'Please try again.'}`);
    }
}

// =============================================
// SHOW RESULTS
// =============================================
function showResults(score, correctAnswers, message) {
    getResultBtn.classList.remove('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';
    
    finalScore.textContent = score;
    correctCount.textContent = correctAnswers;
    totalQuestionsCount.textContent = testData.questions.length;
    performanceMessage.textContent = message;
    
    resultsModal.style.display = 'flex';
    addSolutionButton();
    
    // Clear current test from sessionStorage
    sessionStorage.removeItem('currentTest');
    
    // Store in sessionStorage for reference
    try {
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

// =============================================
// SOLUTION BUTTON
// =============================================
function addSolutionButton() {
    const premiumNotification = document.getElementById('premiumNotification');
    if (premiumNotification) {
        premiumNotification.style.display = 'block';
    }
    
    const isPremium = testData && testData.plan === 'paid';
    
    const modalButtons = document.querySelector('#resultsModal .modal-buttons');
    if (!modalButtons) return;
    
    const existingBtn = document.getElementById('solutionBtn');
    if (existingBtn) existingBtn.remove();
    
    const solutionBtn = document.createElement('button');
    solutionBtn.id = 'solutionBtn';
    solutionBtn.className = 'modal-btn';
    solutionBtn.innerHTML = '<i class="fas fa-lightbulb"></i> View Detailed Solutions';
    
    if (isPremium) {
        solutionBtn.style.backgroundColor = '#17a2b8';
        solutionBtn.style.cursor = 'pointer';
        solutionBtn.addEventListener('click', () => {
            resultsModal.style.display = 'none';
            showSolutionsModal(testData.questions, testData.userAnswers);
        });
    } else {
        solutionBtn.style.backgroundColor = '#6c757d';
        solutionBtn.style.opacity = '0.7';
        solutionBtn.style.cursor = 'not-allowed';
        solutionBtn.addEventListener('click', () => {
            alert('Upgrade to Premium to access detailed solutions!');
        });
    }
    
    const backToDashboardBtn = document.getElementById('backToDashboard');
    if (backToDashboardBtn) {
        modalButtons.insertBefore(solutionBtn, backToDashboardBtn);
    } else {
        modalButtons.appendChild(solutionBtn);
    }
}

// =============================================
// SOLUTIONS MODAL
// =============================================
function showSolutionsModal(questions, userAnswers) {
    const modal = document.getElementById('solutionModal');
    const modalBody = document.getElementById('solutionModalBody');
    
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = '';
    const solutionsContainer = document.createElement('div');
    solutionsContainer.className = 'solutions-container';
    
    questions.forEach((question, index) => {
        const solutionItem = document.createElement('div');
        solutionItem.className = 'solution-item';
        
        const userAnswer = userAnswers[index];
        const correctAnswer = question.correctAnswer;
        const isCorrect = userAnswer === correctAnswer;
        
        const hasSolutionText = question.solution && question.solution.trim() !== '';
        const hasSolutionImage = question.solutionImage;
        
        let solutionContent = '';
        
        if (hasSolutionText && hasSolutionImage) {
            solutionContent = `
                <div class="solution-text-preserved">${processSolutionText(question.solution)}</div>
                <div class="solution-image-container">
                    <img src="${question.solutionImage}" alt="Solution image" class="solution-image">
                </div>
            `;
        } else if (hasSolutionText) {
            solutionContent = `<div class="solution-text-preserved">${processSolutionText(question.solution)}</div>`;
        } else if (hasSolutionImage) {
            solutionContent = `
                <div class="solution-image-container">
                    <img src="${question.solutionImage}" alt="Solution image" class="solution-image">
                </div>
            `;
        } else {
            solutionContent = '<div class="solution-text-preserved">No detailed solution available for this question.</div>';
        }
        
        let questionContent = '';
        const hasQuestionText = question.questionText && question.questionText.trim() !== '';
        const hasQuestionImage = question.questionImage;
        
        if (hasQuestionText && hasQuestionImage) {
            questionContent = `
                <p><strong>Question:</strong> ${formatTextForDisplay(question.questionText)}</p>
                <div class="question-image-container" style="margin: 10px 0;">
                    <img src="${question.questionImage}" alt="Question image" style="max-width: 200px; max-height: 150px;">
                </div>
            `;
        } else if (hasQuestionText) {
            questionContent = `<p><strong>Question:</strong> ${formatTextForDisplay(question.questionText)}</p>`;
        } else if (hasQuestionImage) {
            questionContent = `
                <div class="question-image-container" style="margin: 10px 0;">
                    <img src="${question.questionImage}" alt="Question image" style="max-width: 200px; max-height: 150px;">
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
    backButton.style.backgroundColor = '#28a745';
    backButton.addEventListener('click', goToDashboard);
    
    backButtonContainer.appendChild(backButton);
    modalBody.appendChild(backButtonContainer);
    
    modal.style.display = 'flex';
    
    const closeBtn = document.getElementById('closeSolutionModal');
    if (closeBtn) {
        closeBtn.onclick = () => modal.style.display = 'none';
    }
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.style.display = 'none';
    };
}

// =============================================
// TEXT FORMATTING
// =============================================
function processSolutionText(text) {
    if (!text) return '';
    
    let processedText = text;
    processedText = processedText.replace(/\^(\d+)/g, '<sup>$1</sup>');
    processedText = processedText.replace(/_(\d+)/g, '<sub>$1</sub>');
    processedText = processedText.replace(/([A-Z][a-z]?)(\d+)/g, function(match, element, number) {
        return element + '<sub>' + number + '</sub>';
    });
    processedText = processedText.replace(/\n/g, '<br>');
    
    return processedText;
}

function formatTextForDisplay(text) {
    if (!text) return "";
    
    const encodedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    return encodedText.replace(/\n/g, '<br>');
}

// =============================================
// NAVIGATION
// =============================================
function goToDashboard() {
    window.location.href = 'dashboard.html';
}

// =============================================
// KEYBOARD NAVIGATION
// =============================================
function handleKeyboardNavigation(e) {
    if (submitModal.style.display === 'flex' || resultsModal.style.display === 'flex') {
        if (e.key === 'Escape') {
            hideSubmitModal();
            resultsModal.style.display = 'none';
        }
        return;
    }
    
    switch(e.key) {
        case '1': case 'A': case 'a': selectOption('A'); break;
        case '2': case 'B': case 'b': selectOption('B'); break;
        case '3': case 'C': case 'c': selectOption('C'); break;
        case '4': case 'D': case 'd': selectOption('D'); break;
        case 'ArrowLeft': if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1); break;
        case 'ArrowRight': if (currentQuestionIndex < testData.questions.length - 1) loadQuestion(currentQuestionIndex + 1); break;
        case 'Enter': 
            if (currentQuestionIndex < testData.questions.length - 1) {
                loadQuestion(currentQuestionIndex + 1);
            } else {
                showSubmitModal();
            }
            break;
        case 'Escape': showSubmitModal(); break;
    }
}