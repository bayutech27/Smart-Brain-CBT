# Smart Brain CBT

*A Cloud-Based Intelligent Practice & Examination Platform*

------------------------------------------------------------------------

## 1. Overview

**Smart Brain CBT** is a web-based Computer-Based Testing (CBT) platform
built to help secondary school students prepare effectively for
objective examinations such as WAEC and NECO.

The platform provides structured, timed, multiple-choice examinations
with intelligent scoring, performance tracking, subscription control,
and solution explanations --- all powered by a scalable cloud backend.

Smart Brain CBT is designed to:

-   Simulate real exam conditions\
-   Improve student speed and accuracy\
-   Provide immediate performance feedback\
-   Track academic progress over time\
-   Offer a flexible Free and Premium subscription model

------------------------------------------------------------------------

## 2. Technology Stack

### Frontend

-   HTML5\
-   CSS3\
-   Vanilla JavaScript

### Backend & Infrastructure

-   Firebase Authentication\
-   Firebase Firestore\
-   Vercel Hosting\
-   Firebase Security Rules

------------------------------------------------------------------------

## 3. Core Functionalities

### 3.1 Authentication System

-   Email/password registration\
-   Email verification\
-   Secure login/logout\
-   Personalized dashboard (student's full name displayed)

------------------------------------------------------------------------

### 3.2 Exam Selection Flow

Once a student logs in:

1.  Student selects exam type and subject.\
2.  System validates subscription plan and weekly limits.\
3.  If valid → Exam session begins.

------------------------------------------------------------------------

### 3.3 Question Selection Algorithm

When a student starts a test:

1.  All questions for the selected subject are retrieved from
    Firestore.\
2.  Questions are shuffled randomly.\
3.  20 questions are selected from the shuffled pool.\
4.  Countdown timer is initialized to 20 minutes (1200 seconds).

------------------------------------------------------------------------

### 3.4 Test Session Logic

-   20 multiple-choice questions\
-   4 options per question\
-   Navigation between questions allowed\
-   Answers can be changed before submission\
-   Progress tracker displays answered and remaining questions

------------------------------------------------------------------------

### 3.5 Auto-Submission

-   If timer reaches zero → Automatic submission\
-   If student clicks submit → Manual submission

After submission: - Score calculated\
- Results stored in Firestore\
- Dashboard updated\
- Detailed result page displayed

------------------------------------------------------------------------

### 3.6 Scoring System

Each correct answer earns 1 mark.

Final percentage:

    percentage = (score / 20) * 100

------------------------------------------------------------------------

### 3.7 Result System

After submission:

-   Score displayed\
-   Percentage shown\
-   Correct answers indicated\
-   Student's answers highlighted\
-   Detailed solution explanations (Premium only)

------------------------------------------------------------------------

### 3.8 Dashboard Analytics

Dashboard displays:

-   Total tests taken\
-   Average score (%)\
-   Current subscription plan\
-   Days remaining for renewal\
-   6 most recent test results

Average Score Calculation:

    average = (sum of all test percentages) / total tests

------------------------------------------------------------------------

## 4. Subscription Model

### 4.1 Free Plan

-   Maximum 3 tests per week\
-   Only 2 limited subjects\
-   No detailed explanations\
-   Weekly reset after 7 days

Restriction Logic:

    If testsTakenThisWeek >= 3 → Block access

------------------------------------------------------------------------

### 4.2 Premium Plan

-   Valid for 30 days\
-   Unlimited tests\
-   All subjects unlocked\
-   Access to detailed explanations

Expiration Logic:

    If currentDate > subscriptionEndDate → Revert to Free plan

------------------------------------------------------------------------

## 5. Payment System

### Current (Manual Upgrade)

Online: 1. Student clicks payment button\
2. Payment completed\
3. Student contacts admin\
4. Admin manually upgrades account for 30 days

Offline: - Payment made directly\
- Admin upgrades manually

### Future Upgrade

-   Automated payment verification\
-   Auto-upgrade after payment confirmation

------------------------------------------------------------------------

## 6. Database Structure (Simplified)

### Users Collection

    users/{userId}
        firstName
        email
        plan
        subscriptionStartDate
        subscriptionEndDate
        totalTests
        weeklyTestCount

### Questions Collection

    questions/{subject}/{questionId}
        questionText
        options[]
        correctAnswer
        explanation

### Results Collection

    results/{userId}/{testId}
        subject
        score
        percentage
        timestamp
        answers[]

------------------------------------------------------------------------

## 7. Challenges Encountered & Overcome

-   Ensuring fair randomization of questions\
-   Handling timer accuracy\
-   Enforcing subscription restrictions securely\
-   Managing automatic plan expiration\
-   Preventing score manipulation

------------------------------------------------------------------------

## 8. Educational Impact

Smart Brain CBT:

-   Builds exam confidence\
-   Improves time management\
-   Encourages consistent practice\
-   Provides measurable academic growth\
-   Simulates real CBT exam conditions

------------------------------------------------------------------------

## 9. Future Improvements

-   Mobile APK deployment\
-   Automatic payment verification\
-   AI-powered performance analytics\
-   Weak-topic detection\
-   Leaderboard system\
-   School & parent dashboards

------------------------------------------------------------------------

## 10. Vision

To build Nigeria's most intelligent CBT preparation ecosystem that
transforms how students prepare for standardized examinations.

------------------------------------------------------------------------

## Author: Bayo Alabi

Built independently using:

-   HTML\
-   CSS\
-   JavaScript\
-   Firebase

Designed and architected as a scalable cloud-based CBT solution.
