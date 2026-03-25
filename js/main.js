// main.js - Firebase Configuration and Initialization
// This file ONLY handles Firebase setup - no DOM manipulation or service workers

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzrsl2-KSLVplg34CXebvyuml64mic6jE",
  authDomain: "smart-brain-cbt.firebaseapp.com",
  projectId: "smart-brain-cbt",
  storageBucket: "smart-brain-cbt.firebasestorage.app",
  messagingSenderId: "570968882253",
  appId: "1:570968882253:web:4f6c0b284ce1dc25e07004",
  measurementId: "G-EGP4C5HCJP"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
const auth = getAuth(app);
const db = getFirestore(app);

// Export ONLY the initialized services
export { auth, db };