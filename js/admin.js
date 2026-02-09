// ================= IMPORTS =================
import { db, auth } from "./main.js";

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  where,
  getDoc,
  writeBatch
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

import {
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

console.log(db);

// ================= DOM REFERENCES =================

// Tabs
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// Question Form
const addQuestionForm = document.getElementById("addQuestionForm");
const questionIdField = document.getElementById("questionId");
const examType = document.getElementById("examType");
const subject = document.getElementById("subject");
const timeLimit = document.getElementById("timeLimit");
const questionText = document.getElementById("questionText");
const questionImage = document.getElementById("questionImage");
const questionImagePreview = document.getElementById("questionImagePreview");
const questionImagePreviewImg = document.getElementById("questionImagePreviewImg");
const optionA = document.getElementById("optionA");
const optionB = document.getElementById("optionB");
const optionC = document.getElementById("optionC");
const optionD = document.getElementById("optionD");
const correctAnswer = document.getElementById("correctAnswer");
const solution = document.getElementById("solution");
const solutionImage = document.getElementById("solutionImage");
const solutionImagePreview = document.getElementById("solutionImagePreview");
const solutionImagePreviewImg = document.getElementById("solutionImagePreviewImg");
const formFeedback = document.getElementById("formFeedback");
const validationMessage = document.getElementById("validationMessage");
const submitQuestionBtn = document.getElementById("submitQuestionBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const clearFormBtn = document.getElementById("clearFormBtn");

// Question List
const questionTableBody = document.getElementById("questionTableBody");
const loadMoreBtn = document.getElementById("loadMoreQuestions");
const questionSearch = document.getElementById("questionSearch");
const searchBtn = document.getElementById("searchBtn");

// Students
const studentTableBody = document.getElementById("studentTableBody");
const totalStudents = document.getElementById("totalStudents");
const freePlanStudents = document.getElementById("freePlanStudents");
const premiumPlanStudents = document.getElementById("premiumPlanStudents");

// Logout
const logoutBtn = document.getElementById("logoutBtn");

// ================= BULK UPLOAD REFERENCES =================
const csvMethodBtn = document.getElementById("csvMethodBtn");
const textMethodBtn = document.getElementById("textMethodBtn");
const csvUploadSection = document.getElementById("csvUploadSection");
const textUploadSection = document.getElementById("textUploadSection");
const csvDropZone = document.getElementById("csvDropZone");
const csvFileInput = document.getElementById("csvFileInput");
const browseCsvBtn = document.getElementById("browseCsvBtn");
const csvPreview = document.getElementById("csvPreview");
const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");
const startUploadBtn = document.getElementById("startUploadBtn");
const cancelUploadBtn = document.getElementById("cancelUploadBtn");
const uploadProgress = document.getElementById("uploadProgress");
const progressFill = document.getElementById("progressFill");
const processedCount = document.getElementById("processedCount");
const totalCount = document.getElementById("totalCount");
const progressPercent = document.getElementById("progressPercent");
const bulkTextInput = document.getElementById("bulkTextInput");
const parseTextBtn = document.getElementById("parseTextBtn");
const uploadTextBtn = document.getElementById("uploadTextBtn");
const textPreview = document.getElementById("textPreview");
const bulkUploadFeedback = document.getElementById("bulkUploadFeedback");

// ================= IMAGE UPLOAD VARIABLES =================
let questionImageBase64 = null;
let solutionImageBase64 = null;
let csvData = null;
let uploadInProgress = false;
let cancelUpload = false;

// ================= TAB SWITCHING =================
tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    tabButtons.forEach(b => b.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));

    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
    
    // Reload data when switching to student tab
    if (btn.dataset.tab === "student-manager") {
      loadStudents();
    }
  });
});

// ================= AUTH PROTECTION =================
onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "index.html";
  }
});

// ================= IMAGE UPLOAD FUNCTIONS =================

// Question image handling
questionImage.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            showValidationMessage("Image size must be less than 5MB", "error");
            this.value = '';
            return;
        }
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showValidationMessage("Please upload a valid image file (JPG, PNG, GIF, WEBP)", "error");
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            questionImageBase64 = e.target.result;
            questionImagePreviewImg.src = questionImageBase64;
            questionImagePreview.style.display = 'block';
            hideValidationMessage();
        };
        reader.onerror = function() {
            showValidationMessage("Error reading image file", "error");
            this.value = '';
        };
        reader.readAsDataURL(file);
    }
});

// Solution image handling
solutionImage.addEventListener("change", function(e) {
    const file = e.target.files[0];
    if (file) {
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            showValidationMessage("Image size must be less than 5MB", "error");
            this.value = '';
            return;
        }
        
        // Validate file type
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            showValidationMessage("Please upload a valid image file (JPG, PNG, GIF, WEBP)", "error");
            this.value = '';
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            solutionImageBase64 = e.target.result;
            solutionImagePreviewImg.src = solutionImageBase64;
            solutionImagePreview.style.display = 'block';
            hideValidationMessage();
        };
        reader.onerror = function() {
            showValidationMessage("Error reading image file", "error");
            this.value = '';
        };
        reader.readAsDataURL(file);
    }
});

// Remove question image
window.removeQuestionImage = function() {
    questionImageBase64 = null;
    questionImage.value = '';
    questionImagePreview.style.display = 'none';
    questionImagePreviewImg.src = '';
};

// Remove solution image
window.removeSolutionImage = function() {
    solutionImageBase64 = null;
    solutionImage.value = '';
    solutionImagePreview.style.display = 'none';
    solutionImagePreviewImg.src = '';
};

// Show validation message
function showValidationMessage(message, type = "error") {
    validationMessage.textContent = message;
    validationMessage.className = `validation-message ${type}`;
    validationMessage.classList.add('show');
    
    // Scroll to validation message
    validationMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Hide validation message
function hideValidationMessage() {
    validationMessage.classList.remove('show');
}

// ================= QUESTION MANAGEMENT =================

// Helper to detect if text contains mathematical expressions
function containsMathExpression(text) {
    if (!text) return false;
    
    const mathPatterns = [
        /log\s*[a-zA-Z0-9]/,
        /[∫∑∏√^]/g,
        /[α-ωΑ-Ω]/,
        /\{\s*[^}]*\s*\}/,
        /\[.*\]/,
        /lim_\{/,
        /frac\{/,
        /sum_\{/,
        /prod_\{/,
        /_[a-zA-Z0-9]/,
        /\^[a-zA-Z0-9]/,
        /\\\(.*\\\)/,
        /\\\[.*\\\]/,
        /\$\$.*\$\$/,
        /\$.*\$/,
    ];
    
    return mathPatterns.some(pattern => pattern.test(text));
}

// Helper to preserve mathematical formatting in text - KEEPS ORIGINAL FORMATTING
function preserveMathFormatting(text) {
    if (!text) return text;
    
    const lines = text.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (!line.trim() && !containsMathExpression(lines[i-1] || '') && !containsMathExpression(lines[i+1] || '')) {
            result.push(line);
            continue;
        }
        
        const isMathLine = containsMathExpression(line);
        const prevIsMath = i > 0 && containsMathExpression(lines[i-1]);
        const nextIsMath = i < lines.length - 1 && containsMathExpression(lines[i+1]);
        
        if (isMathLine && (prevIsMath || nextIsMath)) {
            result.push(line);
        } else {
            result.push(line);
        }
    }
    
    return result.join('\n');
}

// Format text for HTML display - PRESERVES MATH FORMATTING
function formatTextForDisplay(text) {
    if (!text) return "";
    
    const encodedText = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    
    let formatted = encodedText;
    const lines = formatted.split('\n');
    formatted = lines.map((line, index) => {
        const isMathLine = containsMathExpression(line);
        const prevIsMath = index > 0 && containsMathExpression(lines[index-1]);
        const nextIsMath = index < lines.length - 1 && containsMathExpression(lines[index+1]);
        
        if (isMathLine && (prevIsMath || nextIsMath)) {
            return line;
        } else {
            return line.replace(/\n/g, '<br>');
        }
    }).join('<br>');
    
    formatted = formatted.replace(/([^<])\n([^<])/g, '$1<br>$2');
    
    return formatted;
}

// Format text for tooltip display
function formatTextForTooltip(text) {
    if (!text) return "";
    return text.replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// Get question type for display
function getQuestionType(questionData) {
    const hasText = questionData.questionText && questionData.questionText.trim() !== '';
    const hasImage = questionData.questionImage;
    
    if (hasText && hasImage) return "both";
    if (hasText) return "text";
    if (hasImage) return "image";
    return "none";
}

// Get solution type for display
function getSolutionType(questionData) {
    const hasText = questionData.solution && questionData.solution.trim() !== '';
    const hasImage = questionData.solutionImage;
    
    if (hasText && hasImage) return "both";
    if (hasText) return "text";
    if (hasImage) return "image";
    return "none";
}

// Reset form to add new question mode
function resetQuestionForm() {
    addQuestionForm.reset();
    questionIdField.value = "";
    submitQuestionBtn.innerHTML = '<i class="fas fa-save"></i> Save Question to Bank';
    cancelEditBtn.style.display = 'none';
    formFeedback.textContent = "";
    formFeedback.className = "feedback-message";
    hideValidationMessage();
    
    // Clear images
    removeQuestionImage();
    removeSolutionImage();
}

// Load question data into form for editing
async function loadQuestionForEdit(questionId) {
    try {
        const questionRef = doc(db, "questions", questionId);
        const questionSnap = await getDoc(questionRef);
        
        if (questionSnap.exists()) {
            const questionData = questionSnap.data();
            
            // Populate form fields with preserved formatting
            questionIdField.value = questionId;
            examType.value = questionData.examType || "";
            subject.value = questionData.subject || "";
            timeLimit.value = questionData.timeLimit || 120;
            questionText.value = preserveMathFormatting(questionData.questionText || "");
            optionA.value = preserveMathFormatting(questionData.options?.A || "");
            optionB.value = preserveMathFormatting(questionData.options?.B || "");
            optionC.value = preserveMathFormatting(questionData.options?.C || "");
            optionD.value = preserveMathFormatting(questionData.options?.D || "");
            correctAnswer.value = questionData.correctAnswer || "";
            solution.value = preserveMathFormatting(questionData.solution || "");
            
            // Load images if they exist
            if (questionData.questionImage) {
                questionImageBase64 = questionData.questionImage;
                questionImagePreviewImg.src = questionImageBase64;
                questionImagePreview.style.display = 'block';
            }
            
            if (questionData.solutionImage) {
                solutionImageBase64 = questionData.solutionImage;
                solutionImagePreviewImg.src = solutionImageBase64;
                solutionImagePreview.style.display = 'block';
            }
            
            // Change button text and show cancel button
            submitQuestionBtn.innerHTML = '<i class="fas fa-save"></i> Update Question';
            cancelEditBtn.style.display = 'inline-flex';
            
            // Switch to Add Question tab
            tabButtons.forEach(b => b.classList.remove("active"));
            tabContents.forEach(c => c.classList.remove("active"));
            document.querySelector('[data-tab="question-manager"]').classList.add("active");
            document.getElementById("question-manager").classList.add("active");
            
            formFeedback.textContent = "✅ Now editing question. Make changes and click 'Update Question'.";
            formFeedback.className = "feedback-message success";
            
            // Scroll to form
            document.getElementById("question-manager").scrollIntoView({ behavior: 'smooth' });
        } else {
            formFeedback.textContent = "❌ Question not found";
            formFeedback.className = "feedback-message error";
        }
    } catch (error) {
        console.error("Error loading question for edit:", error);
        formFeedback.textContent = "❌ Error loading question";
        formFeedback.className = "feedback-message error";
    }
}

// Validate form before submission
function validateQuestionForm() {
    const questionTextValue = preserveMathFormatting(questionText.value);
    
    // Check if at least question text or question image is provided
    if (!questionTextValue && !questionImageBase64) {
        showValidationMessage("❌ Please provide either question text or question image (or both)");
        return false;
    }
    
    // Check if at least one option is filled
    if (!optionA.value.trim() || !optionB.value.trim() || !optionC.value.trim() || !optionD.value.trim()) {
        showValidationMessage("❌ All four options (A, B, C, D) are required");
        return false;
    }
    
    // Check if correct answer is selected
    if (!correctAnswer.value) {
        showValidationMessage("❌ Please select the correct answer");
        return false;
    }
    
    hideValidationMessage();
    return true;
}

// Save or update question
addQuestionForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate form
    if (!validateQuestionForm()) {
        return;
    }

    try {
        const questionData = {
            examType: examType.value,
            subject: subject.value,
            questionText: preserveMathFormatting(questionText.value),
            options: {
                A: preserveMathFormatting(optionA.value),
                B: preserveMathFormatting(optionB.value),
                C: preserveMathFormatting(optionC.value),
                D: preserveMathFormatting(optionD.value)
            },
            correctAnswer: correctAnswer.value,
            solution: preserveMathFormatting(solution.value),
            timeLimit: Number(timeLimit.value),
            lastUpdated: serverTimestamp(),
            questionType: getQuestionType({ 
                questionText: questionText.value, 
                questionImage: questionImageBase64 
            }),
            solutionType: getSolutionType({ 
                solution: solution.value, 
                solutionImage: solutionImageBase64 
            })
        };

        // Add images if provided
        if (questionImageBase64) {
            questionData.questionImage = questionImageBase64;
        }
        if (solutionImageBase64) {
            questionData.solutionImage = solutionImageBase64;
        }

        // Check if we're updating or adding new
        if (questionIdField.value) {
            // Update existing question
            await updateDoc(doc(db, "questions", questionIdField.value), questionData);
            formFeedback.textContent = "✅ Question updated successfully";
        } else {
            // Add new question
            questionData.createdAt = serverTimestamp();
            questionData.createdBy = auth.currentUser.uid;
            await addDoc(collection(db, "questions"), questionData);
            formFeedback.textContent = "✅ Question saved successfully";
        }
        
        formFeedback.className = "feedback-message success";
        
        // Reset form and reload question list
        resetQuestionForm();
        loadQuestions(false);
        
    } catch (error) {
        console.error("Error saving question:", error);
        formFeedback.textContent = "❌ Failed to save question";
        formFeedback.className = "feedback-message error";
    }
});

// Clear form button
clearFormBtn.addEventListener("click", resetQuestionForm);

// Cancel edit button
cancelEditBtn.addEventListener("click", resetQuestionForm);

// ================= BULK UPLOAD FUNCTIONS =================

// Switch between CSV and Text upload methods
csvMethodBtn.addEventListener("click", () => {
    csvMethodBtn.classList.add("active");
    textMethodBtn.classList.remove("active");
    csvUploadSection.classList.add("active");
    textUploadSection.classList.remove("active");
});

textMethodBtn.addEventListener("click", () => {
    textMethodBtn.classList.add("active");
    csvMethodBtn.classList.remove("active");
    textUploadSection.classList.add("active");
    csvUploadSection.classList.remove("active");
});

// Download CSV Template
downloadTemplateBtn.addEventListener("click", () => {
    const template = `questionText,optionA,optionB,optionC,optionD,correctAnswer,solution,subject,examType,timeLimit
"What is 2+2?",4,5,6,7,A,"Basic addition",mathematics,WAEC/NECO,120
"What is the capital of France?",Paris,London,Berlin,Madrid,A,"Paris is the capital",geography,JAMB,90
"Who wrote Romeo and Juliet?",William Shakespeare,Charles Dickens,Jane Austen,Mark Twain,A,"William Shakespeare wrote Romeo and Juliet",literature,WAEC/NECO,120
"What is H2O?",Water,Oxygen,Hydrogen,Carbon Dioxide,A,"H2O is the chemical formula for water",chemistry,JAMB,60`;

    const blob = new Blob([template], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'question-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
});

// Drag and drop functionality
csvDropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvDropZone.classList.add('drag-over');
});

csvDropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    csvDropZone.classList.remove('drag-over');
});

csvDropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    csvDropZone.classList.remove('drag-over');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
            handleCSVFile(file);
        } else {
            showBulkUploadFeedback('Please upload a CSV file', 'error');
        }
    }
});

// Browse CSV file
browseCsvBtn.addEventListener('click', () => {
    csvFileInput.click();
});

csvFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        handleCSVFile(file);
    }
});

// Handle CSV file processing
function handleCSVFile(file) {
    if (file.size > 5 * 1024 * 1024) {
        showBulkUploadFeedback('File size exceeds 5MB limit', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            parseCSVData(e.target.result);
        } catch (error) {
            showBulkUploadFeedback('Error parsing CSV file: ' + error.message, 'error');
        }
    };
    reader.onerror = () => {
        showBulkUploadFeedback('Error reading file', 'error');
    };
    reader.readAsText(file);
}

// Parse CSV data
function parseCSVData(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    if (lines.length < 2) {
        showBulkUploadFeedback('CSV file must contain at least header row and one data row', 'error');
        return;
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    const requiredHeaders = ['questiontext', 'optiona', 'optionb', 'optionc', 'optiond', 'correctanswer', 'subject'];
    for (const header of requiredHeaders) {
        if (!headers.includes(header)) {
            showBulkUploadFeedback(`Missing required header: ${header}`, 'error');
            return;
        }
    }

    csvData = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        const values = parseCSVLine(line);
        
        if (values.length !== headers.length) {
            errors.push(`Row ${i}: Column count mismatch`);
            continue;
        }

        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] ? preserveMathFormatting(values[index].trim()) : '';
        });

        const validationError = validateQuestionRow(row, i);
        if (validationError) {
            errors.push(validationError);
        } else {
            csvData.push(row);
        }
    }

    if (errors.length > 0) {
        showBulkUploadFeedback(`Found ${errors.length} error(s). First error: ${errors[0]}`, 'error');
        csvData = null;
        startUploadBtn.disabled = true;
    } else {
        showBulkUploadFeedback(`Successfully parsed ${csvData.length} questions`, 'success');
        updateCSVPreview();
        startUploadBtn.disabled = false;
    }
}

// Parse CSV line with quoted values
function parseCSVLine(line) {
    const result = [];
    let inQuotes = false;
    let currentField = '';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(currentField);
            currentField = '';
        } else {
            currentField += char;
        }
    }
    
    result.push(currentField);
    return result;
}

// Validate question row
function validateQuestionRow(row, rowNumber) {
    if (!row.questiontext || row.questiontext.trim() === '') {
        return `Row ${rowNumber}: Question text is required`;
    }
    
    if (!row.optiona || !row.optionb || !row.optionc || !row.optiond) {
        return `Row ${rowNumber}: All options (A, B, C, D) are required`;
    }
    
    const correctAnswer = row.correctanswer?.toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(correctAnswer)) {
        return `Row ${rowNumber}: Correct answer must be A, B, C, or D`;
    }
    
    if (!row.subject || row.subject.trim() === '') {
        return `Row ${rowNumber}: Subject is required`;
    }
    
    if (row.timelimit && isNaN(parseInt(row.timelimit))) {
        return `Row ${rowNumber}: Time limit must be a number`;
    }
    
    return null;
}

// Update CSV preview
function updateCSVPreview() {
    if (!csvData || csvData.length === 0) {
        csvPreview.innerHTML = '<p>No data to preview</p>';
        return;
    }

    let previewHTML = `
        <table class="csv-preview-table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Question Preview</th>
                    <th>Subject</th>
                    <th>Exam</th>
                    <th>Correct</th>
                </tr>
            </thead>
            <tbody>
    `;

    const displayCount = Math.min(csvData.length, 10);
    for (let i = 0; i < displayCount; i++) {
        const row = csvData[i];
        const questionPreview = row.questiontext.length > 50 
            ? row.questiontext.substring(0, 50) + '...' 
            : row.questiontext;
        
        previewHTML += `
            <tr>
                <td>${i + 1}</td>
                <td>${formatTextForDisplay(questionPreview)}</td>
                <td>${row.subject}</td>
                <td>${row.examtype || 'WAEC/NECO'}</td>
                <td>${row.correctanswer?.toUpperCase() || 'A'}</td>
            </tr>
        `;
    }

    if (csvData.length > 10) {
        previewHTML += `
            <tr>
                <td colspan="5" style="text-align: center; font-style: italic;">
                    ... and ${csvData.length - 10} more questions
                </td>
            </tr>
        `;
    }

    previewHTML += `
            </tbody>
        </table>
        <p style="margin-top: 10px; color: #666; font-size: 0.9rem;">
            Total questions: ${csvData.length}
        </p>
    `;

    csvPreview.innerHTML = previewHTML;
}

// Show bulk upload feedback
function showBulkUploadFeedback(message, type = 'info') {
    bulkUploadFeedback.textContent = message;
    bulkUploadFeedback.className = `feedback-message ${type}`;
    bulkUploadFeedback.style.display = 'block';
    
    if (type === 'error') {
        setTimeout(() => {
            bulkUploadFeedback.style.display = 'none';
        }, 5000);
    }
}

// Start bulk upload
startUploadBtn.addEventListener('click', async () => {
    if (!csvData || csvData.length === 0) {
        showBulkUploadFeedback('No data to upload', 'error');
        return;
    }

    if (uploadInProgress) {
        showBulkUploadFeedback('Upload already in progress', 'error');
        return;
    }

    uploadInProgress = true;
    cancelUpload = false;
    startUploadBtn.disabled = true;
    cancelUploadBtn.style.display = 'inline-flex';
    uploadProgress.style.display = 'block';
    
    const totalQuestions = csvData.length;
    let successful = 0;
    let failed = 0;
    
    totalCount.textContent = totalQuestions;
    processedCount.textContent = '0';
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';

    showBulkUploadFeedback(`Starting upload of ${totalQuestions} questions...`, 'info');

    try {
        const BATCH_SIZE = 500;
        const userId = auth.currentUser?.uid;
        const timestamp = serverTimestamp();

        for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
            if (cancelUpload) break;

            const batch = writeBatch(db);
            const batchEnd = Math.min(i + BATCH_SIZE, totalQuestions);

            for (let j = i; j < batchEnd; j++) {
                const row = csvData[j];
                const questionDoc = {
                    examType: row.examtype || 'WAEC/NECO',
                    subject: row.subject,
                    questionText: preserveMathFormatting(row.questiontext),
                    options: {
                        A: preserveMathFormatting(row.optiona),
                        B: preserveMathFormatting(row.optionb),
                        C: preserveMathFormatting(row.optionc),
                        D: preserveMathFormatting(row.optiond)
                    },
                    correctAnswer: row.correctanswer?.toUpperCase() || 'A',
                    solution: preserveMathFormatting(row.solution || ''),
                    timeLimit: row.timelimit ? parseInt(row.timelimit) : 120,
                    questionType: 'text', // CSV upload only supports text
                    solutionType: row.solution ? 'text' : 'none',
                    createdAt: timestamp,
                    lastUpdated: timestamp,
                    createdBy: userId
                };

                const docRef = doc(collection(db, "questions"));
                batch.set(docRef, questionDoc);
            }

            await batch.commit();
            successful += (batchEnd - i);

            const progress = Math.round((successful / totalQuestions) * 100);
            processedCount.textContent = successful;
            progressPercent.textContent = `${progress}%`;
            progressFill.style.width = `${progress}%`;

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (cancelUpload) {
            showBulkUploadFeedback('Upload cancelled', 'error');
        } else {
            showBulkUploadFeedback(`✅ Successfully uploaded ${successful} questions!`, 'success');
            
            csvData = null;
            csvPreview.innerHTML = '<p>No file selected. Upload a CSV file to see preview.</p>';
            startUploadBtn.disabled = true;
            
            loadQuestions(false);
        }

    } catch (error) {
        console.error('Bulk upload error:', error);
        showBulkUploadFeedback(`Error during upload: ${error.message}`, 'error');
    } finally {
        uploadInProgress = false;
        startUploadBtn.disabled = false;
        cancelUploadBtn.style.display = 'none';
        uploadProgress.style.display = 'none';
    }
});

// Cancel upload
cancelUploadBtn.addEventListener('click', () => {
    if (uploadInProgress) {
        cancelUpload = true;
        cancelUploadBtn.disabled = true;
        cancelUploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cancelling...';
    }
});

// ================= TEXT FORMAT UPLOAD =================

// Parse text format
parseTextBtn.addEventListener('click', () => {
    const text = bulkTextInput.value.trim();
    if (!text) {
        showBulkUploadFeedback('Please enter questions in text format', 'error');
        return;
    }

    try {
        const questions = parseTextFormat(text);
        textPreview.innerHTML = `
            <div class="feedback-message success">
                Found ${questions.length} valid questions
            </div>
            <p style="margin-top: 10px; color: #666;">
                Ready to upload ${questions.length} questions. Click "Upload Text Questions" to proceed.
            </p>
        `;
        uploadTextBtn.disabled = false;
        uploadTextBtn.dataset.questions = JSON.stringify(questions);
    } catch (error) {
        showBulkUploadFeedback(`Error parsing text: ${error.message}`, 'error');
        uploadTextBtn.disabled = true;
    }
});

// Parse text format - PRESERVES MATHEMATICAL FORMATTING
function parseTextFormat(text) {
    const blocks = text.split(/\n\s*\n/).filter(block => block.trim() !== '');
    const questions = [];

    blocks.forEach((block, blockIndex) => {
        const lines = block.split('\n');
        const question = {
            questionText: '',
            optionA: '',
            optionB: '',
            optionC: '',
            optionD: '',
            correctAnswer: 'A',
            solution: '',
            subject: 'mathematics',
            examType: 'WAEC/NECO',
            timeLimit: 120
        };

        let currentField = '';
        let collectingMultiLine = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
            if (line.match(/^[QABCD]:|^Correct:|^Solution:|^Subject:|^Exam Type:|^Time Limit:/)) {
                if (collectingMultiLine && currentField && question[currentField]) {
                    question[currentField] += '\n' + line.substring(line.indexOf(':') + 1).trim();
                } else {
                    collectingMultiLine = false;
                    
                    if (line.startsWith('Q:')) {
                        currentField = 'questionText';
                        question.questionText = line.substring(2).trim();
                        if (i + 1 < lines.length && !lines[i + 1].match(/^[ABCD]:|^Correct:|^Solution:|^Subject:|^Exam Type:|^Time Limit:/)) {
                            collectingMultiLine = true;
                        }
                    }
                    else if (line.startsWith('A:')) question.optionA = line.substring(2).trim();
                    else if (line.startsWith('B:')) question.optionB = line.substring(2).trim();
                    else if (line.startsWith('C:')) question.optionC = line.substring(2).trim();
                    else if (line.startsWith('D:')) question.optionD = line.substring(2).trim();
                    else if (line.startsWith('Correct:')) question.correctAnswer = line.substring(8).trim().toUpperCase();
                    else if (line.startsWith('Solution:')) {
                        currentField = 'solution';
                        question.solution = line.substring(9).trim();
                        if (i + 1 < lines.length && !lines[i + 1].match(/^Subject:|^Exam Type:|^Time Limit:/)) {
                            collectingMultiLine = true;
                        }
                    }
                    else if (line.startsWith('Subject:')) question.subject = line.substring(8).trim().toLowerCase();
                    else if (line.startsWith('Exam Type:')) question.examType = line.substring(10).trim();
                    else if (line.startsWith('Time Limit:')) question.timeLimit = parseInt(line.substring(11).trim()) || 120;
                }
            }
            else if (collectingMultiLine) {
                if (currentField) {
                    const currentValue = question[currentField];
                    const isMathLine = containsMathExpression(line);
                    const prevIsMath = containsMathExpression(currentValue);
                    
                    if (isMathLine && prevIsMath) {
                        question[currentField] = currentValue + ' ' + line.trim();
                    } else {
                        question[currentField] = currentValue + '\n' + line.trim();
                    }
                }
            }
            else if (line.trim()) {
                throw new Error(`Block ${blockIndex + 1}, line ${i + 1}: Unexpected line format - "${line}"`);
            }
        }

        question.questionText = preserveMathFormatting(question.questionText);
        question.optionA = preserveMathFormatting(question.optionA);
        question.optionB = preserveMathFormatting(question.optionB);
        question.optionC = preserveMathFormatting(question.optionC);
        question.optionD = preserveMathFormatting(question.optionD);
        question.solution = preserveMathFormatting(question.solution);

        if (!question.questionText || !question.optionA || !question.optionB || 
            !question.optionC || !question.optionD) {
            throw new Error(`Block ${blockIndex + 1}: Missing required fields`);
        }

        if (!['A', 'B', 'C', 'D'].includes(question.correctAnswer)) {
            throw new Error(`Block ${blockIndex + 1}: Correct answer must be A, B, C, or D`);
        }

        questions.push(question);
    });

    return questions;
}

// Upload text questions
uploadTextBtn.addEventListener('click', async () => {
    const questionsJson = uploadTextBtn.dataset.questions;
    if (!questionsJson) {
        showBulkUploadFeedback('Please validate the text format first', 'error');
        return;
    }

    const questions = JSON.parse(questionsJson);
    await uploadQuestionsBatch(questions);
});

// Generic batch upload function - PRESERVES FORMATTING
async function uploadQuestionsBatch(questions) {
    if (uploadInProgress) {
        showBulkUploadFeedback('Upload already in progress', 'error');
        return;
    }

    uploadInProgress = true;
    uploadTextBtn.disabled = true;
    uploadProgress.style.display = 'block';
    
    const totalQuestions = questions.length;
    let successful = 0;
    
    totalCount.textContent = totalQuestions;
    processedCount.textContent = '0';
    progressPercent.textContent = '0%';
    progressFill.style.width = '0%';

    showBulkUploadFeedback(`Starting upload of ${totalQuestions} questions...`, 'info');

    try {
        const BATCH_SIZE = 500;
        const userId = auth.currentUser?.uid;
        const timestamp = serverTimestamp();

        for (let i = 0; i < totalQuestions; i += BATCH_SIZE) {
            if (cancelUpload) break;

            const batch = writeBatch(db);
            const batchEnd = Math.min(i + BATCH_SIZE, totalQuestions);

            for (let j = i; j < batchEnd; j++) {
                const q = questions[j];
                const questionDoc = {
                    examType: q.examType,
                    subject: q.subject,
                    questionText: q.questionText,
                    options: {
                        A: q.optionA,
                        B: q.optionB,
                        C: q.optionC,
                        D: q.optionD
                    },
                    correctAnswer: q.correctAnswer,
                    solution: q.solution,
                    timeLimit: q.timeLimit,
                    questionType: 'text',
                    solutionType: q.solution ? 'text' : 'none',
                    createdAt: timestamp,
                    lastUpdated: timestamp,
                    createdBy: userId
                };

                const docRef = doc(collection(db, "questions"));
                batch.set(docRef, questionDoc);
            }

            await batch.commit();
            successful += (batchEnd - i);

            const progress = Math.round((successful / totalQuestions) * 100);
            processedCount.textContent = successful;
            progressPercent.textContent = `${progress}%`;
            progressFill.style.width = `${progress}%`;

            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (cancelUpload) {
            showBulkUploadFeedback('Upload cancelled', 'error');
        } else {
            showBulkUploadFeedback(`✅ Successfully uploaded ${successful} questions!`, 'success');
            
            bulkTextInput.value = '';
            textPreview.innerHTML = '';
            uploadTextBtn.disabled = true;
            
            loadQuestions(false);
        }

    } catch (error) {
        console.error('Text upload error:', error);
        showBulkUploadFeedback(`Error during upload: ${error.message}`, 'error');
    } finally {
        uploadInProgress = false;
        uploadTextBtn.disabled = false;
        uploadProgress.style.display = 'none';
    }
}

// ================= LOAD AND MANAGE QUESTIONS =================
let lastVisible = null;
let currentSearchTerm = "";

async function loadQuestions(loadMore = false, searchTerm = "") {
    try {
        let q;
        
        if (searchTerm) {
            q = query(
                collection(db, "questions"),
                orderBy("createdAt", "desc")
            );
        } else {
            q = query(
                collection(db, "questions"),
                orderBy("createdAt", "desc"),
                limit(10)
            );

            if (loadMore && lastVisible) {
                q = query(q, startAfter(lastVisible));
            }
        }

        const snapshot = await getDocs(q);

        if (!loadMore || searchTerm) {
            questionTableBody.innerHTML = "";
            lastVisible = null;
        }

        let questions = [];
        snapshot.forEach(docSnap => {
            if (!loadMore || searchTerm) {
                lastVisible = docSnap;
            }
            const qData = docSnap.data();
            questions.push({
                id: docSnap.id,
                ...qData
            });
        });

        // Apply search filter if search term exists
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            questions = questions.filter(q => 
                (q.subject && q.subject.toLowerCase().includes(searchLower)) ||
                (q.examType && q.examType.toLowerCase().includes(searchLower)) ||
                (q.questionText && q.questionText.toLowerCase().includes(searchLower)) ||
                (q.solution && q.solution.toLowerCase().includes(searchLower))
            );
        }

        // Display questions
        if (questions.length === 0) {
            questionTableBody.innerHTML = `
                <tr><td colspan="8" class="text-center">No questions found</td></tr>
            `;
            return;
        }

        questions.forEach(q => {
            const questionPreview = q.questionText ? (q.questionText.length > 40 
                ? q.questionText.substring(0, 40) + "..." 
                : q.questionText) : "[Image Question]";
            
            const displayPreview = formatTextForDisplay(questionPreview);
            const fullQuestionTooltip = formatTextForTooltip(q.questionText || "Image-based question");
            
            // Determine question type for display
            let typeBadge = '';
            const questionType = getQuestionType(q);
            if (questionType === 'text') {
                typeBadge = '<span class="question-type type-text">Text</span>';
            } else if (questionType === 'image') {
                typeBadge = '<span class="question-type type-image">Image</span>';
            } else if (questionType === 'both') {
                typeBadge = '<span class="question-type type-both">Both</span>';
            }
            
            questionTableBody.innerHTML += `
                <tr>
                    <td>${q.id.slice(0, 6)}...</td>
                    <td>${q.subject}</td>
                    <td>${q.examType}</td>
                    <td title="${fullQuestionTooltip}">${displayPreview}</td>
                    <td>${typeBadge}</td>
                    <td>${q.correctAnswer}</td>
                    <td>${q.timeLimit}s</td>
                    <td>
                        <div class="action-buttons">
                            <button class="action-btn edit-btn" onclick="editQuestion('${q.id}')" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="action-btn delete-btn" onclick="deleteQuestion('${q.id}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error loading questions:", error);
        questionTableBody.innerHTML = `
            <tr><td colspan="8" class="text-center">Error loading questions</td></tr>
        `;
    }
}

// Edit question function (global for onclick)
window.editQuestion = async (id) => {
    await loadQuestionForEdit(id);
};

// Delete question function (global for onclick)
window.deleteQuestion = async (id) => {
    if (!confirm("Are you sure you want to delete this question permanently?")) return;
    
    try {
        await deleteDoc(doc(db, "questions", id));
        formFeedback.textContent = "✅ Question deleted successfully";
        formFeedback.className = "feedback-message success";
        loadQuestions(false, currentSearchTerm);
    } catch (error) {
        console.error("Error deleting question:", error);
        formFeedback.textContent = "❌ Failed to delete question";
        formFeedback.className = "feedback-message error";
    }
};

// Search questions
searchBtn.addEventListener("click", () => {
    currentSearchTerm = questionSearch.value.trim();
    loadQuestions(false, currentSearchTerm);
});

questionSearch.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
        currentSearchTerm = questionSearch.value.trim();
        loadQuestions(false, currentSearchTerm);
    }
});

// Load more questions
loadMoreBtn.addEventListener("click", () => {
    if (!currentSearchTerm) {
        loadQuestions(true);
    }
});

// Initial load
loadQuestions();

// ================= STUDENT MANAGEMENT =================

// NEW: Function to change student plan
window.changeStudentPlan = async (userId, currentPlan) => {
    const newPlan = currentPlan === "free" ? "paid" : "free";
    const action = newPlan === "paid" ? "upgrade to paid" : "downgrade to free";
    
    if (!confirm(`Are you sure you want to ${action} this student?`)) return;
    
    try {
        const updateData = {
            plan: newPlan,
            subscriptionStatus: newPlan === "paid" ? "paid_tier" : "free_tier",
            subscriptionDate: serverTimestamp(),
            lastUpdated: serverTimestamp()
        };
        
        await updateDoc(doc(db, "users", userId), updateData);
        
        // Show success feedback
        const feedbackDiv = document.createElement("div");
        feedbackDiv.className = `feedback-message success`;
        feedbackDiv.textContent = `✅ Student ${action} successfully`;
        feedbackDiv.style.position = "fixed";
        feedbackDiv.style.top = "20px";
        feedbackDiv.style.right = "20px";
        feedbackDiv.style.zIndex = "1000";
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => feedbackDiv.remove(), 3000);
        
        // Reload students to reflect changes
        loadStudents();
    } catch (error) {
        console.error(`Error changing student plan:`, error);
        
        const feedbackDiv = document.createElement("div");
        feedbackDiv.className = `feedback-message error`;
        feedbackDiv.textContent = `❌ Failed to change student plan`;
        feedbackDiv.style.position = "fixed";
        feedbackDiv.style.top = "20px";
        feedbackDiv.style.right = "20px";
        feedbackDiv.style.zIndex = "1000";
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => feedbackDiv.remove(), 3000);
    }
};

// Load student data
async function loadStudents() {
    try {
        const snap = await getDocs(collection(db, "users"));
        let freeCount = 0;
        let premiumCount = 0;

        studentTableBody.innerHTML = "";

        if (snap.empty) {
            studentTableBody.innerHTML = `
                <tr><td colspan="9" class="text-center">No students found</td></tr>
            `;
            totalStudents.textContent = "0";
            freePlanStudents.textContent = "0";
            premiumPlanStudents.textContent = "0";
            return;
        }

        snap.forEach(docSnap => {
            const u = docSnap.data();
            const userId = docSnap.id;
            
            // Count plans
            if (u.plan === "free") freeCount++;
            if (u.plan === "paid" || u.plan === "premium") premiumCount++;
            
            // Format joined date
            let joinedDate = "-";
            if (u.createdAt) {
                const date = u.createdAt.toDate ? u.createdAt.toDate() : new Date(u.createdAt);
                joinedDate = date.toLocaleDateString('en-NG', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                });
            }
            
            // Format status
            const status = u.status || "active";
            const statusClass = status === "active" ? "status-active" : "status-inactive";
            
            // Format plan
            const plan = u.plan || "free";
            const planClass = plan === "paid" || plan === "premium" ? "plan-paid" : "plan-free";
            const planDisplay = plan === "paid" || plan === "premium" ? "Premium" : "Free";
            
            // Add row with new Change Plan column
            studentTableBody.innerHTML += `
                <tr>
                    <td>${u.fullName || u.displayName || "-"}</td>
                    <td>${u.email || "-"}</td>
                    <td>${u.phoneNumber || "-"}</td>
                    <td><span class="plan-badge ${planClass}">${planDisplay}</span></td>
                    <td>${joinedDate}</td>
                    <td>${u.testsTaken || 0}</td>
                    <td class="${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</td>
                    <td>
                        <div class="action-buttons">
                            ${status === "active" ? 
                                `<button class="action-btn deactivate-btn" onclick="toggleStudentStatus('${userId}', 'inactive')" title="Deactivate">
                                    <i class="fas fa-user-slash"></i>
                                </button>` : 
                                `<button class="action-btn activate-btn" onclick="toggleStudentStatus('${userId}', 'active')" title="Activate">
                                    <i class="fas fa-user-check"></i>
                                </button>`
                            }
                            <button class="action-btn delete-btn" onclick="deleteStudent('${userId}')" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                    <td>
                        <button class="change-plan-btn" onclick="changeStudentPlan('${userId}', '${plan}')" title="${plan === 'free' ? 'Upgrade to Paid' : 'Downgrade to Free'}">
                            <i class="fas ${plan === 'free' ? 'fa-crown' : 'fa-user-check'}"></i>
                            ${plan === 'free' ? 'Make Paid' : 'Make Free'}
                        </button>
                    </td>
                </tr>
            `;
        });

        totalStudents.textContent = snap.size;
        freePlanStudents.textContent = freeCount;
        premiumPlanStudents.textContent = premiumCount;

    } catch (error) {
        console.error("Error loading students:", error);
        studentTableBody.innerHTML = `
            <tr><td colspan="9" class="text-center">Error loading students</td></tr>
        `;
    }
}

// Toggle student status (activate/deactivate)
window.toggleStudentStatus = async (userId, newStatus) => {
    const action = newStatus === "active" ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${action} this student?`)) return;
    
    try {
        await updateDoc(doc(db, "users", userId), {
            status: newStatus,
            lastUpdated: serverTimestamp()
        });
        
        const feedbackDiv = document.createElement("div");
        feedbackDiv.className = `feedback-message success`;
        feedbackDiv.textContent = `✅ Student ${action}d successfully`;
        feedbackDiv.style.position = "fixed";
        feedbackDiv.style.top = "20px";
        feedbackDiv.style.right = "20px";
        feedbackDiv.style.zIndex = "1000";
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => feedbackDiv.remove(), 3000);
        
        loadStudents();
    } catch (error) {
        console.error(`Error ${action}ing student:`, error);
        alert(`Failed to ${action} student`);
    }
};

// Delete student permanently
window.deleteStudent = async (userId) => {
    if (!confirm("WARNING: This will permanently delete the student and all their data. Are you sure?")) return;
    
    try {
        await deleteDoc(doc(db, "users", userId));
        
        const feedbackDiv = document.createElement("div");
        feedbackDiv.className = `feedback-message success`;
        feedbackDiv.textContent = "✅ Student deleted successfully";
        feedbackDiv.style.position = "fixed";
        feedbackDiv.style.top = "20px";
        feedbackDiv.style.right = "20px";
        feedbackDiv.style.zIndex = "1000";
        document.body.appendChild(feedbackDiv);
        
        setTimeout(() => feedbackDiv.remove(), 3000);
        
        loadStudents();
    } catch (error) {
        console.error("Error deleting student:", error);
        alert("Failed to delete student");
    }
};

// Initial load of students
loadStudents();

// ================= LOGOUT =================
logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
});