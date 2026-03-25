// Import the functions you need from the SDKs you need
 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";

import { getAuth } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

import { getFirestore } 
from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";



// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
export const db = getFirestore(app);
export const auth = getAuth(app);

// ===== SERVICE WORKER REGISTRATION =====
// Register service worker with version tracking
if ('serviceWorker' in navigator) {
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('SW registered');
      
      // Check for updates every 30 seconds (optional)
      setInterval(() => {
        registration.update();
      }, 30000);
      
      // Handle controller changes (new version activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
      
    } catch (error) {
      console.error('SW registration failed:', error);
    }
  };
  
  registerSW();
}