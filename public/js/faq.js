// FAQ Page Functionality
document.addEventListener('DOMContentLoaded', function() {
    // FAQ Accordion Functionality
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        
        question.addEventListener('click', function() {
            // Close all other items
            faqItems.forEach(otherItem => {
                if (otherItem !== item && otherItem.classList.contains('active')) {
                    otherItem.classList.remove('active');
                }
            });
            
            // Toggle current item
            item.classList.toggle('active');
            
            // Scroll into view if opening
            if (item.classList.contains('active')) {
                setTimeout(() => {
                    item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            }
        });
    });
    
    // Search Functionality
    const searchInput = document.getElementById('searchInput');
    const modalSearchInput = document.getElementById('modalSearchInput');
    const searchBtn = document.getElementById('searchBtn');
    const openSearchBtn = document.getElementById('openSearch');
    const closeSearchBtn = document.getElementById('closeSearch');
    const searchModal = document.getElementById('searchModal');
    const searchResults = document.getElementById('searchResults');
    
    // FAQ Data for Search
    const faqData = [
        {
            id: 1,
            question: "What is Smart Brain CBT?",
            answer: "An online computer-based test platform for exam preparation.",
            category: "general",
            keywords: ["what", "platform", "online", "practice"]
        },
        {
            id: 2,
            question: "Is Smart Brain CBT an official WAEC, NECO, or JAMB platform?",
            answer: "No, we are an independent learning platform.",
            category: "general",
            keywords: ["official", "waec", "neco", "jamb", "affiliated"]
        },
        {
            id: 3,
            question: "Can Smart Brain CBT guarantee my exam success?",
            answer: "No platform can guarantee exam success.",
            category: "general",
            keywords: ["guarantee", "success", "exam", "result"]
        },
        {
            id: 4,
            question: "Do I need to be very good with computers to use Smart Brain CBT?",
            answer: "No, the platform is user-friendly.",
            category: "platform",
            keywords: ["computer", "skills", "easy", "user-friendly"]
        },
        {
            id: 5,
            question: "What subjects are available on Smart Brain CBT?",
            answer: "All major Nigerian secondary school subjects.",
            category: "platform",
            keywords: ["subjects", "available", "science", "arts", "commercial"]
        },
        {
            id: 6,
            question: "How often are new questions added to the platform?",
            answer: "Weekly updates with new questions.",
            category: "platform",
            keywords: ["new", "questions", "added", "updated", "frequency"]
        },
        {
            id: 7,
            question: "How similar are your mock exams to the real exams?",
            answer: "95% similar with same timing and format.",
            category: "exams",
            keywords: ["mock", "similar", "real", "exam", "format"]
        },
        {
            id: 8,
            question: "Can I pause and resume my practice tests?",
            answer: "Yes in practice mode, no in exam simulation.",
            category: "exams",
            keywords: ["pause", "resume", "practice", "test", "continue"]
        },
        {
            id: 9,
            question: "How are my scores calculated?",
            answer: "Based on correct answers with bonus for speed.",
            category: "exams",
            keywords: ["scores", "calculated", "marks", "points"]
        },
        {
            id: 10,
            question: "Is my personal data and exam progress safe?",
            answer: "Yes, we take data security seriously.",
            category: "account",
            keywords: ["data", "safe", "security", "privacy", "progress"]
        },
        {
            id: 11,
            question: "Can I access Smart Brain CBT on multiple devices?",
            answer: "Yes, with cross-device sync.",
            category: "account",
            keywords: ["multiple", "devices", "access", "phone", "tablet"]
        },
        {
            id: 12,
            question: "What happens if I forget my password?",
            answer: "Use password recovery via email.",
            category: "account",
            keywords: ["forgot", "password", "recover", "reset"]
        },
        {
            id: 13,
            question: "What should I do if the platform is not working properly?",
            answer: "Try troubleshooting steps or contact support.",
            category: "technical",
            keywords: ["not working", "problem", "issue", "technical"]
        },
        {
            id: 14,
            question: "Are there any system requirements?",
            answer: "Modern browser and internet connection.",
            category: "technical",
            keywords: ["system", "requirements", "browser", "specifications"]
        },
        {
            id: 15,
            question: "Is there a mobile app available?",
            answer: "Mobile-optimized website, apps coming soon.",
            category: "technical",
            keywords: ["mobile", "app", "application", "download"]
        }
    ];
    
    // Search function
    function performSearch(searchTerm) {
        if (!searchTerm.trim()) {
            searchResults.innerHTML = '<p class="no-results">Please enter a search term</p>';
            return;
        }
        
        const searchLower = searchTerm.toLowerCase();
        const results = faqData.filter(item => {
            return item.question.toLowerCase().includes(searchLower) ||
                   item.answer.toLowerCase().includes(searchLower) ||
                   item.keywords.some(keyword => keyword.includes(searchLower));
        });
        
        displaySearchResults(results, searchTerm);
    }
    
    // Display search results
    function displaySearchResults(results, searchTerm) {
        if (results.length === 0) {
            searchResults.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <h4>No results found for "${searchTerm}"</h4>
                    <p>Try different keywords or browse the categories</p>
                </div>
            `;
            return;
        }
        
        let html = `<div class="results-count">Found ${results.length} result${results.length !== 1 ? 's' : ''}</div>`;
        
        results.forEach(result => {
            html += `
                <div class="search-result-item" data-id="${result.id}">
                    <h4>${highlightText(result.question, searchTerm)}</h4>
                    <p>${highlightText(result.answer.substring(0, 100) + '...', searchTerm)}</p>
                    <span class="result-category">${result.category}</span>
                </div>
            `;
        });
        
        searchResults.innerHTML = html;
        
        // Add click handlers to result items
        document.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const id = parseInt(this.dataset.id);
                openFaqItem(id);
            });
        });
    }
    
    // Highlight search term in text
    function highlightText(text, searchTerm) {
        if (!searchTerm) return text;
        
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    // Open specific FAQ item
    function openFaqItem(id) {
        // Close search modal
        searchModal.classList.remove('active');
        
        // Find and open the FAQ item
        const faqItem = document.querySelectorAll('.faq-item')[id - 1];
        if (faqItem) {
            // Close all other items
            faqItems.forEach(item => {
                if (item !== faqItem) {
                    item.classList.remove('active');
                }
            });
            
            // Open the selected item
            faqItem.classList.add('active');
            
            // Scroll to the item
            setTimeout(() => {
                faqItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Add highlight effect
                faqItem.style.boxShadow = '0 0 0 3px rgba(255, 152, 0, 0.3)';
                setTimeout(() => {
                    faqItem.style.boxShadow = '';
                }, 2000);
            }, 300);
        }
    }
    
    // Search event listeners
    searchBtn.addEventListener('click', () => {
        performSearch(searchInput.value);
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(searchInput.value);
        }
    });
    
    modalSearchInput.addEventListener('input', () => {
        performSearch(modalSearchInput.value);
    });
    
    // Search modal functionality
    openSearchBtn.addEventListener('click', () => {
        searchModal.classList.add('active');
        modalSearchInput.focus();
    });
    
    closeSearchBtn.addEventListener('click', () => {
        searchModal.classList.remove('active');
        modalSearchInput.value = '';
        searchResults.innerHTML = '';
    });
    
    // Close modal when clicking outside
    searchModal.addEventListener('click', (e) => {
        if (e.target === searchModal) {
            searchModal.classList.remove('active');
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && searchModal.classList.contains('active')) {
            searchModal.classList.remove('active');
        }
    });
    
    // Scroll to top functionality
    const scrollToTopBtn = document.getElementById('scrollToTop');
    
    if (scrollToTopBtn) {
        scrollToTopBtn.addEventListener('click', () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
        
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollToTopBtn.style.display = 'flex';
            } else {
                scrollToTopBtn.style.display = 'none';
            }
        });
        
        scrollToTopBtn.style.display = window.scrollY > 300 ? 'flex' : 'none';
    }
    
    // Print functionality
    const printBtn = document.getElementById('printFaq');
    
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            // Open all FAQ items before printing
            faqItems.forEach(item => {
                item.classList.add('active');
            });
            
            setTimeout(() => {
                window.print();
            }, 500);
        });
    }
    
    // Quick links smooth scrolling
    document.querySelectorAll('.quick-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href');
            const targetSection = document.querySelector(targetId);
            
            if (targetSection) {
                const headerOffset = 80;
                const elementPosition = targetSection.offsetTop;
                const offsetPosition = elementPosition - headerOffset;
                
                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Initialize with first FAQ open
    if (faqItems.length > 0) {
        faqItems[0].classList.add('active');
    }
    
    // Add CSS for search highlights
    const style = document.createElement('style');
    style.textContent = `
        mark {
            background-color: #FFF176;
            padding: 2px 4px;
            border-radius: 3px;
        }
        
        .no-results {
            text-align: center;
            padding: 40px 20px;
            color: var(--text-light);
        }
        
        .no-results i {
            font-size: 48px;
            color: #FF9800;
            margin-bottom: 20px;
        }
        
        .no-results h4 {
            font-size: 18px;
            color: var(--primary-color);
            margin-bottom: 10px;
        }
        
        .results-count {
            font-size: 14px;
            color: var(--text-light);
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--border-color);
        }
        
        .result-category {
            display: inline-block;
            padding: 4px 12px;
            background: #FFF3E0;
            color: #E65100;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 500;
            margin-top: 8px;
        }
    `;
    document.head.appendChild(style);
    
    // Debug console info
    console.log(`
    ============================================
    SMART BRAIN CBT - FAQ PAGE
    ============================================
    
    Features Available:
    • Interactive FAQ accordion
    • Search functionality (${faqData.length} questions indexed)
    • Quick navigation by category
    • Print-friendly format
    • Responsive design
    
    Total Questions: ${faqData.length}
    Categories: 5 (General, Platform, Exams, Account, Technical)
    
    Search Tips:
    • Try keywords like "password", "mobile", "subjects"
    • Click search results to open FAQ directly
    • Use quick links for category browsing
    
    ============================================
    `);
});