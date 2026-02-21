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
const scoreLabel = document.getElementById('scoreLabel');
const correctCount = document.getElementById('correctCount');
const totalQuestionsCount = document.getElementById('totalQuestionsCount');
const performanceMessage = document.getElementById('performanceMessage');
const backToDashboard = document.getElementById('backToDashboard');
const subjectTabs = document.getElementById('subjectTabs');
const subjectBreakdown = document.getElementById('subjectBreakdown');
const subjectBreakdownList = document.getElementById('subjectBreakdownList');

// Test data
let testData = null;
let timeRemaining = 0;
let timerInterval = null;
let currentQuestionIndex = 0;
let currentUser = null;

// JAMB Drill specific
let subjectStartIndices = {}; // subject -> first question index
let subjectCounts = {}; // subject -> number of questions

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
    
    // Display subject(s) in header
    if (testData.mode === 'jamb_drill') {
        const subjectsList = testData.subjects.map(s => s.name).join(' + ');
        testSubject.innerHTML = `<i class="fas fa-graduation-cap"></i> JAMB Drill: ${subjectsList}`;
        // Build subject index mapping
        let idx = 0;
        testData.subjects.forEach(subj => {
            subjectStartIndices[subj.value] = idx;
            const count = subj.count;
            subjectCounts[subj.value] = count;
            idx += count;
        });
        // Show subject tabs
        renderSubjectTabs();
    } else {
        const subjectName = testData.subject ? 
            testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 
            'Unknown Subject';
        testSubject.innerHTML = `<i class="fas fa-book"></i> Quick Test: ${subjectName} - ${testData.examType || 'Test'}`;
    }
    
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

function renderSubjectTabs() {
    if (!subjectTabs || testData.mode !== 'jamb_drill') return;
    subjectTabs.style.display = 'block';
    subjectTabs.innerHTML = '';
    
    testData.subjects.forEach((subj, i) => {
        const tab = document.createElement('button');
        tab.className = 'subject-tab';
        tab.dataset.subject = subj.value;
        tab.textContent = subj.name;
        tab.addEventListener('click', () => switchToSubject(subj.value));
        subjectTabs.appendChild(tab);
    });
    
    // Style the tabs
    document.querySelectorAll('.subject-tab').forEach((tab, index) => {
        tab.style.padding = '10px 20px';
        tab.style.marginRight = '5px';
        tab.style.border = 'none';
        tab.style.borderRadius = '20px';
        tab.style.background = '#e0e0e0';
        tab.style.cursor = 'pointer';
        tab.style.fontSize = '14px';
        tab.style.fontWeight = '500';
        tab.style.transition = 'all 0.3s';
    });
    highlightActiveSubjectTab(testData.questions[0]?.subject);
}

function highlightActiveSubjectTab(subject) {
    document.querySelectorAll('.subject-tab').forEach(tab => {
        if (tab.dataset.subject === subject) {
            tab.style.background = 'var(--eggplant)';
            tab.style.color = 'white';
        } else {
            tab.style.background = '#e0e0e0';
            tab.style.color = '#333';
        }
    });
}

function switchToSubject(subject) {
    if (subjectStartIndices[subject] !== undefined) {
        loadQuestion(subjectStartIndices[subject]);
        highlightActiveSubjectTab(subject);
    }
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
    
    // Highlight subject tab if in JAMB Drill
    if (testData.mode === 'jamb_drill' && question.subject) {
        highlightActiveSubjectTab(question.subject);
    }
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
// =============================================
async function saveTestResultToFirestore(score, correctAnswers, rawScore, subjectScores = null) {
    try {
        if (!currentUser) {
            throw new Error("User not authenticated");
        }
        
        const subjectName = testData.mode === 'quick' 
            ? (testData.subject ? testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 'Unknown Subject')
            : 'JAMB Drill';
        
        // Get user's display name
        let userName = currentUser.displayName || '';
        if (!userName && currentUser.email) {
            userName = currentUser.email.split('@')[0];
        }
        if (!userName) {
            userName = 'Anonymous';
        }
        
        // Create questions array
        const questionsData = testData.questions.map((q, index) => ({
            id: q.id || `q-${index}`,
            questionText: q.questionText || "",
            hasQuestionImage: !!q.questionImage,
            correctAnswer: q.correctAnswer || "",
            userAnswer: testData.userAnswers[index] || null,
            subject: q.subject || testData.subject // for jamb drill, each question has subject
        }));
        
        // Create userAnswers array
        const userAnswersArray = testData.userAnswers.map(answer => answer || null);
        
        // Build result data
        const resultData = {
            completedAt: serverTimestamp(),
            correctAnswers: correctAnswers,
            rawScore: rawScore, // number correct
            examType: testData.examType || "Practice",
            mode: testData.mode || 'quick',
            plan: testData.plan || 'free',
            questions: questionsData,
            score: score, // final displayed score (percentage or /400)
            subject: testData.subject || "general",
            subjectName: subjectName,
            testId: testData.testId || `test-${Date.now()}`,
            timeSpent: (testData.totalTime || (testData.questions.length * 120)) - timeRemaining,
            totalQuestions: testData.questions.length,
            userAnswers: userAnswersArray,
            userId: currentUser.uid,
            userName: userName
        };
        
        // For JAMB Drill, store subjects array and subject scores
        if (testData.mode === 'jamb_drill') {
            resultData.subjects = testData.subjects;
            resultData.subjectScores = subjectScores;
        }
        
        console.log("Saving test result to Firestore:", resultData);
        
        const docRef = await addDoc(collection(db, "test_results"), resultData);
        
        console.log('✅ Test result saved to Firestore with ID:', docRef.id);
        
        showToast('✅ Test result saved successfully!', 'success');
        
        // Increment test counts for free plan only (Quick Test)
        if (testData.plan === 'free' && testData.mode !== 'jamb_drill') {
            await incrementTestCounts();
        }
        
        return docRef.id;
        
    } catch (error) {
        console.error('❌ ERROR SAVING TO FIRESTORE:', error);
        showToast(`❌ Failed to save test result: ${error.message || 'Unknown error'}`, 'error');
        throw error;
    }
}

// =============================================
// INCREMENT TEST COUNTS (only for free quick tests)
// =============================================
async function incrementTestCounts() {
    try {
        if (!currentUser) {
            console.error("No user logged in");
            return;
        }
        
        const userRef = doc(db, "users", currentUser.uid);
        
        console.log("Incrementing test counts for user:", currentUser.uid);
        
        await updateDoc(userRef, {
            testsTakenThisWeek: increment(1),
            totalTestsTaken: increment(1),
            lastActivity: serverTimestamp()
        });
        
        console.log("✅ Test counts incremented successfully");
        
    } catch (error) {
        console.error("❌ Error incrementing test counts:", error);
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
        // Calculate raw score
        let correctAnswers = 0;
        testData.questions.forEach((question, index) => {
            const userAnswer = testData.userAnswers[index];
            const correctAnswer = question.correctAnswer;
            
            if (userAnswer === correctAnswer) {
                correctAnswers++;
            }
        });
        
        let finalDisplayScore;
        let rawScore = correctAnswers;
        let subjectScores = null;
        
        if (testData.mode === 'jamb_drill') {
            // Calculate per-subject scores
            subjectScores = {};
            testData.subjects.forEach(subj => {
                subjectScores[subj.value] = { correct: 0, total: subj.count };
            });
            
            testData.questions.forEach((question, index) => {
                const userAnswer = testData.userAnswers[index];
                const correctAnswer = question.correctAnswer;
                if (userAnswer === correctAnswer) {
                    const subj = question.subject;
                    if (subj && subjectScores[subj]) {
                        subjectScores[subj].correct++;
                    }
                }
            });
            
            // Scale to 400
            const totalQuestions = testData.totalQuestions; // 180
            finalDisplayScore = Math.round((correctAnswers / totalQuestions) * 400);
            scoreLabel.textContent = '/400 Score';
        } else {
            // Quick Test: percentage
            finalDisplayScore = Math.round((correctAnswers / testData.questions.length) * 100);
            scoreLabel.textContent = '% Score';
        }
        
        console.log(`Score calculated: ${finalDisplayScore} (${correctAnswers}/${testData.questions.length})`);
        
        // Save to Firestore
        await saveTestResultToFirestore(finalDisplayScore, correctAnswers, correctAnswers, subjectScores);
        
        // Generate performance message
        let message = "";
        if (testData.mode === 'jamb_drill') {
            const percent = (correctAnswers / testData.questions.length) * 100;
            if (percent >= 90) message = "Excellent! You're on track for a great JAMB score!";
            else if (percent >= 80) message = "Very good! Keep practicing.";
            else if (percent >= 70) message = "Good effort. Review your weak areas.";
            else message = "Keep practicing. You'll improve!";
        } else {
            if (finalDisplayScore >= 90) message = "Excellent! You're a master of this subject!";
            else if (finalDisplayScore >= 80) message = "Great job! You have a strong understanding.";
            else if (finalDisplayScore >= 70) message = "Good work! Keep practicing to improve.";
            else if (finalDisplayScore >= 60) message = "Not bad! Review the topics you missed.";
            else message = "Keep practicing! You'll improve with more study.";
        }
        
        // Show results
        showResults(finalDisplayScore, correctAnswers, message, subjectScores);
        
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
function showResults(score, correctAnswers, message, subjectScores = null) {
    getResultBtn.classList.remove('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';
    
    finalScore.textContent = score;
    correctCount.textContent = correctAnswers;
    totalQuestionsCount.textContent = testData.questions.length;
    performanceMessage.textContent = message;
    
    // Show subject breakdown for JAMB Drill
    if (testData.mode === 'jamb_drill' && subjectScores) {
        subjectBreakdown.style.display = 'block';
        let html = '';
        testData.subjects.forEach(subj => {
            const data = subjectScores[subj.value] || { correct: 0, total: subj.count };
            html += `<div style="margin: 5px 0;"><strong>${subj.name}:</strong> ${data.correct}/${data.total}</div>`;
        });
        subjectBreakdownList.innerHTML = html;
    } else {
        subjectBreakdown.style.display = 'none';
    }
    
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
// SOLUTION BUTTON - MODIFIED to allow both 'paid' and 'unlimited'
// =============================================
function addSolutionButton() {
    const premiumNotification = document.getElementById('premiumNotification');
    if (premiumNotification) {
        premiumNotification.style.display = 'block';
    }
    
    // Allow access if plan is 'paid' OR 'unlimited'
    const hasAccess = testData && (testData.plan === 'paid' || testData.plan === 'unlimited');
    
    const modalButtons = document.querySelector('#resultsModal .modal-buttons');
    if (!modalButtons) return;
    
    const existingBtn = document.getElementById('solutionBtn');
    if (existingBtn) existingBtn.remove();
    
    const solutionBtn = document.createElement('button');
    solutionBtn.id = 'solutionBtn';
    solutionBtn.className = 'modal-btn';
    solutionBtn.innerHTML = '<i class="fas fa-lightbulb"></i> View Detailed Solutions';
    
    if (hasAccess) {
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
            alert('Upgrade to Premium or Unlimited to access detailed solutions!');
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
// SOLUTIONS MODAL (enhanced to group by subject)
// =============================================
function showSolutionsModal(questions, userAnswers) {
    const modal = document.getElementById('solutionModal');
    const modalBody = document.getElementById('solutionModalBody');
    
    if (!modal || !modalBody) return;
    
    modalBody.innerHTML = '';
    const solutionsContainer = document.createElement('div');
    solutionsContainer.className = 'solutions-container';
    
    // If JAMB Drill, group by subject
    if (testData.mode === 'jamb_drill') {
        const subjects = testData.subjects;
        subjects.forEach(subj => {
            const subjectHeader = document.createElement('h3');
            subjectHeader.style.color = 'var(--eggplant)';
            subjectHeader.style.margin = '20px 0 10px';
            subjectHeader.innerHTML = `<i class="fas fa-book"></i> ${subj.name}`;
            solutionsContainer.appendChild(subjectHeader);
            
            // Filter questions for this subject
            const subjectQuestions = questions.filter((q, idx) => q.subject === subj.value);
            subjectQuestions.forEach((question, idxInSubj) => {
                // Find global index (if needed, but we can just iterate)
                // For simplicity, we'll just pass the question and its answer
                const globalIndex = questions.findIndex(q => q.id === question.id);
                const userAnswer = userAnswers[globalIndex];
                const solutionItem = createSolutionItem(question, userAnswer, globalIndex + 1);
                solutionsContainer.appendChild(solutionItem);
            });
        });
    } else {
        // Quick Test: just list all
        questions.forEach((question, index) => {
            const solutionItem = createSolutionItem(question, userAnswers[index], index + 1);
            solutionsContainer.appendChild(solutionItem);
        });
    }
    
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

function createSolutionItem(question, userAnswer, displayNumber) {
    const solutionItem = document.createElement('div');
    solutionItem.className = 'solution-item';
    
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
        <h4><i class="fas fa-question-circle"></i> Question ${displayNumber}</h4>
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
    
    return solutionItem;
}

// =============================================
// TEXT FORMATTING (unchanged)
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
// KEYBOARD NAVIGATION (unchanged)
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