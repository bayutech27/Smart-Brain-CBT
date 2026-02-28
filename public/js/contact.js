// Contact Form Functionality
document.addEventListener('DOMContentLoaded', function() {
    const contactForm = document.getElementById('contactForm');
    const submitBtn = document.getElementById('submitBtn');
    const formMessage = document.getElementById('formMessage');
    
    // EmailJS Configuration - EASILY EDITABLE SETTINGS
    const EMAIL_CONFIG = {
        SERVICE_ID: 'service_3y50oyf', // Your EmailJS Service ID
        TEMPLATE_ID: 'template_83n7o9o', // Your EmailJS Template ID
        RECIPIENT_EMAIL: 'bayutech27@gmail.com', // CHANGE THIS to any email you want
        PUBLIC_KEY: 'YOUR_PUBLIC_KEY_HERE' // Your EmailJS Public Key
    };
    
    // Update EmailJS public key from the config
    emailjs.init(EMAIL_CONFIG.PUBLIC_KEY);
    
    // Validation functions
    function validateName(name) {
        if (!name.trim()) {
            return 'Name is required';
        }
        if (name.length < 2) {
            return 'Name must be at least 2 characters';
        }
        if (name.length > 50) {
            return 'Name must be less than 50 characters';
        }
        return '';
    }
    
    function validateEmail(email) {
        if (!email.trim()) {
            return 'Email is required';
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return 'Please enter a valid email address';
        }
        return '';
    }
    
    function validateMessage(message) {
        if (!message.trim()) {
            return 'Message is required';
        }
        if (message.length < 10) {
            return 'Message must be at least 10 characters';
        }
        if (message.length > 1000) {
            return 'Message must be less than 1000 characters';
        }
        return '';
    }
    
    // Show error message
    function showError(inputId, message) {
        const errorElement = document.getElementById(inputId + 'Error');
        const inputElement = document.getElementById(inputId);
        
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        inputElement.style.borderColor = 'var(--error-color)';
    }
    
    // Clear error message
    function clearError(inputId) {
        const errorElement = document.getElementById(inputId + 'Error');
        const inputElement = document.getElementById(inputId);
        
        errorElement.textContent = '';
        errorElement.style.display = 'none';
        inputElement.style.borderColor = 'var(--border-color)';
    }
    
    // Show form message
    function showFormMessage(type, message) {
        formMessage.textContent = message;
        formMessage.className = 'form-message ' + type;
        formMessage.style.display = 'block';
        
        // Scroll to message
        formMessage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        
        // Hide message after 5 seconds for success, 10 seconds for error
        const timeout = type === 'success' ? 5000 : 10000;
        setTimeout(() => {
            formMessage.style.display = 'none';
        }, timeout);
    }
    
    // Set loading state
    function setLoading(isLoading) {
        if (isLoading) {
            submitBtn.innerHTML = '<span class="spinner"></span> Sending...';
            submitBtn.classList.add('loading');
            submitBtn.disabled = true;
        } else {
            submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Message';
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
        }
    }
    
    // Real-time validation
    const inputs = ['user_name', 'user_email', 'message'];
    inputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('input', function() {
                clearError(inputId);
            });
            
            input.addEventListener('blur', function() {
                let error = '';
                switch(inputId) {
                    case 'user_name':
                        error = validateName(this.value);
                        break;
                    case 'user_email':
                        error = validateEmail(this.value);
                        break;
                    case 'message':
                        error = validateMessage(this.value);
                        break;
                }
                if (error) {
                    showError(inputId, error);
                }
            });
        }
    });
    
    // Form submission
    if (contactForm) {
        contactForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Get form values
            const name = document.getElementById('user_name').value;
            const email = document.getElementById('user_email').value;
            const message = document.getElementById('message').value;
            
            // Validate all fields
            const nameError = validateName(name);
            const emailError = validateEmail(email);
            const messageError = validateMessage(message);
            
            if (nameError) showError('user_name', nameError);
            if (emailError) showError('user_email', emailError);
            if (messageError) showError('message', messageError);
            
            // If any errors, stop submission
            if (nameError || emailError || messageError) {
                showFormMessage('error', 'Please fix the errors above');
                return;
            }
            
            // Set loading state
            setLoading(true);
            
            // Prepare email parameters
            const templateParams = {
                from_name: name,
                from_email: email,
                message: message,
                to_email: EMAIL_CONFIG.RECIPIENT_EMAIL,
                date: new Date().toLocaleString(),
                platform_name: 'Smart Brain CBT'
            };
            
            try {
                // Send email using EmailJS
                const response = await emailjs.send(
                    EMAIL_CONFIG.SERVICE_ID,
                    EMAIL_CONFIG.TEMPLATE_ID,
                    templateParams
                );
                
                if (response.status === 200) {
                    // Success
                    showFormMessage('success', 'Message sent successfully! We\'ll get back to you soon.');
                    contactForm.reset();
                    
                    // Log to console for debugging
                    console.log('Email sent to:', EMAIL_CONFIG.RECIPIENT_EMAIL);
                    console.log('EmailJS Response:', response);
                } else {
                    throw new Error('Failed to send email');
                }
            } catch (error) {
                // Error handling
                console.error('EmailJS Error:', error);
                
                // Fallback email in case EmailJS fails
                const fallbackEmailLink = `mailto:${EMAIL_CONFIG.RECIPIENT_EMAIL}?subject=Contact from Smart Brain CBT&body=Name: ${encodeURIComponent(name)}%0D%0AEmail: ${encodeURIComponent(email)}%0D%0AMessage: ${encodeURIComponent(message)}`;
                
                showFormMessage('error', 
                    `Email service temporarily unavailable. Please email us directly at ${EMAIL_CONFIG.RECIPIENT_EMAIL} or <a href="${fallbackEmailLink}" style="color: var(--accent-color); text-decoration: underline;">click here to open your email client</a>.`
                );
            } finally {
                // Reset loading state
                setLoading(false);
            }
        });
    }
    
    // Add admin panel for easy email configuration (only visible in console)
    console.log(`
    ============================================
    SMART BRAIN CBT CONTACT FORM CONFIGURATION
    ============================================
    
    To change the recipient email address, edit the EMAIL_CONFIG object in contact.js:
    
    1. Open js/contact.js
    2. Find this section (around line 8):
    
        const EMAIL_CONFIG = {
            SERVICE_ID: 'service_3y50oyf',
            TEMPLATE_ID: 'template_83n7o9o',
            RECIPIENT_EMAIL: 'bayutech27@gmail.com', // CHANGE THIS
            PUBLIC_KEY: 'YOUR_PUBLIC_KEY_HERE'
        };
    
    3. Change 'bayutech27@gmail.com' to any email address
    
    EmailJS Setup Instructions:
    1. Sign up at https://www.emailjs.com/
    2. Create a service (Gmail recommended)
    3. Create an email template
    4. Get your Public Key, Service ID, and Template ID
    5. Update the values in the EMAIL_CONFIG object
    
    Current Configuration:
    - Recipient Email: ${EMAIL_CONFIG.RECIPIENT_EMAIL}
    - Service ID: ${EMAIL_CONFIG.SERVICE_ID}
    - Template ID: ${EMAIL_CONFIG.TEMPLATE_ID}
    
    ============================================
    `);
});