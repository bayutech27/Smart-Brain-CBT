// js/script.js – Handles auth UI (login/logout + home/dashboard toggle) and mobile menu

// Import as named exports (matching main.js)
import { auth } from "./main.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 script.js loaded, auth available:', !!auth);
  
  // ----- Auth UI Elements -----
  const loginButtons = document.querySelectorAll('.btn-login');
  const homeIcons = document.querySelectorAll('.desktop-nav-link i.fa-home, .nav-link i.fa-home');

  /**
   * Update UI based on authentication state
   * @param {Object|null} user - Firebase user or null
   */
  function updateUI(user) {
    console.log('🔄 Updating UI, user logged in:', !!user);
    
    // 1. Update login/logout buttons
    loginButtons.forEach(btn => {
      if (user) {
        // Logged in → show "Logout"
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        btn.href = '#';
        if (!btn.dataset.logoutListener) {
          btn.addEventListener('click', handleLogout);
          btn.dataset.logoutListener = 'true';
        }
      } else {
        // Logged out → show "Login"
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        btn.href = 'login.html';
        if (btn.dataset.logoutListener) {
          btn.removeEventListener('click', handleLogout);
          btn.dataset.logoutListener = '';
        }
      }
    });

    // 2. Update home links → Dashboard when logged in, Home when logged out
    homeIcons.forEach(icon => {
      const link = icon.closest('a');
      if (link) {
        if (user) {
          // Logged in: change text to "Dashboard" and link to dashboard.html
          link.innerHTML = '<i class="fas fa-home"></i> Dashboard';
          link.href = 'dashboard.html';
        } else {
          // Logged out: revert to "Home" and link to "#"
          link.innerHTML = '<i class="fas fa-home"></i> Home';
          link.href = '#';
        }
      }
    });
  }

  /**
   * Logout handler
   */
  async function handleLogout(e) {
    e.preventDefault();
    console.log('🚪 Logging out...');
    try {
      await signOut(auth);
      sessionStorage.clear();
      localStorage.removeItem('userPlan'); // Clear any stored plan data
      console.log('✅ Logout successful');
      // Redirect to home page after logout
      window.location.href = 'index.html';
    } catch (error) {
      console.error('❌ Logout error:', error);
      alert('Failed to log out. Please try again.');
    }
  }

  // Check if auth is available before using it
  if (auth) {
    // Listen to Firebase auth state changes
    auth.onAuthStateChanged((user) => {
      console.log('🔥 Auth state changed:', user ? `User: ${user.uid}` : 'No user');
      updateUI(user);
    });
  } else {
    console.error('❌ Auth not available! Check main.js exports');
  }

  // ------------------------------------------------------------------
  // Mobile Menu & Scroll Functionality
  // ------------------------------------------------------------------
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  // Toggle mobile menu
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    // Close mobile menu when clicking on links
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  // Close mobile menu when clicking desktop nav links
  const desktopNavLinks = document.querySelectorAll('.desktop-nav-link');
  desktopNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu && mobileMenu.classList.contains('active')) {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      }

      // Handle active state for desktop nav (except login button)
      if (!link.classList.contains('btn-login')) {
        desktopNavLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  // Smooth scrolling for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      // If the href doesn't start with '#', let the browser navigate normally
      if (!this.getAttribute('href').startsWith('#')) return;

      e.preventDefault();

      const targetId = this.getAttribute('href');
      if (targetId === '#') return;

      const targetElement = document.querySelector(targetId);
      if (targetElement) {
        const headerHeight = document.querySelector('.header').offsetHeight;
        const targetPosition = targetElement.offsetTop - headerHeight - 20;

        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth'
        });
      }
    });
  });

  // Update active nav link on scroll
  window.addEventListener('scroll', () => {
    let current = '';
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 100;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.clientHeight;

      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute('id');
      }
    });

    desktopNavLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
});