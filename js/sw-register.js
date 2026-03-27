// sw-register.js - Service Worker Registration
// This file handles ONLY service worker registration

// Register service worker with version tracking
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.log('⚠️ Service Worker not supported');
    return;
  }

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
  if (document.readyState === 'loading') {
    window.addEventListener('load', registerSW);
  } else {
    registerSW();
  }
}

// Auto-register when this module is imported
registerServiceWorker();