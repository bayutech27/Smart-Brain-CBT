// loading.js — unified loading utilities with safe DOM access.
//
// Provides three tiers of loading UX:
//   1. Button loading       — showLoading(btn) / hideLoading(btn)
//   2. Fullscreen loader    — showFullscreenLoader() / hideFullscreenLoader()
//   3. Overlay loader       — showOverlayLoader() / hideOverlayLoader()
//
// NEW in this revision:
//   • Pre-paint auto-boot. If the hosting page includes a preboot element
//     (#acadexFullscreenLoaderGlobal with class "active"), loading.js adopts
//     it on import — no flicker, no re-render — and starts managing it.
//     Pages that don't include the preboot element are completely unaffected.
//   • markPageReady() / pageReady() — call after Firestore data is loaded and
//     rendered to dismiss the loader with a small minimum-display window.
//   • Listens for the `acadex:ready` window event — same effect as
//     markPageReady(), so inline fallbacks can signal without importing.
//   • Fully responsive spinner / label / failsafe (fluid clamp() sizing plus a
//     landscape-phone height media query). No fixed pixel breakpoints.
//   • All previously exported functions keep the exact same signature and
//     behaviour. Purely additive.

// ============================================================================
// CONSTANTS
// ============================================================================

const LOADER_CSS_ID = 'acadex-loader-styles';
const FULLSCREEN_ELEMENT_ID = 'acadexFullscreenLoaderGlobal';
const OVERLAY_ELEMENT_ID = 'acadexOverlayLoaderGlobal';

const PAGE_READY_EVENT = 'acadex:ready';

// ============================================================================
// CSS INJECTION (runs once per page; skipped if <style id> already present)
// ============================================================================

function ensureLoaderStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(LOADER_CSS_ID)) return;

  const style = document.createElement('style');
  style.id = LOADER_CSS_ID;
  style.textContent = `
    /* ── Fullscreen loader ── */
    .acadex-fs-loader {
      position: fixed;
      inset: 0;
      background: rgba(242, 242, 247, 0.94);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
      z-index: 9998;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(0.75rem, 3vw, 1.15rem);
      padding: clamp(1rem, 4vw, 2rem);
      box-sizing: border-box;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.35s ease, visibility 0.35s ease;
      -webkit-tap-highlight-color: transparent;
      will-change: opacity;
    }
    .acadex-fs-loader.active {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    /* ── Overlay loader ── */
    .acadex-ov-loader {
      position: fixed;
      inset: 0;
      background: rgba(255, 255, 255, 0.55);
      -webkit-backdrop-filter: blur(3px);
      backdrop-filter: blur(3px);
      z-index: 9997;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(0.6rem, 2.5vw, 0.85rem);
      padding: clamp(1rem, 4vw, 2rem);
      box-sizing: border-box;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      transition: opacity 0.28s ease, visibility 0.28s ease;
      -webkit-tap-highlight-color: transparent;
      will-change: opacity;
    }
    .acadex-ov-loader.active {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }

    /* ── Spinner (rotating arc) ── */
    .acadex-spinner svg { display: block; }
    .acadex-spinner-track { stroke: rgba(0, 122, 255, 0.16); }
    .acadex-spinner-ring {
      stroke: #007AFF;
      animation: acadex-spin 0.9s linear infinite;
      transform-origin: center;
    }
    @keyframes acadex-spin { to { transform: rotate(360deg); } }

    /* ── Label ── */
    .acadex-loader-label {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text',
                   'SF Pro Display', 'Inter', 'Helvetica Neue', Arial, sans-serif;
      font-size: clamp(0.82rem, 2.4vw, 0.95rem);
      font-weight: 600;
      color: rgba(60, 60, 67, 0.6);
      letter-spacing: -0.005em;
      text-align: center;
      padding: 0 clamp(0.75rem, 3vw, 1.5rem);
      max-width: 90vw;
      line-height: 1.4;
    }
    .acadex-ov-loader .acadex-loader-label {
      font-size: clamp(0.76rem, 2.2vw, 0.88rem);
    }

    /* ── Failsafe block ── */
    .acadex-loader-failsafe {
      text-align: center;
      padding: clamp(1rem, 4vw, 2rem);
      max-width: min(92vw, 420px);
      box-sizing: border-box;
    }
    .acadex-loader-failsafe .icon {
      font-size: clamp(1.8rem, 6vw, 2.5rem);
      margin-bottom: clamp(0.5rem, 2vw, 0.75rem);
      line-height: 1;
    }
    .acadex-loader-failsafe p {
      color: rgba(60, 60, 67, 0.65);
      font-size: clamp(0.82rem, 2.4vw, 0.95rem);
      line-height: 1.6;
      margin: 0;
    }
    .acadex-loader-failsafe strong { color: #000; }
    .acadex-loader-failsafe a {
      color: #007AFF;
      text-decoration: underline;
      font-weight: 600;
    }

    /* ── Spinner sizes (fully fluid) ── */
    .acadex-spinner-lg svg {
      width: clamp(44px, 12vw, 60px);
      height: clamp(44px, 12vw, 60px);
    }
    .acadex-spinner-md svg {
      width: clamp(36px, 10vw, 44px);
      height: clamp(36px, 10vw, 44px);
    }
    .acadex-spinner-sm svg {
      width: clamp(26px, 8vw, 32px);
      height: clamp(26px, 8vw, 32px);
    }

    /* ── Landscape phones / very short viewports ── */
    @media (max-height: 500px) and (orientation: landscape) {
      .acadex-fs-loader,
      .acadex-ov-loader { gap: 0.55rem; padding: 0.5rem; }
      .acadex-spinner-lg svg {
        width: clamp(34px, 9vh, 48px);
        height: clamp(34px, 9vh, 48px);
      }
      .acadex-spinner-md svg {
        width: clamp(28px, 7.5vh, 38px);
        height: clamp(28px, 7.5vh, 38px);
      }
      .acadex-loader-label { font-size: 0.78rem; }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// SHARED HELPERS
// ============================================================================

function spinnerSVG(sizeClass) {
  return `
    <div class="acadex-spinner ${sizeClass}">
      <svg viewBox="0 0 40 40">
        <circle class="acadex-spinner-track" cx="20" cy="20" r="16"
                fill="none" stroke-width="3"/>
        <circle class="acadex-spinner-ring" cx="20" cy="20" r="16"
                fill="none" stroke-width="3" stroke-linecap="round"
                pathLength="100" stroke-dasharray="25 100"/>
      </svg>
    </div>
  `;
}

function escapeHtmlLocal(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, m => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]
  ));
}

function failsafeMarkup() {
  return `
    <div class="acadex-loader-failsafe">
      <div class="icon">📶</div>
      <p>
        <strong>Network is taking too long.</strong><br>
        Please check your connection and try again.<br>
        <a href="javascript:location.reload()">Tap to refresh</a>
      </p>
    </div>
  `;
}

// Reference-counted body-scroll lock — safe with multiple loaders.
let bodyScrollLockCount = 0;
let originalBodyOverflow = '';

function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (bodyScrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow || '';
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount++;
}

function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (bodyScrollLockCount > 0) bodyScrollLockCount--;
  if (bodyScrollLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
}

// ============================================================================
// LOADER CONTROLLER
// ============================================================================

function createLoaderController({
  elementId,
  className,
  sizeClass,
  defaultLabel,
  defaultFailsafeMs,
}) {
  let el = null;
  let failsafeTimer = null;
  let showTimestamp = 0;
  let isActive = false;
  let scrollLocked = false;

  function ensureElement() {
    if (typeof document === 'undefined') return null;
    if (el && document.body.contains(el)) return el;

    // Reuse a pre-boot element if the page already created one.
    const existing = document.getElementById(elementId);
    if (existing) {
      el = existing;
      ensureLoaderStyles();
      return el;
    }

    ensureLoaderStyles();
    el = document.createElement('div');
    el.id = elementId;
    el.className = className;
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = `
      ${spinnerSVG(sizeClass)}
      <div class="acadex-loader-label">${escapeHtmlLocal(defaultLabel)}</div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function startFailsafe(ms) {
    if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
    if (!ms || ms <= 0) return;
    failsafeTimer = setTimeout(() => {
      failsafeTimer = null;
      if (el && el.classList.contains('active') &&
          !el.querySelector('.acadex-loader-failsafe')) {
        el.innerHTML = failsafeMarkup();
      }
    }, ms);
  }

  function show(options = {}) {
    const element = ensureElement();
    if (!element) return;

    const label = options.label;
    if (label) {
      const labelEl = element.querySelector('.acadex-loader-label');
      if (labelEl) labelEl.textContent = label;
    }

    if (!isActive) {
      isActive = true;
      lockBodyScroll();
      scrollLocked = true;
    }

    if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }

    element.style.display = '';
    element.classList.remove('active');
    void element.offsetHeight;      // force reflow so the transition triggers
    element.classList.add('active');
    showTimestamp = Date.now();

    const failsafeMs = typeof options.failsafeMs === 'number'
      ? options.failsafeMs
      : defaultFailsafeMs;
    startFailsafe(failsafeMs);
  }

  // Adopt an already-visible pre-boot element created inline by the page.
  // Returns true if adoption happened (so the caller can skip show()).
  function adoptPreboot() {
    if (typeof document === 'undefined') return false;
    const existing = document.getElementById(elementId);
    if (!existing) return false;
    if (!existing.classList.contains('active')) return false;

    el = existing;
    isActive = true;
    showTimestamp = Date.now();
    if (!scrollLocked) {
      lockBodyScroll();
      scrollLocked = true;
    }

    // Clear the inline preboot failsafe timer, if any.
    if (typeof window !== 'undefined' && window.__acadexPrebootTimer) {
      clearTimeout(window.__acadexPrebootTimer);
      window.__acadexPrebootTimer = null;
    }

    startFailsafe(defaultFailsafeMs);
    return true;
  }

  function hide(options = {}) {
    if (!isActive || !el) return;

    const minDisplayMs = typeof options.minDisplayMs === 'number'
      ? options.minDisplayMs
      : 0;
    const elapsed = Date.now() - showTimestamp;
    const wait = Math.max(0, minDisplayMs - elapsed);

    const doHide = () => {
      if (failsafeTimer) { clearTimeout(failsafeTimer); failsafeTimer = null; }
      if (!el) return;
      el.classList.remove('active');
      isActive = false;

      if (scrollLocked) {
        scrollLocked = false;
        unlockBodyScroll();
      }

      // Force-hide fallback (belt and braces) so broken CSS can never leave
      // a ghost loader on screen.
      setTimeout(() => {
        if (el && !el.classList.contains('active')) {
          el.style.display = 'none';
        }
      }, 420);
    };

    if (wait > 0) setTimeout(doHide, wait);
    else doHide();
  }

  function isVisible() {
    return !!(el && isActive);
  }

  return { show, hide, isVisible, adoptPreboot };
}

// ============================================================================
// CONTROLLER INSTANCES
// ============================================================================

const fullscreenController = createLoaderController({
  elementId: FULLSCREEN_ELEMENT_ID,
  className: 'acadex-fs-loader',
  sizeClass: 'acadex-spinner-lg',
  defaultLabel: 'Loading…',
  defaultFailsafeMs: 120000,
});

const overlayController = createLoaderController({
  elementId: OVERLAY_ELEMENT_ID,
  className: 'acadex-ov-loader',
  sizeClass: 'acadex-spinner-md',
  defaultLabel: 'Loading…',
  defaultFailsafeMs: 90000,
});

// ============================================================================
// PUBLIC API — BUTTON LOADING (unchanged)
// ============================================================================

export function showLoading(buttonElement, originalText = null) {
  if (!buttonElement) return;
  if (originalText === null) originalText = buttonElement.innerText;
  buttonElement.disabled = true;
  buttonElement.dataset.originalText = originalText;
  buttonElement.innerHTML =
    '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Loading...';
}

export function hideLoading(buttonElement) {
  if (!buttonElement) return;
  buttonElement.disabled = false;
  const original = buttonElement.dataset.originalText;
  if (original) buttonElement.innerText = original;
  else buttonElement.innerHTML = buttonElement.dataset.originalText || 'Submit';
}

// ============================================================================
// PUBLIC API — FULLSCREEN / OVERLAY (unchanged signatures)
// ============================================================================

export function showFullscreenLoader(options = {}) {
  fullscreenController.show(options);
}
export function hideFullscreenLoader(options = {}) {
  fullscreenController.hide(options);
}
export function isFullscreenLoaderVisible() {
  return fullscreenController.isVisible();
}

export function showOverlayLoader(options = {}) {
  overlayController.show(options);
}
export function hideOverlayLoader(options = {}) {
  overlayController.hide(options);
}
export function isOverlayLoaderVisible() {
  return overlayController.isVisible();
}

export function showPageLoader(options = {}) { return showFullscreenLoader(options); }
export function hidePageLoader(options = {}) { return hideFullscreenLoader(options); }

// ============================================================================
// PUBLIC API — PAGE READY SIGNAL
// ============================================================================
//
// Call after Firestore data has been fetched AND rendered into the DOM:
//
//   import { markPageReady } from '../js/loading.js';
//   try { await loadFromFirestore(); render(); }
//   finally { markPageReady(); }
//
// This hides the fullscreen and overlay loaders with a small minimum display
// time so the transition never looks like a flicker on fast connections.

export function markPageReady(options = {}) {
  const minDisplayMs = typeof options.minDisplayMs === 'number'
    ? options.minDisplayMs
    : 500;
  hideFullscreenLoader({ minDisplayMs });
  hideOverlayLoader({ minDisplayMs: Math.max(0, minDisplayMs - 100) });
}

// Alias — friendlier import name for some codebases.
export const pageReady = markPageReady;

// ============================================================================
// CONVENIENCE WRAPPERS (unchanged)
// ============================================================================

export async function withFullscreenLoader(fnOrPromise, options = {}) {
  showFullscreenLoader({ label: options.label, failsafeMs: options.failsafeMs });
  try {
    return typeof fnOrPromise === 'function' ? await fnOrPromise() : await fnOrPromise;
  } finally {
    hideFullscreenLoader({ minDisplayMs: options.minDisplayMs });
  }
}

export async function withOverlayLoader(fnOrPromise, options = {}) {
  showOverlayLoader({ label: options.label, failsafeMs: options.failsafeMs });
  try {
    return typeof fnOrPromise === 'function' ? await fnOrPromise() : await fnOrPromise;
  } finally {
    hideOverlayLoader({ minDisplayMs: options.minDisplayMs });
  }
}

// ============================================================================
// AUTO-BOOT + EVENT WIRING
// ============================================================================
//
// 1. If the page pre-rendered a boot loader in the HTML, adopt it.
//    Otherwise do nothing — pages that don't opt in are unaffected.
// 2. Listen for the `acadex:ready` window event to hide the loaders.
// 3. Mercy-hide fallback: 10 s after `window.load`, if nothing has signalled
//    ready yet, force a hide so a forgotten signal can never leave the user
//    staring at a spinner indefinitely.

(function installAutoBoot() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  // Defer to next microtask so any inline "loading.js" import ordering is
  // respected, and so the DOM (including the preboot element) is definitely
  // present.
  Promise.resolve().then(() => {
    const bootEl = document.getElementById(FULLSCREEN_ELEMENT_ID);
    const adopted = bootEl ? fullscreenController.adoptPreboot() : false;
    if (!adopted && bootEl) {
      // Element exists but wasn't active — treat as a normal show.
      fullscreenController.show();
    }
    // If there's no bootEl at all: no auto-boot. Page opted out.
  });

  // Listen for the page's "data ready" event.
  window.addEventListener(PAGE_READY_EVENT, () => {
    markPageReady();
  });

  // Mercy-hide fallback.
  window.addEventListener('load', () => {
    setTimeout(() => {
      if (isFullscreenLoaderVisible() || isOverlayLoaderVisible()) {
        try {
          console.warn(
            '[loading.js] No acadex:ready signal within 10 s of window.load — ' +
            'auto-hiding. Call markPageReady() in your init() for perfect timing.'
          );
        } catch (_) { /* noop */ }
        markPageReady({ minDisplayMs: 0 });
      }
    }, 10000);
  });
})();