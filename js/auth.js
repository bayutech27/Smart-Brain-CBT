// auth.js - Fixed Authentication Code with Working Show Password
import { db, auth } from "./main.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

import { 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.8.0/firebase-firestore.js";

//====WAITING FOR THE DOM TO GET READY====
document.addEventListener("DOMContentLoaded", () => {
  //======Grabbing the ID's=====
  const firstName = document.getElementById('firstName');
  const lastName = document.getElementById('lastName');
  const loginEmail = document.getElementById('loginEmail');
  const phoneNumber = document.getElementById('phoneNumber');
  const loginPassword = document.getElementById('loginPassword');
  const loginBtn = document.getElementById('loginBtn');
  const signUpEmail = document.getElementById('signUpEmail');
  const signUpPassword = document.getElementById('signUpPassword');
  const signUpBtn = document.getElementById('signUpBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const resetEmail = document.getElementById('resetEmail');
  const resetPasswordBtn = document.getElementById('resetPasswordBtn');
  const showPassword = document.getElementById('showPassword');

  console.log("=== AUTH.JS LOADED ===");

  // ===== AUTH STATE =====
  onAuthStateChanged(auth, (user) => {
    const path = window.location.pathname;

    if (user) {
      console.log("Auth state changed - User logged in:", user.uid);
      if (path.includes("login.html") || path.includes("signup.html")) {
        checkUserRoleAndRedirect(user.uid);
      }
    } else {
      console.log("Auth state changed - User logged out");
      if (path.includes("dashboard.html") || path.includes("admin.html") || path.includes("test.html")) {
        window.location.href = "index.html";
      }
    }
  });

  // Check user role and redirect
  async function checkUserRoleAndRedirect(userId) {
    try {
      const userDocRef = doc(db, "users", userId);
      const userSnap = await getDoc(userDocRef);
      
      if (userSnap.exists()) {
        const role = userSnap.data().role;
        if (role === "admin") {
          window.location.href = "admin.html";
        } else if (role === "student") {
          window.location.href = "dashboard.html";
        }
      } else {
        window.location.href = "dashboard.html";
      }
    } catch (error) {
      console.error("Error checking user role:", error);
      window.location.href = "dashboard.html";
    }
  }

  //=====PASSWORD VALIDATION FUNCTION====
  const passwordSymbols = ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "_", "+", "-", "=", "?", ".", ",", ":", ";", "~", "`", "|", "\\", "/", "'", "\""];

  function validatePassword(password) {
    if (!password || password.length < 8) {
      return "Password must be at least 8 characters long";
    }
    if (!/[A-Z]/.test(password)) {
      return "Password must contain at least one uppercase letter";
    }
    if (!/[a-z]/.test(password)) {
      return "Password must contain at least one lowercase letter";
    }
    if (!/[0-9]/.test(password)) {
      return "Password must contain at least one number";
    }
    const hasSymbol = passwordSymbols.some(symbol => password.includes(symbol));
    if (!hasSymbol) {
      return "Password must contain at least one special character";
    }
    return "VALID";
  }

  // ===== SIGN UP =====
  const userSignUp = async (e) => {
    e.preventDefault();
    
    // Get form values - FIXED VARIABLE NAME
    const userFirstName = firstName ? firstName.value.trim() : "";
    const userLastName = lastName ? lastName.value.trim() : "";
    const userEmail = signUpEmail ? signUpEmail.value.trim().toLowerCase() : "";
    const userPhone = phoneNumber ? phoneNumber.value.trim() : ""; // FIXED: Changed variable name
    const userPassword = signUpPassword ? signUpPassword.value : "";
    
    console.log("=== SIGN UP ATTEMPT ===");
    console.log("Name:", userFirstName, userLastName);
    console.log("Email:", userEmail);
    console.log("Phone:", userPhone);
    console.log("Password length:", userPassword.length);

    // Validate inputs
    if (!userFirstName || !userLastName) {
      alert("Please enter your first and last name");
      return;
    }
    
    if (!userEmail) {
      alert("Please enter your email address");
      return;
    }
    
    if (!userPhone) {
      alert("Please enter your phone number");
      return;
    }
    
    if (!userPassword) {
      alert("Please enter a password");
      return;
    }

    // Validate password
    const passwordValidation = validatePassword(userPassword);
    if (passwordValidation !== "VALID") {
      alert(passwordValidation);
      return;
    }

    let user = null;

    try {
      console.log("Step 1: Creating user in Firebase Auth...");
      
      // 1. Create user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(auth, userEmail, userPassword);
      user = userCredential.user;
      
      console.log("✅ User created in Auth. UID:", user.uid);

      // 2. Create display name
      const fullName = `${userFirstName} ${userLastName}`;
      
      console.log("Step 2: Updating user profile with display name...");
      // 3. Update user profile with display name
      try {
        await updateProfile(user, {
          displayName: fullName
        });
        console.log("✅ User profile updated with display name");
      } catch (profileError) {
        console.warn("⚠️ Could not update display name:", profileError);
      }

      // 4. Save user data to Firestore
      console.log("Step 3: Preparing user data for Firestore...");
      
      const userData = {
        uid: user.uid,
        firstName: userFirstName,
        lastName: userLastName,
        fullName: fullName,
        email: userEmail.toLowerCase(),
        phoneNumber: userPhone, // FIXED: Using correct variable name
        role: "student",
        plan: "free",
        testsTaken: 0,
        averageScore: 0,
        status: "active",
        profilePicture: "",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };

      console.log("User data to save:", userData);
      
      // Get the Firestore document reference
      const userDocRef = doc(db, "users", user.uid);
      console.log("Firestore document path:", userDocRef.path);
      
      console.log("Step 4: Saving to Firestore...");
      // Save to Firestore
      await setDoc(userDocRef, userData);
      console.log("✅ SUCCESS: User data saved to Firestore!");
      
      // Verify the document was created
      const verifyDoc = await getDoc(userDocRef);
      if (verifyDoc.exists()) {
        console.log("✅ VERIFIED: Document exists in Firestore!");
        console.log("Document data:", verifyDoc.data());
      } else {
        console.error("❌ ERROR: Document verification failed!");
      }

      // 5. Show success message and redirect
      console.log("Step 5: Success - redirecting to dashboard...");
      alert(`🎉 Account created successfully!\n\nWelcome ${fullName}!`);
      
      // Redirect to dashboard
      window.location.href = "dashboard.html";

    } catch (error) {
      console.error("=== SIGNUP FAILED ===");
      console.error("Error code:", error.code);
      console.error("Error message:", error.message);
      
      // Clean up: If user was created in Auth but Firestore failed, delete the Auth user
      if (user) {
        console.log("Cleaning up: Deleting Auth user due to Firestore failure...");
        try {
          await user.delete();
          console.log("Auth user deleted");
        } catch (deleteError) {
          console.error("Failed to delete Auth user:", deleteError);
        }
      }
      
      // Show user-friendly error messages
      let errorMessage = "An error occurred during sign up. Please try again.";
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = "This email is already registered. Please use a different email or try logging in.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address. Please enter a valid email.";
      } else if (error.code === 'auth/weak-password') {
        errorMessage = "Password is too weak. Please choose a stronger password.";
      } else if (error.code === 'auth/operation-not-allowed') {
        errorMessage = "Email/password accounts are not enabled. Please contact support.";
      } else if (error.code === 'permission-denied') {
        errorMessage = "❌ PERMISSION DENIED\n\nFirestore security rules are blocking user creation.\n\nPlease check your Firestore rules to allow users to write to their own document in the 'users' collection.";
      }
      
      alert(`❌ ${errorMessage}\n\nCheck browser console (F12) for details.`);
      
      // Reset password field
      if (signUpPassword) signUpPassword.value = "";
    }
  };

  // ===== LOGIN =====
  const userLogin = async (e) => {
    if (e) e.preventDefault();
    
    const userEmail = loginEmail ? loginEmail.value.trim().toLowerCase() : "";
    const userPassword = loginPassword ? loginPassword.value : "";
    
    console.log("=== LOGIN ATTEMPT ===");
    console.log("Email:", userEmail);

    // Validate inputs
    if (!userEmail || !userPassword) {
      alert("Please enter both email and password");
      return;
    }

    try {
      console.log("Attempting to sign in...");
      
      const userCredential = await signInWithEmailAndPassword(auth, userEmail, userPassword);
      const user = userCredential.user;
      
      console.log("✅ User authenticated. UID:", user.uid);

      // Update last login time
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          lastLogin: serverTimestamp()
        }, { merge: true });
        console.log("Last login updated");
      } catch (firestoreError) {
        console.warn("Could not update last login time:", firestoreError);
      }

      // FETCH ROLE FROM FIRESTORE
      console.log("Fetching user data from Firestore...");
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const role = userData.role;
        
        console.log("✅ User data found in Firestore:", userData);
        console.log("User role:", role);

        // REDIRECT BASED ON ROLE
        if (role === "admin") {
          alert(`👋 Welcome back, Admin ${userData.fullName || ''}!`);
          window.location.href = "admin.html";
        } else if (role === "student") {
          alert(`👋 Welcome back, ${userData.fullName || 'Student'}!`);
          window.location.href = "dashboard.html";
        } else {
          alert("⚠️ Role not recognized. Defaulting to student dashboard.");
          window.location.href = "dashboard.html";
        }
      } else {
        console.error("❌ User document does not exist in Firestore");
        
        // Create user document if it doesn't exist
        console.log("Creating missing user document in Firestore...");
        const userData = {
          uid: user.uid,
          email: userEmail,
          fullName: user.displayName || "Student",
          role: "student",
          plan: "free",
          testsTaken: 0,
          averageScore: 0,
          status: "active",
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        };
        
        await setDoc(doc(db, "users", user.uid), userData);
        alert("✅ Account profile created. Redirecting to dashboard...");
        window.location.href = "dashboard.html";
      }

    } catch (error) {
      console.error("Login error:", error);
      console.error("Error code:", error.code);
      
      let errorMessage = "Email or password is incorrect.";
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = "No account found with this email. Please sign up first.";
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = "Incorrect password. Please try again.";
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = "This account has been disabled. Please contact support.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = "Too many failed attempts. Please try again later.";
      } else if (error.code === 'permission-denied') {
        errorMessage = "Database permission error. Please contact support.";
      }
      
      alert(`❌ ${errorMessage}`);
      
      // Clear password field on error
      if (loginPassword) loginPassword.value = "";
    }
  };

  // ===== LOGOUT =====
  const userLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = "index.html";
    } catch (error) {
      console.error("Logout error:", error);
      alert("Error logging out. Please try again.");
    }
  };

  //======RESET PASSWORD=======
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener("click", async (e) => {
      e.preventDefault();
      
      const email = resetEmail ? resetEmail.value.trim() : "";
      
      if (!email) {
        alert("Please enter your email address");
        return;
      }

      try {
        await sendPasswordResetEmail(auth, email);
        alert("✅ Password reset link sent to your email. Check your inbox (and spam folder).");
        if (resetEmail) resetEmail.value = "";
      } catch (error) {
        console.error("Reset error:", error);
        
        let errorMessage = "Failed to send reset email. Please try again.";
        
        if (error.code === 'auth/user-not-found') {
          errorMessage = "No account found with this email.";
        } else if (error.code === 'auth/invalid-email') {
          errorMessage = "Invalid email address.";
        }
        
        alert(`❌ ${errorMessage}`);
      }
    });
  }

  // Attach event listeners
  if (signUpBtn) {
    signUpBtn.addEventListener("click", userSignUp);
  }
  
  if (loginBtn) {
    loginBtn.addEventListener("click", userLogin);
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener("click", userLogout);
  }

  //====SHOW PASSWORD====
  if (showPassword) {
    showPassword.addEventListener("change", () => {
      const isChecked = showPassword.checked;
      const currentPage = window.location.pathname;
      
      if (currentPage.includes('signup')) {
        if (signUpPassword) {
          signUpPassword.type = isChecked ? "text" : "password";
        }
      } else if (currentPage.includes('login')) {
        if (loginPassword) {
          loginPassword.type = isChecked ? "text" : "password";
        }
      }
    });
  }

  console.log("✅ Auth.js loaded successfully");
});