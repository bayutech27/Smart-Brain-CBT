// js/test.js - Test Page with Firestore Integration
import { auth, db } from "./main.js";
import {
    collection,
    addDoc,
    getDoc,
    getDocs,
    doc,
    updateDoc,
    increment,
    serverTimestamp,
    writeBatch,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// =============================================
// WEAKNESS DETECTION & RECOMMENDATION ENGINE
// =============================================

/**
 * Safely extracts a topic from a question object.
 * First checks for 'topic' field, then falls back to other common names.
 * @param {Object} question - The question object.
 * @returns {string} The topic name or 'General' if not found.
 */
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
    console.warn('No topic field found in question. Available keys:', Object.keys(question));
    return 'General';
}

/**
 * Generates a weakness report grouped by subject and topic.
 * @param {Array} userAnswers - Array of selected answers (A,B,C,D or null)
 * @param {Array} questions - Array of question objects (should contain topic, subject, correctAnswer)
 * @returns {Object} - Structure: { subject: "Subject", topics: [...] }
 */
function generateWeaknessReport(userAnswers, questions) {
  const topicMap = new Map(); // key: subject|topic -> { subject, topic, total, correct }

  questions.forEach((q, index) => {
    const answer = userAnswers[index];
    if (answer === null) return;

    const subject = q.subject || 'General';
    const topic = getTopicFromQuestion(q);
    const key = `${subject}|${topic}`;
    const isCorrect = (answer === q.correctAnswer);

    if (!topicMap.has(key)) {
      topicMap.set(key, {
        subject,
        topic,
        total: 0,
        correct: 0,
      });
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
    return {
      ...record,
      accuracy,
      level,
    };
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

/**
 * Saves topic performance to Firestore under users/{userId}/topicStats/
 * @param {string} userId - Current user UID
 * @param {Array} topicStats - Array of subject objects with topic details
 */
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
    console.log("✅ Topic stats saved successfully");
  } catch (error) {
    console.error("❌ Error saving topic stats:", error);
  }
}

/**
 * Updates cumulative topic statistics for a user after a test.
 * Now stores lastAccuracy (previous accuracy) and lastPracticed timestamp.
 * @param {string} userId - Current user UID
 * @param {Array} topicStats - Output from generateWeaknessReport (array of subject objects)
 */
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
        console.log("✅ Cumulative topic stats updated with trend info");
    } catch (error) {
        console.error("❌ Error updating cumulative topic stats:", error);
    }
}

/**
 * Fetches all cumulative topic stats for a user.
 * @param {string} userId - Current user UID
 * @returns {Promise<Array>} Array of objects with subject, topic, totalAnswered, totalCorrect, etc.
 */
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

/**
 * Calculates weak and strong topics from cumulative stats.
 * Includes lastAccuracy and lastPracticed for trend analysis.
 * @param {Array} cumulativeStats - Array of cumulative topic objects
 * @returns {Object} { weakTopics: Array, strongTopics: Array }
 */
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

/**
 * Generates smart, context‑aware recommendation messages based on weak topics.
 * Uses severity, trend, subject grouping, time‑based hints, and template rotation.
 * @param {Array} weakTopics - Array of enriched weak topic objects (with accuracy, lastAccuracy, lastPracticed)
 * @returns {Array} Up to 3 recommendation strings.
 */
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
            if (trend === 'improving') {
                pool = templates.improving;
            } else if (trend === 'declining') {
                pool = templates.declining;
            } else {
                pool = templates[severity];
            }

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
let subjectStartIndices = {};
let subjectCounts = {};

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

    // Display subject(s) in header based on mode
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

    testData.subjects.forEach((subj, i) => {
        const tab = document.createElement('button');
        tab.className = 'subject-tab';
        tab.dataset.subject = subj.value;
        tab.textContent = subj.name;
        tab.addEventListener('click', () => switchToSubject(subj.value));
        subjectTabs.appendChild(tab);
    });

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
            : testData.mode === 'jamb_drill' ? 'JAMB Drill' : 'WAEC/NECO Drill';

        let userName = currentUser.displayName || '';
        if (!userName && currentUser.email) {
            userName = currentUser.email.split('@')[0];
        }
        if (!userName) {
            userName = 'Anonymous';
        }

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

        // Store subject scores for both JAMB and WAEC/NECO drills
        if (testData.mode === 'jamb_drill') {
            resultData.subjects = testData.subjects;
            resultData.subjectScores = subjectScores;
            resultData.totalRawScore = rawScore;
            resultData.totalPossible = testData.totalQuestions;
        } else if (testData.mode === 'waec_neco' && subjectScores) {
            resultData.subjectScores = subjectScores;
            // For WAEC/NECO, also store the subject name for easier querying
            resultData.subject = testData.subject;
            resultData.totalRawScore = rawScore;
            resultData.totalPossible = testData.totalQuestions;
        }

        console.log("Saving test result to Firestore:", resultData);

        const docRef = await addDoc(collection(db, "test_results"), resultData);

        console.log('✅ Test result saved to Firestore with ID:', docRef.id);

        showToast('✅ Test result saved successfully!', 'success');

        if (testData.plan === 'free' && (testData.mode === 'quick' || testData.mode === 'waec_neco')) {
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
// INCREMENT TEST COUNTS
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
            // Calculate per-subject scores for JAMB
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

            const totalQuestions = testData.totalQuestions; // 180
            finalDisplayScore = Math.round((correctAnswers / totalQuestions) * 400);
            scoreLabel.textContent = '/400 Score';
        } else if (testData.mode === 'waec_neco') {
            // Calculate per-subject scores for WAEC/NECO (only one subject)
            subjectScores = {};
            const subjectValue = testData.subject;
            subjectScores[subjectValue] = { correct: correctAnswers, total: testData.totalQuestions };

            finalDisplayScore = Math.round((correctAnswers / testData.questions.length) * 100);
            scoreLabel.textContent = '% Score';
        } else {
            // Quick Test: no subjectScores needed
            finalDisplayScore = Math.round((correctAnswers / testData.questions.length) * 100);
            scoreLabel.textContent = '% Score';
        }

        // Weakness Detection & Recommendations
        const topicStats = generateWeaknessReport(testData.userAnswers, testData.questions);
        console.log('🔍 Topic Stats:', topicStats);

        if (topicStats.length > 0) {
            saveTopicStats(currentUser.uid, topicStats).catch(err =>
                console.warn('Topic stats save failed (non‑critical):', err)
            );
            await updateCumulativeTopicStats(currentUser.uid, topicStats);

            const cumulativeStats = await fetchCumulativeTopicStats(currentUser.uid);

            let filteredCumulativeStats = cumulativeStats;
            if (testData.mode === 'quick' || testData.mode === 'waec_neco') {
                const currentSubject = testData.subject;
                filteredCumulativeStats = cumulativeStats.filter(stat => stat.subject === currentSubject);
            } else if (testData.mode === 'jamb_drill') {
                const subjectValues = testData.subjects.map(s => s.value);
                filteredCumulativeStats = cumulativeStats.filter(stat => subjectValues.includes(stat.subject));
            }

            const { weakTopics, strongTopics } = calculateCumulativeWeakness(filteredCumulativeStats);
            const recommendations = generateSmartRecommendations(weakTopics);

            testData.weakTopics = weakTopics;
            testData.strongTopics = strongTopics;
            testData.recommendations = recommendations;

            console.log('🔍 Weak Topics:', weakTopics);
            console.log('🔍 Strong Topics:', strongTopics);
            console.log('🔍 Recommendations:', recommendations);
        } else {
            console.warn('No topic stats generated – check if questions have subject/topic fields.');
            testData.recommendations = [];
        }

        console.log(`Score calculated: ${finalDisplayScore} (${correctAnswers}/${testData.questions.length})`);

        // Save to Firestore with per-subject scores
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
// SHOW RESULTS
// =============================================
function showResults(score, correctAnswers, message, subjectScores = null) {
    getResultBtn.classList.remove('btn-loading');
    getResultBtn.innerHTML = '<i class="fas fa-check-circle"></i> Submit Test';

    finalScore.textContent = score;
    correctCount.textContent = correctAnswers;
    totalQuestionsCount.textContent = testData.questions.length;
    
    if (performanceMessage) {
        performanceMessage.textContent = message;
        performanceMessage.style.display = 'none';
    }

    const topicBreakdownContainer = document.getElementById('topicBreakdownContainer');
    const topicBreakdownList = document.getElementById('topicBreakdownList');
    if (topicBreakdownContainer && topicBreakdownList) {
        if ((testData.weakTopics && testData.weakTopics.length > 0) || (testData.strongTopics && testData.strongTopics.length > 0)) {
            let html = '';
            if (testData.weakTopics && testData.weakTopics.length > 0) {
                html += '<div style="margin-top: 8px; font-weight: 600; color: #dc3545;">Weak Areas</div>';
                testData.weakTopics.forEach(topic => {
                    html += `
                        <div class="topic-item">
                            <span class="topic-name">${topic.topic} (${topic.subject})</span>
                            <span class="topic-stats">${topic.totalCorrect}/${topic.totalAnswered} (${topic.accuracy}%)</span>
                            <span class="topic-accuracy accuracy-weak">Weak</span>
                        </div>
                    `;
                });
            }
            if (testData.strongTopics && testData.strongTopics.length > 0) {
                html += '<div style="margin-top: 16px; font-weight: 600; color: #28a745;">Strong Areas</div>';
                testData.strongTopics.forEach(topic => {
                    html += `
                        <div class="topic-item">
                            <span class="topic-name">${topic.topic} (${topic.subject})</span>
                            <span class="topic-stats">${topic.totalCorrect}/${topic.totalAnswered} (${topic.accuracy}%)</span>
                            <span class="topic-accuracy accuracy-strong">Strong</span>
                        </div>
                    `;
                });
            }
            topicBreakdownList.innerHTML = html;
            topicBreakdownContainer.style.display = 'block';
        } else {
            topicBreakdownContainer.style.display = 'none';
        }
    }

    const recommendationsContainer = document.getElementById('recommendationsContainer');
    const recommendationsList = document.getElementById('recommendationsList');
    if (recommendationsContainer && recommendationsList && testData.recommendations && testData.recommendations.length > 0) {
        recommendationsList.innerHTML = testData.recommendations
            .map(rec => `<li>${rec}</li>`)
            .join('');
        recommendationsContainer.style.display = 'block';
    } else if (recommendationsContainer) {
        recommendationsContainer.style.display = 'none';
    }

    // Display subject breakdown for both JAMB and WAEC/NECO drills
    if (subjectScores && (testData.mode === 'jamb_drill' || testData.mode === 'waec_neco')) {
        subjectBreakdown.style.display = 'block';
        let html = '';
        if (testData.mode === 'jamb_drill') {
            testData.subjects.forEach(subj => {
                const data = subjectScores[subj.value] || { correct: 0, total: subj.count };
                html += `<div style="margin: 5px 0;"><strong>${subj.name}:</strong> ${data.correct}/${data.total}</div>`;
            });
        } else if (testData.mode === 'waec_neco') {
            // WAEC/NECO: only one subject
            const subjectName = testData.subject.charAt(0).toUpperCase() + testData.subject.slice(1);
            const data = subjectScores[testData.subject] || { correct: correctAnswers, total: testData.totalQuestions };
            html += `<div style="margin: 5px 0;"><strong>${subjectName}:</strong> ${data.correct}/${data.total}</div>`;
        }
        subjectBreakdownList.innerHTML = html;
    } else {
        subjectBreakdown.style.display = 'none';
    }

    resultsModal.style.display = 'flex';
    addSolutionButton();

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
// SOLUTION BUTTON
// =============================================
function addSolutionButton() {
    const premiumNotification = document.getElementById('premiumNotification');
    if (premiumNotification) {
        premiumNotification.style.display = 'block';
    }

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
        const subjects = testData.subjects;
        subjects.forEach(subj => {
            const subjectHeader = document.createElement('h3');
            subjectHeader.style.color = 'var(--eggplant)';
            subjectHeader.style.margin = '20px 0 10px';
            subjectHeader.innerHTML = `<i class="fas fa-book"></i> ${subj.name}`;
            solutionsContainer.appendChild(subjectHeader);

            const subjectQuestions = questions.filter((q, idx) => q.subject === subj.value);
            subjectQuestions.forEach((question, idxInSubj) => {
                const globalIndex = questions.findIndex(q => q.id === question.id);
                const userAnswer = userAnswers[globalIndex];
                const solutionItem = createSolutionItem(question, userAnswer, globalIndex + 1);
                solutionsContainer.appendChild(solutionItem);
            });
        });
    } else {
        // For Quick Test and WAEC/NECO, just list all questions
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