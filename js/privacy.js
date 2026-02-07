// Privacy Policy Page Functionality
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
    
    // Print functionality
    const printBtn = document.getElementById('printPolicy');
    
    if (printBtn) {
        printBtn.addEventListener('click', function() {
            window.print();
        });
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
                targetSection.style.backgroundColor = '#E3F2FD';
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
    
    // Add animation to overview cards on scroll
    const overviewCards = document.querySelectorAll('.overview-card');
    
    if (overviewCards.length > 0) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry, index) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.style.opacity = '1';
                        entry.target.style.transform = 'translateY(0)';
                    }, index * 200);
                }
            });
        }, {
            threshold: 0.1
        });
        
        overviewCards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            observer.observe(card);
        });
    }
    
    // Add interactive elements to usage list items
    const usageItems = document.querySelectorAll('.usage-list li');
    usageItems.forEach(item => {
        item.addEventListener('mouseenter', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1.2)';
            }
        });
        
        item.addEventListener('mouseleave', function() {
            const icon = this.querySelector('i');
            if (icon) {
                icon.style.transform = 'scale(1)';
            }
        });
    });
    
    // Add click-to-copy for contact info
    const contactInfo = document.querySelector('.contact-info span');
    const contactEmail = document.querySelector('.contact-email span');
    
    if (contactInfo) {
        contactInfo.addEventListener('click', function() {
            const text = this.textContent.replace('WhatsApp: ', '');
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.textContent;
                this.textContent = 'Copied to clipboard!';
                this.style.color = '#4CAF50';
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.color = '';
                }, 2000);
            });
        });
    }
    
    if (contactEmail) {
        contactEmail.addEventListener('click', function() {
            const text = this.textContent.replace('Email: ', '');
            navigator.clipboard.writeText(text).then(() => {
                const originalText = this.textContent;
                this.textContent = 'Copied to clipboard!';
                this.style.color = '#4CAF50';
                
                setTimeout(() => {
                    this.textContent = originalText;
                    this.style.color = '';
                }, 2000);
            });
        });
    }
});