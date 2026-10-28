// js/test.js - Test Page with Firestore Integration (No subscription limits)
import { auth, db } from "./main.js";
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    increment,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// =============================================
// WEAKNESS DETECTION & RECOMMENDATION ENGINE
// =============================================

function getTopicFromQuestion(question) {
    if (question.topic && typeof question.topic === 'string' && question.topic.trim() !== '') {
        return question.topic.trim();
    }
    const possibleFields = ['topicName', 'category', 'subjectTopic'];
    for (const field of possibleFields) {
        if (question[field] && typeof question[field] === 'string' && question[field].trim() !== '') {
            return question[field].trim();
        }
    }
    return 'General';
}

function generateWeaknessReport(userAnswers, questions) {
  const topicMap = new Map();

  questions.forEach((q, index) => {
    const answer = userAnswers[index];
    if (answer === null) return;

    const subject = q.subject || 'General';
    const topic = getTopicFromQuestion(q);
    const key = `${subject}|${topic}`;
    const isCorrect = (answer === q.correctAnswer);

    if (!topicMap.has(key)) {
      topicMap.set(key, { subject, topic, total: 0, correct: 0 });
    }
    const record = topicMap.get(key);
    record.total += 1;
    if (isCorrect) record.correct += 1;
  });

  const topics = Array.from(topicMap.values()).map(record => {
    const accuracy = Math.round((record.correct / record.total) * 100);
    let level = 'Weak';
    if (accuracy >= 70) level = 'Strong';
    else if (accuracy >= 50) level = 'Average';
    return { ...record, accuracy, level };
  });

  const subjectGroups = {};
  topics.forEach(t => {
    if (!subjectGroups[t.subject]) subjectGroups[t.subject] = [];
    subjectGroups[t.subject].push(t);
  });

  return Object.entries(subjectGroups).map(([subject, topicList]) => ({
    subject,
    topics: topicList,
  }));
}

async function saveTopicStats(userId, topicStats) {
  if (!userId || !topicStats || topicStats.length === 0) return;
  try {
    for (const subjectData of topicStats) {
      for (const topic of subjectData.topics) {
        const statData = {
          userId,
          subject: subjectData.subject,
          topic: topic.topic,
          total: topic.total,
          correct: topic.correct,
          accuracy: topic.accuracy,
          level: topic.level,
          timestamp: serverTimestamp(),
        };
        await addDoc(collection(db, "users", userId, "topicStats"), statData);
      }
    }
  } catch (error) {
    console.error("❌ Error saving topic stats:", error);
  }
}

async function updateCumulativeTopicStats(userId, topicStats) {
    if (!userId || !topicStats || topicStats.length === 0) return;
    try {
        for (const subjectData of topicStats) {
            for (const topic of subjectData.topics) {
                const sanitizedSubject = subjectData.subject.replace(/[^a-zA-Z0-9]/g, '_');
                const sanitizedTopic = topic.topic.replace(/[^a-zA-Z0-9]/g, '_');
                const docId = `${sanitizedSubject}_${sanitizedTopic}`;
                const docRef = doc(db, "users", userId, "topicCumulative", docId);

                const docSnap = await getDoc(docRef);
                let previousAccuracy = null;
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    const prevTotal = data.totalAnswered || 0;
                    const prevCorrect = data.totalCorrect || 0;
                    previousAccuracy = prevTotal > 0 ? Math.round((prevCorrect / prevTotal) * 100) : 0;
                }

                const updateData = {
                    subject: subjectData.subject,
                    topic: topic.topic,
                    totalAnswered: increment(topic.total),
                    totalCorrect: increment(topic.correct),
                    lastUpdated: serverTimestamp(),
                    lastPracticed: serverTimestamp()
                };

                if (previousAccuracy !== null) {
                    updateData.lastAccuracy = previousAccuracy;
                }

                await setDoc(docRef, updateData, { merge: true });
            }
        }
    } catch (error) {
        console.error("❌ Error updating cumulative topic stats:", error);
    }
}

async function fetchCumulativeTopicStats(userId) {
    if (!userId) return [];
    try {
        const colRef = collection(db, "users", userId, "topicCumulative");
        const snapshot = await getDocs(colRef);
        const stats = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            stats.push({
                subject: data.subject || 'General',
                topic: data.topic || 'Unknown',
                totalAnswered: data.totalAnswered || 0,
                totalCorrect: data.totalCorrect || 0,
                lastUpdated: data.lastUpdated,
                lastAccuracy: data.lastAccuracy,
                lastPracticed: data.lastPracticed
            });
        });
        return stats;
    } catch (error) {
        console.error("❌ Error fetching cumulative topic stats:", error);
        return [];
    }
}

function calculateCumulativeWeakness(cumulativeStats) {
    const topics = cumulativeStats.map(stat => {
        const totalAnswered = stat.totalAnswered || 0;
        const totalCorrect = stat.totalCorrect || 0;
        const accuracy = totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;
        let level = 'Weak';
        if (accuracy >= 70) level = 'Strong';
        else if (accuracy >= 50) level = 'Average';
        return {
            subject: stat.subject,
            topic: stat.topic,
            totalAnswered,
            totalCorrect,
            accuracy,
            level,
            lastAccuracy: stat.lastAccuracy,
            lastPracticed: stat.lastPracticed ? stat.lastPracticed.toDate() : null
        };
    });

    const reliableTopics = topics.filter(t => t.totalAnswered >= 5);
    const sortedAsc = [...reliableTopics].sort((a, b) => a.accuracy - b.accuracy);
    const sortedDesc = [...reliableTopics].sort((a, b) => b.accuracy - a.accuracy);

    const weakTopics = sortedAsc.filter(t => t.level === 'Weak').slice(0, 10);
    const strongTopics = sortedDesc.filter(t => t.level === 'Strong').slice(0, 2);

    return { weakTopics, strongTopics };
}

function generateSmartRecommendations(weakTopics) {
    if (!weakTopics || weakTopics.length === 0) {
        return ["Great job! Keep practicing to maintain your strengths."];
    }

    const groupedBySubject = new Map();
    weakTopics.forEach(topic => {
        if (!groupedBySubject.has(topic.subject)) {
            groupedBySubject.set(topic.subject, { subject: topic.subject, topics: [] });
        }
        groupedBySubject.get(topic.subject).topics.push(topic);
    });

    const templates = {
        critical: [
            "{topic} needs urgent attention. Start with simpler practice questions.",
            "{topic} is a critical weakness. Master the basics before attempting harder questions.",
            "Your performance in {topic} is very low. Focus on fundamental concepts."
        ],
        weak: [
            "Spend more time strengthening {topic}.",
            "{topic} requires consistent practice. Try 2–3 Quick Tests this week.",
            "Dedicate extra study sessions to {topic}."
        ],
        improving: [
            "You are improving in {topic}. Keep practicing to cross 50%.",
            "Good progress in {topic}! A few more drills and you'll master it.",
            "{topic} is getting better. Stay consistent!"
        ],
        declining: [
            "Your performance in {topic} is dropping. Revise fundamentals before another drill.",
            "{topic} needs a refresher. Review notes and retry questions.",
            "Don't let {topic} slip! Go back to the basics."
        ],
        timeBased: [
            "You haven't practiced {topic} recently. Attempt a Quick Test to refresh.",
            "It's been a while since you practiced {topic}. A short review will help.",
            "{topic} needs a quick refresher – try a few questions now."
        ],
        grouped: [
            "{subject} needs attention. Focus on {topics} this week.",
            "Your weak areas in {subject} are {topics}. Prioritize them.",
            "Strengthen {subject} by practicing {topics}."
        ]
    };

    function randomTemplate(arr) {
        return arr[Math.floor(Math.random() * arr.length)];
    }

    const candidates = [];

    groupedBySubject.forEach((group, subject) => {
        const topics = group.topics;
        if (topics.length >= 2) {
            const topicNames = topics.map(t => t.topic).join(', ');
            let template = randomTemplate(templates.grouped);
            candidates.push(template.replace('{subject}', subject).replace('{topics}', topicNames));
        } else {
            const topic = topics[0];
            const accuracy = topic.accuracy;
            const lastAccuracy = topic.lastAccuracy;
            const lastPracticed = topic.lastPracticed;

            let severity = accuracy < 35 ? 'critical' : 'weak';
            let trend = 'stable';
            if (lastAccuracy !== undefined && lastAccuracy !== null) {
                if (accuracy > lastAccuracy) trend = 'improving';
                else if (accuracy < lastAccuracy) trend = 'declining';
            }

            let pool;
            if (trend === 'improving') pool = templates.improving;
            else if (trend === 'declining') pool = templates.declining;
            else pool = templates[severity];

            let message = randomTemplate(pool).replace('{topic}', topic.topic);

            if (lastPracticed) {
                const daysAgo = (Date.now() - lastPracticed.getTime()) / (1000 * 60 * 60 * 24);
                if (daysAgo > 5) {
                    const timeHint = randomTemplate(templates.timeBased).replace('{topic}', topic.topic);
                    message += ' ' + timeHint;
                }
            }

            candidates.push(message);
        }
    });

    const shuffled = candidates.sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 3);
    if (selected.length === 0) {
        return ["Great job! Keep practicing to maintain your strengths."];
    }
    return selected;
}

// =============================================
// DOM Elements
// =============================================
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
const weakAreasModal = document.getElementById('weakAreasModal');
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

// New buttons
const viewSolutionBtn = document.getElementById('viewSolutionBtn');
const checkWeakAreasBtn = document.getElementById('checkWeakAreasBtn');
const closeWeakAreasModal = document.getElementById('closeWeakAreasModal');
const viewSolutionFromWeakAreas = document.getElementById('viewSolutionFromWeakAreas');
const backToDashboardFromWeakAreas = document.getElementById('backToDashboardFromWeakAreas');

// Test data
let testData = null;
let timeRemaining = 0;
let timerInterval = null;
let currentQuestionIndex = 0;
let currentUser = null;

// JAMB Drill specific
let subjectStartIndices = {};
let subjectCounts = {};

// Tracks which modal opened the solution modal so X can return there
let solutionOpenedFrom = null; // 'results' | 'weakAreas' | null

// Initialize test page
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('currentYear').textContent = new Date().getFullYear();

    onAuthStateChanged(auth, async (user) => {
        if (!user) {
            window.location.href = '../index.html';
        } else {
            currentUser = user;
            await loadTestData();
        }
    });

    // Core event listeners
    prevBtn.addEventListener('click', showPreviousQuestion);
    nextBtn.addEventListener('click', showNextQuestion);
    getResultBtn.addEventListener('click', showSubmitModal);
    cancelSubmit.addEventListener('click', hideSubmitModal);
    confirmSubmit.addEventListener('click', submitTest);
    backToDashboard.addEventListener('click', goToDashboard);

    // Results modal → other modals
    viewSolutionBtn.addEventListener('click', () => openSolutionFrom('results'));
    checkWeakAreasBtn.addEventListener('click', openWeakAreasModal);

    // Weak areas modal buttons
    closeWeakAreasModal.addEventListener('click', closeWeakAreasAndReturn);
    viewSolutionFromWeakAreas.addEventListener('click', () => openSolutionFrom('weakAreas'));
    backToDashboardFromWeakAreas.addEventListener('click', goToDashboard);

    document.addEventListener('keydown', handleKeyboardNavigation);
});

// =============================================
// HELPER: FIX EXCEL CONVERTED FRACTIONS
// =============================================
function fixExcelFraction(value) {
    if (typeof value !== "string") return value;

    const months = {
        Jan: "1", Feb: "2", Mar: "3", Apr: "4",
        May: "5", Jun: "6", Jul: "7", Aug: "8",
        Sep: "9", Oct: "10", Nov: "11", Dec: "12"
    };

    const match1 = value.match(/^(\d{1,2})-([A-Za-z]{3})$/);
    if (match1) {
        const day = parseInt(match1[1], 10);
        const monthAbbr = match1[2];
        if (months[monthAbbr]) return `${day}/${months[monthAbbr]}`;
    }

    const match2 = value.match(/^([A-Za-z]{3})-(\d{1,2})$/);
    if (match2) {
        const monthAbbr = match2[1];
        const day = parseInt(match2[2], 10);
        if (months[monthAbbr]) return `${months[monthAbbr]}/${day}`;
    }

    return value;
}

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

    if (testData.mode === 'jamb_drill') {
        const subjectsList = testData.subjects.map(s => s.name).join(' + ');
        testSubject.innerHTML = `<i class="fas fa-graduation-cap"></i> JAMB Drill: ${subjectsList}`;
        let idx = 0;
        testData.subjects.forEach(subj => {
            subjectStartIndices[subj.value] = idx;
            subjectCounts[subj.value] = subj.count;
            idx += subj.count;
        });
        renderSubjectTabs();
    } else if (testData.mode === 'waec_neco') {
        const subjectName = testData.subject ?
            testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) :
            'Unknown Subject';
        testSubject.innerHTML = `<i class="fas fa-school"></i> WAEC/NECO Drill: ${subjectName}`;
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

    testData.subjects.forEach((subj) => {
        const tab = document.createElement('button');
        tab.className = 'subject-tab';
        tab.dataset.subject = subj.value;
        tab.textContent = subj.name;
        tab.addEventListener('click', () => switchToSubject(subj.value));
        subjectTabs.appendChild(tab);
    });

    highlightActiveSubjectTab(testData.questions[0]?.subject);
}

function highlightActiveSubjectTab(subject) {
    document.querySelectorAll('.subject-tab').forEach(tab => {
        if (tab.dataset.subject === subject) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
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
            <div class="question-text-content">${formatTextForDisplay(question.questionText)}</div>
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

    const rawOptions = question.options || {
        A: question.optionA || "",
        B: question.optionB || "",
        C: question.optionC || "",
        D: question.optionD || ""
    };

    const options = {
        A: fixExcelFraction(rawOptions.A),
        B: fixExcelFraction(rawOptions.B),
        C: fixExcelFraction(rawOptions.C),
        D: fixExcelFraction(rawOptions.D)
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
    if (selectedOption) selectedOption.classList.add('selected');

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
        if (i === currentQuestionIndex) dot.classList.add('active');
        if (testData.userAnswers && testData.userAnswers[i] !== null) dot.classList.add('answered');
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
// SAVE TEST RESULT TO FIRESTORE (no plan field)
// =============================================
async function saveTestResultToFirestore(score, correctAnswers, rawScore, subjectScores = null) {
    try {
        if (!currentUser) throw new Error("User not authenticated");

        const subjectName = testData.mode === 'quick'
            ? (testData.subject ? testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1) : 'Unknown Subject')
            : testData.mode === 'jamb_drill' ? 'JAMB Drill' : 'WAEC/NECO Drill';

        let userName = currentUser.displayName || '';
        if (!userName && currentUser.email) userName = currentUser.email.split('@')[0];
        if (!userName) userName = 'Anonymous';

        const questionsData = testData.questions.map((q, index) => ({
            id: q.id || `q-${index}`,
            questionText: q.questionText || "",
            hasQuestionImage: !!q.questionImage,
            correctAnswer: q.correctAnswer || "",
            userAnswer: testData.userAnswers[index] || null,
            subject: q.subject || testData.subject
        }));

        const userAnswersArray = testData.userAnswers.map(answer => answer || null);

        const resultData = {
            completedAt: serverTimestamp(),
            correctAnswers: correctAnswers,
            rawScore: rawScore,
            examType: testData.examType || "Practice",
            mode: testData.mode || 'quick',
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

        if (testData.mode === 'jamb_drill') {
            resultData.subjects = testData.subjects;
            resultData.subjectScores = subjectScores;
            resultData.totalRawScore = rawScore;
            resultData.totalPossible = testData.totalQuestions;
        } else if (testData.mode === 'waec_neco' && subjectScores) {
            resultData.subjectScores = subjectScores;
            resultData.subject = testData.subject;
            resultData.totalRawScore = rawScore;
            resultData.totalPossible = testData.totalQuestions;
        }

        const docRef = await addDoc(collection(db, "test_results"), resultData);
        showToast('✅ Test result saved successfully!', 'success');
        return docRef.id;

    } catch (error) {
        console.error('❌ ERROR SAVING TO FIRESTORE:', error);
        showToast(`❌ Failed to save test result: ${error.message || 'Unknown error'}`, 'error');
        throw error;
    }
}

// =============================================
// TOAST NOTIFICATION
// =============================================
function showToast(message, type = 'success') {
    const toast = document.createElement('div');

    let bgColor = 'linear-gradient(135deg, #30d158, #4ddc75)';
    if (type === 'error') bgColor = 'linear-gradient(135deg, #ff453a, #ff375f)';
    if (type === 'warning') bgColor = 'linear-gradient(135deg, #ff9f0a, #ffd60a)';

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 14px 20px;
        border-radius: 100px;
        z-index: 9999;
        box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        font-size: 14px;
        font-weight: 600;
        font-family: -apple-system, BlinkMacSystemFont, 'Poppins', sans-serif;
        animation: slideIn 0.3s ease-out;
        max-width: 320px;
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
    }, 4000);
}

// =============================================
// SUBMIT TEST
// =============================================
async function submitTest() {
    hideSubmitModal();
    if (timerInterval) clearInterval(timerInterval);

    getResultBtn.classList.add('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Calculating Score...';

    try {
        let correctAnswers = 0;
        testData.questions.forEach((question, index) => {
            const userAnswer = testData.userAnswers[index];
            if (userAnswer === question.correctAnswer) correctAnswers++;
        });

        let finalDisplayScore;
        let rawScore = correctAnswers;
        let subjectScores = null;

        if (testData.mode === 'jamb_drill') {
            subjectScores = {};
            testData.subjects.forEach(subj => {
                subjectScores[subj.value] = { correct: 0, total: subj.count };
            });

            testData.questions.forEach((question, index) => {
                if (testData.userAnswers[index] === question.correctAnswer) {
                    const subj = question.subject;
                    if (subj && subjectScores[subj]) subjectScores[subj].correct++;
                }
            });

            finalDisplayScore = Math.round((correctAnswers / testData.totalQuestions) * 400);
            scoreLabel.textContent = '/400 Score';
        } else if (testData.mode === 'waec_neco') {
            subjectScores = {};
            subjectScores[testData.subject] = { correct: correctAnswers, total: testData.totalQuestions };
            finalDisplayScore = Math.round((correctAnswers / testData.questions.length) * 100);
            scoreLabel.textContent = '% Score';
        } else {
            finalDisplayScore = Math.round((correctAnswers / testData.questions.length) * 100);
            scoreLabel.textContent = '% Score';
        }

        // Weakness Detection & Recommendations
        const topicStats = generateWeaknessReport(testData.userAnswers, testData.questions);

        if (topicStats.length > 0) {
            saveTopicStats(currentUser.uid, topicStats).catch(err =>
                console.warn('Topic stats save failed (non-critical):', err)
            );
            await updateCumulativeTopicStats(currentUser.uid, topicStats);

            const cumulativeStats = await fetchCumulativeTopicStats(currentUser.uid);

            let filteredCumulativeStats = cumulativeStats;
            if (testData.mode === 'quick' || testData.mode === 'waec_neco') {
                filteredCumulativeStats = cumulativeStats.filter(stat => stat.subject === testData.subject);
            } else if (testData.mode === 'jamb_drill') {
                const subjectValues = testData.subjects.map(s => s.value);
                filteredCumulativeStats = cumulativeStats.filter(stat => subjectValues.includes(stat.subject));
            }

            const { weakTopics, strongTopics } = calculateCumulativeWeakness(filteredCumulativeStats);
            const recommendations = generateSmartRecommendations(weakTopics);

            testData.weakTopics = weakTopics;
            testData.strongTopics = strongTopics;
            testData.recommendations = recommendations;
        } else {
            testData.recommendations = [];
        }

        await saveTestResultToFirestore(finalDisplayScore, correctAnswers, correctAnswers, subjectScores);

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

        showResults(finalDisplayScore, correctAnswers, message, subjectScores);

    } catch (error) {
        console.error('Error in submitTest:', error);
        getResultBtn.classList.remove('btn-loading');
        getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';
        alert(`❌ Error submitting test: ${error.message || 'Please try again.'}`);
    }
}

// =============================================
// SHOW RESULTS (populates both modals, shows results modal)
// =============================================
function showResults(score, correctAnswers, message, subjectScores = null) {
    getResultBtn.classList.remove('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';

    // === Populate results (score) modal ===
    finalScore.textContent = score;
    correctCount.textContent = correctAnswers;
    totalQuestionsCount.textContent = testData.questions.length;

    if (performanceMessage) {
        performanceMessage.textContent = message;
        performanceMessage.style.display = 'block';
    }

    // Subject breakdown (JAMB / WAEC)
    if (subjectScores && (testData.mode === 'jamb_drill' || testData.mode === 'waec_neco')) {
        subjectBreakdown.style.display = 'block';
        let html = '';
        if (testData.mode === 'jamb_drill') {
            testData.subjects.forEach(subj => {
                const data = subjectScores[subj.value] || { correct: 0, total: subj.count };
                html += `<div style="margin: 5px 0;"><strong>${subj.name}:</strong> ${data.correct}/${data.total}</div>`;
            });
        } else {
            const subjectName = testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1);
            const data = subjectScores[testData.subject] || { correct: correctAnswers, total: testData.totalQuestions };
            html += `<div style="margin: 5px 0;"><strong>${subjectName}:</strong> ${data.correct}/${data.total}</div>`;
        }
        subjectBreakdownList.innerHTML = html;
    } else {
        subjectBreakdown.style.display = 'none';
    }

    // === Populate weak areas modal (hidden until user clicks "Check Weak Areas") ===
    populateWeakAreasModal();

    // Show results modal
    resultsModal.style.display = 'flex';

    // Housekeeping
    sessionStorage.removeItem('currentTest');
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
// WEAK AREAS MODAL — populate + open
// =============================================
function populateWeakAreasModal() {
    const topicBreakdownContainer = document.getElementById('topicBreakdownContainer');
    const topicBreakdownList = document.getElementById('topicBreakdownList');
    const recommendationsContainer = document.getElementById('recommendationsContainer');
    const recommendationsList = document.getElementById('recommendationsList');

    if (!topicBreakdownContainer || !topicBreakdownList || !recommendationsContainer || !recommendationsList) return;

    const hasWeak = testData.weakTopics && testData.weakTopics.length > 0;
    const hasStrong = testData.strongTopics && testData.strongTopics.length > 0;
    const hasRecs = testData.recommendations && testData.recommendations.length > 0;

    if (!hasWeak && !hasStrong) {
        // No topic-level data — show friendly message inside both panels
        topicBreakdownList.innerHTML = `<p class="weak-areas-empty">Not enough data yet. Complete more tests to see your topic-level performance.</p>`;
        recommendationsList.innerHTML = `<li>Keep practicing consistently — your weak areas will be highlighted as you take more tests.</li>`;
        return;
    }

    // Topic performance
    let topicHtml = '';
    if (hasWeak) {
        topicHtml += `<div style="margin-bottom: 6px; font-weight: 700; color: var(--accent-red); font-size: 13px;">Weak Areas</div>`;
        testData.weakTopics.forEach(topic => {
            topicHtml += `
                <div class="topic-item">
                    <span class="topic-name">${topic.topic} (${topic.subject})</span>
                    <span class="topic-stats">${topic.totalCorrect}/${topic.totalAnswered} • ${topic.accuracy}%</span>
                    <span class="topic-accuracy accuracy-weak">Weak</span>
                </div>
            `;
        });
    }
    if (hasStrong) {
        topicHtml += `<div style="margin: 12px 0 6px; font-weight: 700; color: var(--accent-green); font-size: 13px;">Strong Areas</div>`;
        testData.strongTopics.forEach(topic => {
            topicHtml += `
                <div class="topic-item">
                    <span class="topic-name">${topic.topic} (${topic.subject})</span>
                    <span class="topic-stats">${topic.totalCorrect}/${topic.totalAnswered} • ${topic.accuracy}%</span>
                    <span class="topic-accuracy accuracy-strong">Strong</span>
                </div>
            `;
        });
    }
    topicBreakdownList.innerHTML = topicHtml;

    // Recommendations
    if (hasRecs) {
        recommendationsList.innerHTML = testData.recommendations
            .map(rec => `<li>${rec}</li>`)
            .join('');
    } else {
        recommendationsList.innerHTML = `<li>Great job! Keep practicing to maintain your strengths.</li>`;
    }
}

function openWeakAreasModal() {
    resultsModal.style.display = 'none';
    weakAreasModal.style.display = 'flex';
}

function closeWeakAreasAndReturn() {
    weakAreasModal.style.display = 'none';
    resultsModal.style.display = 'flex';
}

// =============================================
// SOLUTION MODAL — open / close
// =============================================
function openSolutionFrom(sourceModal) {
    solutionOpenedFrom = sourceModal;

    if (sourceModal === 'results') resultsModal.style.display = 'none';
    else if (sourceModal === 'weakAreas') weakAreasModal.style.display = 'none';

    showSolutionsModal(testData.questions, testData.userAnswers);
}

function closeSolutionAndReturn() {
    const solutionModal = document.getElementById('solutionModal');
    if (solutionModal) solutionModal.style.display = 'none';

    if (solutionOpenedFrom === 'results') {
        resultsModal.style.display = 'flex';
    } else if (solutionOpenedFrom === 'weakAreas') {
        weakAreasModal.style.display = 'flex';
    }
    solutionOpenedFrom = null;
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

    if (testData.mode === 'jamb_drill') {
        testData.subjects.forEach(subj => {
            const subjectHeader = document.createElement('h3');
            subjectHeader.style.color = 'var(--accent-blue-light)';
            subjectHeader.style.margin = '20px 0 10px';
            subjectHeader.style.fontSize = '16px';
            subjectHeader.innerHTML = `<i class="fas fa-book"></i> ${subj.name}`;
            solutionsContainer.appendChild(subjectHeader);

            const subjectQuestions = questions.filter(q => q.subject === subj.value);
            subjectQuestions.forEach((question) => {
                const globalIndex = questions.findIndex(q => q.id === question.id);
                const userAnswer = userAnswers[globalIndex];
                const solutionItem = createSolutionItem(question, userAnswer, globalIndex + 1);
                solutionsContainer.appendChild(solutionItem);
            });
        });
    } else {
        questions.forEach((question, index) => {
            const solutionItem = createSolutionItem(question, userAnswers[index], index + 1);
            solutionsContainer.appendChild(solutionItem);
        });
    }

    modalBody.appendChild(solutionsContainer);

    const backButtonContainer = document.createElement('div');
    backButtonContainer.style.marginTop = '24px';
    backButtonContainer.style.paddingTop = '20px';
    backButtonContainer.style.borderTop = '1px solid rgba(140, 155, 200, 0.14)';
    backButtonContainer.style.textAlign = 'center';

    const backButton = document.createElement('button');
    backButton.className = 'modal-btn confirm';
    backButton.id = 'backToDashboardFromSolution';
    backButton.innerHTML = '<i class="fas fa-tachometer-alt"></i> Back to Dashboard';
    backButton.addEventListener('click', goToDashboard);

    backButtonContainer.appendChild(backButton);
    modalBody.appendChild(backButtonContainer);

    modal.style.display = 'flex';

    const closeBtn = document.getElementById('closeSolutionModal');
    if (closeBtn) closeBtn.onclick = closeSolutionAndReturn;

    modal.onclick = (e) => {
        if (e.target === modal) closeSolutionAndReturn();
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

    return solutionItem;
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
    const anyModalOpen =
        submitModal.style.display === 'flex' ||
        resultsModal.style.display === 'flex' ||
        weakAreasModal.style.display === 'flex';

    if (anyModalOpen) {
        if (e.key === 'Escape') {
            hideSubmitModal();
            resultsModal.style.display = 'none';
            weakAreasModal.style.display = 'none';
        }
        return;
    }

    switch (e.key) {
        case '1': case 'A': case 'a': selectOption('A'); break;
        case '2': case 'B': case 'b': selectOption('B'); break;
        case '3': case 'C': case 'c': selectOption('C'); break;
        case '4': case 'D': case 'd': selectOption('D'); break;
        case 'ArrowLeft': if (currentQuestionIndex > 0) loadQuestion(currentQuestionIndex - 1); break;
        case 'ArrowRight': if (currentQuestionIndex < testData.questions.length - 1) loadQuestion(currentQuestionIndex + 1); break;
        case 'Enter':
            if (currentQuestionIndex < testData.questions.length - 1) loadQuestion(currentQuestionIndex + 1);
            else showSubmitModal();
            break;
        case 'Escape': showSubmitModal(); break;
    }
}