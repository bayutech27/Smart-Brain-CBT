// auth.js - Fixed Authentication with Strict Plan Enforcement
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
        const userData = userSnap.data();
        const role = userData.role || "student";
        const plan = userData.plan || "free";
        
        console.log("Redirect check - Role:", role, "Plan:", plan);
        
        if (role === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "dashboard.html";
        }
      } else {
        console.log("No user document found, creating one...");
        // Create basic user document if missing
        await setDoc(doc(db, "users", userId), {
          uid: userId,
          email: auth.currentUser?.email || "",
          role: "student",
          plan: "free",
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        });
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
    
    // Get form values
    const userFirstName = firstName ? firstName.value.trim() : "";
    const userLastName = lastName ? lastName.value.trim() : "";
    const userEmail = signUpEmail ? signUpEmail.value.trim().toLowerCase() : "";
    const userPhone = phoneNumber ? phoneNumber.value.trim() : "";
    const userPassword = signUpPassword ? signUpPassword.value : "";
    
    console.log("=== SIGN UP ATTEMPT ===");
    console.log("Name:", userFirstName, userLastName);
    console.log("Email:", userEmail);
    console.log("Phone:", userPhone);
    console.log("Password length:", userPassword.length);
    console.log("Plan will be: free");

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
        console.log("✅ User profile updated with display name:", fullName);
      } catch (profileError) {
        console.warn("⚠️ Could not update display name:", profileError);
      }

      // 4. Save user data to Firestore - STRICTLY SET PLAN TO "free"
      console.log("Step 3: Preparing user data for Firestore...");
      
      const userData = {
        uid: user.uid,
        firstName: userFirstName,
        lastName: userLastName,
        fullName: fullName,
        email: userEmail.toLowerCase(),
        phoneNumber: userPhone,
        role: "student", // Strictly student role
        plan: "free",    // Strictly free plan - NO OTHER OPTIONS
        subscriptionDate: serverTimestamp(),
        testsTaken: 0,
        totalTestsTaken: 0,
        testsTakenThisWeek: 0,
        lastTestResetDate: serverTimestamp(),
        averageScore: 0,
        status: "active",
        profilePicture: "",
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      };

      console.log("User data to save - VERIFY PLAN:", userData.plan);
      console.log("Full user data:", userData);
      
      // Get the Firestore document reference
      const userDocRef = doc(db, "users", user.uid);
      console.log("Firestore document path:", userDocRef.path);
      
      console.log("Step 4: Saving to Firestore...");
      // Save to Firestore
      await setDoc(userDocRef, userData);
      console.log("✅ SUCCESS: User data saved to Firestore!");
      console.log("✅ PLAN CONFIRMED: 'free'");
      
      // Verify the document was created
      const verifyDoc = await getDoc(userDocRef);
      if (verifyDoc.exists()) {
        const savedData = verifyDoc.data();
        console.log("✅ VERIFIED: Document exists in Firestore!");
        console.log("✅ PLAN VERIFICATION: Saved plan is", savedData.plan);
        
        if (savedData.plan !== "free") {
          console.error("❌ CRITICAL: Plan is not 'free'! Actual plan:", savedData.plan);
          alert("❌ CRITICAL ERROR: User plan not set correctly. Please contact support.");
          return;
        }
      } else {
        console.error("❌ ERROR: Document verification failed!");
      }

      // 5. Show success message and redirect
      console.log("Step 5: Success - redirecting to dashboard...");
      alert(`🎉 Account created successfully!\n\nWelcome ${fullName}!\n\nYour account is on the FREE plan.`);
      
      // Clear form
      if (firstName) firstName.value = "";
      if (lastName) lastName.value = "";
      if (signUpEmail) signUpEmail.value = "";
      if (phoneNumber) phoneNumber.value = "";
      if (signUpPassword) signUpPassword.value = "";
      
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
        errorMessage = "❌ PERMISSION DENIED\n\nFirestore security rules are blocking user creation.\n\nCheck console for details.";
      }
      
      alert(`❌ ${errorMessage}`);
      
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
      console.log("Auth displayName:", user.displayName);

      // FETCH USER DATA FROM FIRESTORE - STRICT OWNERSHIP
      console.log("Fetching user data from Firestore...");
      const userDocRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userDocRef);

      if (userSnap.exists()) {
        const userData = userSnap.data();
        const role = userData.role || "student";
        const plan = userData.plan || "free";
        const fullName = userData.fullName || user.displayName || userData.firstName + " " + userData.lastName || "Student";
        
        console.log("✅ User data found in Firestore - VERIFICATION:");
        console.log("- UID in document:", userData.uid);
        console.log("- Name:", fullName);
        console.log("- Role:", role);
        console.log("- Plan:", plan);
        console.log("- Email:", userData.email);
        
        // SECURITY CHECK: Verify the document belongs to this user
        if (userData.uid !== user.uid) {
          console.error("❌ SECURITY ALERT: Document UID doesn't match auth UID!");
          alert("❌ Security error detected. Please contact support.");
          await signOut(auth);
          return;
        }
        
        // PLAN VERIFICATION: Must be either "free" or undefined (defaults to free)
        if (plan !== "free") {
          console.warn("⚠️ User has non-free plan:", plan);
        }

        // Update last login time
        try {
          await setDoc(userDocRef, {
            lastLogin: serverTimestamp()
          }, { merge: true });
          console.log("Last login updated");
        } catch (firestoreError) {
          console.warn("Could not update last login time:", firestoreError);
        }

        // WELCOME MESSAGE WITH PLAN INFO
        const welcomeMessage = role === "admin" 
          ? `👋 Welcome back, Admin ${fullName}!` 
          : `👋 Welcome back, ${fullName}!`;
        
        console.log("Redirecting user...");
        alert(welcomeMessage);
        
        // REDIRECT BASED ON ROLE
        if (role === "admin") {
          window.location.href = "admin.html";
        } else {
          window.location.href = "dashboard.html";
        }
      } else {
        console.error("❌ User document does not exist in Firestore");
        
        // Create minimal user document if it doesn't exist (should not happen for existing users)
        console.log("Creating missing user document in Firestore...");
        const userData = {
          uid: user.uid,
          email: userEmail,
          fullName: user.displayName || "Student",
          role: "student",
          plan: "free", // Strictly free
          testsTaken: 0,
          averageScore: 0,
          status: "active",
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp()
        };
        
        await setDoc(doc(db, "users", user.uid), userData);
        alert("✅ Your account has been set up. You're on the FREE plan.\n\nRedirecting to dashboard...");
        window.location.href = "dashboard.html";
      }

      // Clear form
      if (loginEmail) loginEmail.value = "";
      if (loginPassword) loginPassword.value = "";

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
      console.log("User logged out successfully");
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

  console.log("✅ Auth.js loaded successfully with strict plan enforcement");
});