// Terms and Conditions Page Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Table of Contents functionality
    const openTocBtn = document.getElementById('openToc');
    const closeTocBtn = document.getElementById('closeToc');
    const tocModal = document.getElementById('tocModal');
    
    if (openTocBtn && tocModal) {
        openTocBtn.addEventListener('click', function() {
            tocModal.classList.add('active');
        });
        
        closeTocBtn.addEventListener('click', function() {
            tocModal.classList.remove('active');
        });
        
        // Close modal when clicking outside
        tocModal.addEventListener('click', function(e) {
            if (e.target === tocModal) {
                tocModal.classList.remove('active');
            }
        });
        
        // Close modal with Escape key
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && tocModal.classList.contains('active')) {
                tocModal.classList.remove('active');
            }
        });
    }
    
    // Scroll to top functionality
    const scrollToTopBtn = document.getElementById('scrollToTop');
    
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', function() {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        // Show/hide scroll to top button
        window.addEventListener('scroll', function() {
            if (window.scrollY > 300) {
                scrollToTopBtn.style.display = 'flex';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });
        
        // Initialize visibility
        scrollToTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    }
    
    // Smooth scroll for table of contents links
    const tocLinks = document.querySelectorAll('.toc-list a');
    
    tocLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                // Close TOC modal
                if (tocModal) {
                    tocModal.classList.remove('active');
                }
                
                // Scroll to section
                const headerOffset = 80;
                const elementPosition = targetSection.offsetTop;
                const offsetPosition = elementPosition - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
                
                // Highlight section
                targetSection.style.backgroundColor = 'var(--light-bg)';
                setTimeout(() => {
                    targetSection.style.backgroundColor = '';
                }, 2000);
            }
        });
    });
    
    // Update current year in the "Last Updated" date
    const updateDateElement = document.querySelector('.update-date');
    if (updateDateElement) {
        const currentDate = new Date();
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        updateDateElement.textContent = currentDate.toLocaleDateString('en-US', options);
    }
});