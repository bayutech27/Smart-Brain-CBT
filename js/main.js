// Import the functions you need from the SDKs you need
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

// Export as named exports (matching the import in script.js)
export const auth = getAuth(app);
export const db = getFirestore(app);

// ===== SERVICE WORKER REGISTRATION =====
// Register service worker with version tracking
if ('serviceWorker' in navigator) {
  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('✅ SW registered successfully');
      
      // Check for updates every 30 seconds
      setInterval(() => {
        registration.update();
        console.log('🔄 Checking for SW updates...');
      }, 30000);
      
      // Handle controller changes (new version activated)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('🔄 New SW version activated, reloading...');
          window.location.reload();
        }
      });
      
    } catch (error) {
      console.error('❌ SW registration failed:', error);
    }
  };
  
  // Wait for page to load before registering SW
  window.addEventListener('load', registerSW);
}