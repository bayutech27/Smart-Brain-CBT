// script.js - UI Logic for Auth and Mobile Menu
// This file handles ONLY UI interactions

import { auth } from "./main.js";
import { signOut } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-auth.js";

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('📄 script.js loaded');
  
  // Wait for auth to be ready
  if (!auth) {
    console.error('❌ Auth not available!');
    return;
  }

  // ----- Auth UI Elements -----
  const loginButtons = document.querySelectorAll('.btn-login');
  const homeIcons = document.querySelectorAll('.desktop-nav-link i.fa-home, .nav-link i.fa-home');

  /**
   * Update UI based on authentication state
   */
  function updateUI(user) {
    console.log('🔄 Updating UI, user logged in:', !!user);
    
    // Update login/logout buttons
    loginButtons.forEach(btn => {
      if (user) {
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> Logout';
        btn.href = '#';
        if (!btn.dataset.logoutListener) {
          btn.addEventListener('click', handleLogout);
          btn.dataset.logoutListener = 'true';
        }
      } else {
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
        btn.href = 'login.html';
        if (btn.dataset.logoutListener) {
          btn.removeEventListener('click', handleLogout);
          btn.dataset.logoutListener = '';
        }
      }
    });

    // Update home links
    homeIcons.forEach(icon => {
      const link = icon.closest('a');
      if (link) {
        if (user) {
          link.innerHTML = '<i class="fas fa-home"></i> Dashboard';
          link.href = 'dashboard.html';
        } else {
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
      localStorage.removeItem('userPlan');
      console.log('✅ Logout successful');
      window.location.href = 'index.html';
    } catch (error) {
      console.error('❌ Logout error:', error);
      alert('Failed to log out. Please try again.');
    }
  }

  // Listen to Firebase auth state changes
  auth.onAuthStateChanged((user) => {
    console.log('🔥 Auth state changed:', user ? `User: ${user.uid}` : 'No user');
    updateUI(user);
  });

  // ------------------------------------------------------------------
  // Mobile Menu & Scroll Functionality (unchanged from your working code)
  // ------------------------------------------------------------------
  const hamburger = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');
  const navLinks = document.querySelectorAll('.nav-link');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      hamburger.classList.toggle('active');
      mobileMenu.classList.toggle('active');
      document.body.style.overflow = mobileMenu.classList.contains('active') ? 'hidden' : '';
    });

    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      });
    });
  }

  const desktopNavLinks = document.querySelectorAll('.desktop-nav-link');
  desktopNavLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu && mobileMenu.classList.contains('active')) {
        hamburger.classList.remove('active');
        mobileMenu.classList.remove('active');
        document.body.style.overflow = '';
      }

      if (!link.classList.contains('btn-login')) {
        desktopNavLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  });

  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
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