// Interactivity for RecruitEase Landing Page

document.addEventListener('DOMContentLoaded', async () => {
    // Fetch Webhook URL Configuration from server
    let WORKBENCH_WEBHOOK_URL = '';
    let lastAppliedJobId = '';
    let supabase = null;

    const initOAuthFlow = async () => {
        // 1. Google Button Click handler
        const googleBtn = document.getElementById('google-login-btn');
        if (googleBtn) {
            googleBtn.addEventListener('click', async () => {
                try {
                    const { data, error } = await supabase.auth.signInWithOAuth({
                        provider: 'google',
                        options: {
                            redirectTo: window.location.origin + '/app.html',
                            queryParams: { prompt: 'select_account' }
                        }
                    });
                    if (error) throw error;
                } catch (err) {
                    console.error('OAuth sign in error:', err);
                    alert('OAuth sign in failed: ' + err.message);
                }
            });
        }

        // 2. Check for active session (redirect callback or persisted session)
        try {
            if (window.location.hash === '#logout') {
                await supabase.auth.signOut();
                localStorage.removeItem('currentUserProfile');
                localStorage.removeItem('currentUserRole');
                localStorage.removeItem('sb-ldcfkvvxtpyttvvgkifp-auth-token');
                history.replaceState(null, '', window.location.pathname);
                console.log('Successfully logged out of Supabase session.');
                return; // Stop auto-login process
            }
            
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) throw error;
            if (session && session.user) {
                const user = session.user;
                const name = user.user_metadata.full_name || user.user_metadata.name || '';
                const email = user.email;
                const avatarUrl = user.user_metadata.avatar_url || '';

                // Query our local profiles to see if they exist
                const res = await fetch('/api/oauth-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, name, avatarUrl })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.isNewUser) {
                        // Clean session so they don't get stuck in auto-login loop if they close the form without submitting
                        await supabase.auth.signOut();
                        
                        // Pre-fill the signup form and open the signup modal
                        openModal();
                        
                        const fullNameInput = document.getElementById('fullName');
                        const emailInput = document.getElementById('email');
                        if (fullNameInput) fullNameInput.value = data.user.fullName;
                        if (emailInput) emailInput.value = data.user.email;
                        
                        alert('Google Authentication successful! Please complete your RecruitEase candidate profile and upload your resume.');
                    } else {
                        // Existing user — check if they want to edit profile
                        if (window.location.hash === '#edit-profile') {
                            currentUserProfile = data.user;
                            localStorage.setItem('currentUserProfile', JSON.stringify(currentUserProfile));
                            localStorage.setItem('currentUserRole', data.role);
                            history.replaceState(null, '', window.location.pathname); // clean hash
                            openEditModal(null); // Open the edit modal, pre-filled
                        } else {
                            // Normal login — check resume before entering
                            checkResumeAndEnter(data.user, data.role);
                        }
                    }
                } else {
                    const errText = await res.text();
                    console.error('OAuth profile check failed:', errText);
                }
            }
        } catch (err) {
            console.error('Error restoring session:', err);
        }
    };

    const fetchConfig = async () => {
        try {
            const response = await fetch('/api/config');
            if (response.ok) {
                const config = await response.json();
                WORKBENCH_WEBHOOK_URL = config.VITE_WORKBENCH_WEBHOOK_URL;
                console.log('Successfully loaded webhook configuration:', WORKBENCH_WEBHOOK_URL);
                
                if (config.SUPABASE_URL && config.SUPABASE_KEY && window.supabase) {
                    supabase = window.supabase.createClient(config.SUPABASE_URL, config.SUPABASE_KEY);
                    console.log('Supabase client initialized on frontend.');
                    initOAuthFlow();
                }
            }
        } catch (err) {
            console.error('Error fetching config:', err);
        }
    };
    fetchConfig();

    // 1. Mobile Menu Toggle
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            menuToggle.classList.toggle('active');
            navLinks.classList.toggle('active');
        });

        // Close mobile menu when clicking a link
        const links = navLinks.querySelectorAll('a');
        links.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navLinks.classList.remove('active');
            });
        });
    }

    // 2. Header scroll effect
    const header = document.querySelector('.header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.boxShadow = 'var(--shadow-md)';
            header.style.padding = '0.75rem 0';
        } else {
            header.style.boxShadow = 'none';
            header.style.padding = '1rem 0';
        }
    });

    // 3. Stats Count-Up Animation
    const stats = document.querySelectorAll('.stat-number');
    const animationDuration = 2000; // 2 seconds

    const countUp = (element) => {
        const target = parseInt(element.getAttribute('data-target'), 10);
        let start = 0;
        const stepTime = Math.abs(Math.floor(animationDuration / target));
        
        // If target is too large, increment by a larger step
        const increment = target > 1000 ? Math.ceil(target / 100) : 1;
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = formatNumber(target);
                clearInterval(timer);
            } else {
                element.textContent = formatNumber(start);
            }
        }, Math.max(stepTime, 20));
    };

    const formatNumber = (num) => {
        if (num >= 1000000) {
            return (num / 1000000).toFixed(0) + 'M+';
        }
        if (num >= 1000) {
            return (num / 1000).toFixed(0) + 'K+';
        }
        return num + '%';
    };

    // Intersection Observer to trigger counter when stats section is in view
    const statsSection = document.querySelector('.stats-grid');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    stats.forEach(stat => countUp(stat));
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        observer.observe(statsSection);
    }

    // 4. Profile Setup Modal Controls
    const profileModal = document.getElementById('profile-modal');
    const modalClose = document.getElementById('modal-close');
    const getStartedButtons = [
        document.getElementById('btn-get-started'),
        document.getElementById('hero-btn-start'),
        document.getElementById('banner-btn-start')
    ];

    const openModal = (e) => {
        if (e) e.preventDefault();
        profileModal.classList.add('active');
        document.body.style.overflow = 'hidden'; // Lock background scroll
        
        // Reset steps
        const step1 = document.getElementById('profile-step-1');
        const stepLoading = document.getElementById('profile-step-loading');
        const step2 = document.getElementById('profile-step-2');
        if (step1) step1.style.display = 'block';
        if (stepLoading) stepLoading.style.display = 'none';
        if (step2) step2.style.display = 'none';
    };

    const closeModal = () => {
        profileModal.classList.remove('active');
        document.body.style.overflow = ''; // Restore background scroll
        // Reset success screen and form after modal transitions out
        setTimeout(() => {
            document.getElementById('modal-success-screen').classList.remove('active');
            document.getElementById('profile-form').reset();
            const fileNameDisplay = document.getElementById('file-name-display');
            if(fileNameDisplay) fileNameDisplay.textContent = 'No file chosen';
            
            if (window.location.hash === '#edit-profile') {
                window.location.href = '/dashboard.html';
            }
        }, 300);
    };

    const btnParseResume = document.getElementById('btn-parse-resume');
    if (btnParseResume) {
        btnParseResume.addEventListener('click', async () => {
            const resumeInput = document.getElementById('resume');
            if (!resumeInput.files || resumeInput.files.length === 0) {
                alert('Please select a resume file first.');
                return;
            }
            
            document.getElementById('profile-step-1').style.display = 'none';
            document.getElementById('profile-step-loading').style.display = 'flex';

            const formData = new FormData();
            formData.append('resume', resumeInput.files[0]);

            try {
                const res = await fetch('/api/parse-uploaded-resume', {
                    method: 'POST',
                    body: formData
                });
                if (!res.ok) throw new Error(await res.text());
                
                const data = await res.json();
                
                // Pre-fill fields if they aren't already filled (e.g. by Google Auth)
                const fName = document.getElementById('fullName');
                const fEmail = document.getElementById('email');
                if (data.fullName && !fName.value) fName.value = data.fullName;
                if (data.email && !fEmail.value) fEmail.value = data.email;
                if (data.phone) document.getElementById('phone').value = data.phone;
                if (data.jobTitle) document.getElementById('jobTitle').value = data.jobTitle;
                if (data.skills) document.getElementById('skills').value = data.skills;
                
                if (data.experienceLevel) {
                    const el = document.getElementById('experienceLevel');
                    for (let i = 0; i < el.options.length; i++) {
                        if (el.options[i].value.toLowerCase() === data.experienceLevel.toLowerCase()) {
                            el.selectedIndex = i;
                            break;
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                alert('Error parsing resume. Please fill the details manually.');
            } finally {
                document.getElementById('profile-step-loading').style.display = 'none';
                document.getElementById('profile-step-2').style.display = 'block';
            }
        });
    }

    // Google signup button (same as google-login-btn in the login modal)
    const googleSignupBtn = document.getElementById('google-signup-btn');
    if (googleSignupBtn) {
        googleSignupBtn.addEventListener('click', async () => {
            if (!supabase) { alert('Auth service not ready. Please wait a moment and try again.'); return; }
            try {
                const { error } = await supabase.auth.signInWithOAuth({
                    provider: 'google',
                    options: { 
                        redirectTo: window.location.origin + '/app.html',
                        queryParams: { prompt: 'select_account' }
                    }
                });
                if (error) throw error;
            } catch (err) {
                console.error('Google OAuth error:', err);
                alert('Google sign-in failed: ' + err.message);
            }
        });
    }

    // Switch between login and signup modals
    const switchToLogin = document.getElementById('switch-to-login');
    if (switchToLogin) {
        switchToLogin.addEventListener('click', (e) => {
            e.preventDefault();
            closeModal();
            document.getElementById('login-modal').classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    // ── Resume Required Modal ──────────────────────────────────────────────
    const resumeRequiredModal = document.getElementById('resume-required-modal');
    let pendingUserForResume = null; // holds the logged-in user while they upload

    const openResumeRequiredModal = (user) => {
        pendingUserForResume = user;
        // Pre-fill email (read-only)
        const emailField = document.getElementById('req-email');
        if (emailField) emailField.value = user.email || '';
        // Reset state
        document.getElementById('resume-req-upload-step').style.display = 'block';
        document.getElementById('resume-req-loading').style.display = 'none';
        document.getElementById('resume-req-details-step').style.display = 'none';
        document.getElementById('resume-req-name-display').textContent = 'No file chosen';
        resumeRequiredModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    // File name display for the resume-required input
    const resumeReqFileInput = document.getElementById('resume-req-file');
    if (resumeReqFileInput) {
        resumeReqFileInput.addEventListener('change', (e) => {
            const name = e.target.files[0]?.name || 'No file chosen';
            document.getElementById('resume-req-name-display').textContent = name;
        });
    }

    // Parse resume button inside resume-required modal
    const btnReqParse = document.getElementById('btn-req-parse-resume');
    if (btnReqParse) {
        btnReqParse.addEventListener('click', async () => {
            const fileInput = document.getElementById('resume-req-file');
            if (!fileInput.files || fileInput.files.length === 0) {
                alert('Please choose a resume file first.');
                return;
            }
            document.getElementById('resume-req-upload-step').style.display = 'none';
            document.getElementById('resume-req-loading').style.display = 'flex';

            const fd = new FormData();
            fd.append('resume', fileInput.files[0]);
            try {
                const res = await fetch('/api/parse-uploaded-resume', { method: 'POST', body: fd });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();

                // Pre-fill step-2 fields
                if (data.fullName) document.getElementById('req-fullName').value = data.fullName;
                if (data.phone)    document.getElementById('req-phone').value    = data.phone;
                if (data.jobTitle) document.getElementById('req-jobTitle').value = data.jobTitle;
                if (data.skills)   document.getElementById('req-skills').value   = data.skills;
                if (data.experienceLevel) {
                    const sel = document.getElementById('req-experienceLevel');
                    for (let i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value.toLowerCase() === data.experienceLevel.toLowerCase()) {
                            sel.selectedIndex = i; break;
                        }
                    }
                }
            } catch (err) {
                console.error(err);
                alert('Could not auto-extract details. Please fill the form manually.');
            } finally {
                document.getElementById('resume-req-loading').style.display = 'none';
                document.getElementById('resume-req-details-step').style.display = 'block';
            }
        });
    }

    // Submit the resume-required form (uploads resume + updates profile)
    const resumeRequiredForm = document.getElementById('resume-required-form');
    if (resumeRequiredForm) {
        resumeRequiredForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('resume-req-submit-btn');
            const loader    = document.getElementById('resume-req-loader');
            submitBtn.disabled = true;
            loader.style.display = 'block';
            submitBtn.querySelector('span').textContent = 'Saving...';

            const fd = new FormData();
            fd.append('resume', document.getElementById('resume-req-file').files[0]);
            fd.append('fullName',        document.getElementById('req-fullName').value);
            fd.append('email',           document.getElementById('req-email').value);
            fd.append('phone',           document.getElementById('req-phone').value);
            fd.append('jobTitle',        document.getElementById('req-jobTitle').value);
            fd.append('experienceLevel', document.getElementById('req-experienceLevel').value);
            fd.append('skills',          document.getElementById('req-skills').value);

            try {
                const res = await fetch('/api/profile', { method: 'POST', body: fd });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();
                resumeRequiredModal.classList.remove('active');
                document.body.style.overflow = '';
                enterDashboard(data.profile, 'Candidate');
            } catch (err) {
                console.error(err);
                alert('Error saving profile: ' + err.message);
            } finally {
                submitBtn.disabled = false;
                loader.style.display = 'none';
                submitBtn.querySelector('span').textContent = 'Save & Enter Dashboard';
            }
        });
    }

    // Central function — checks if user has resume before entering dashboard
    const checkResumeAndEnter = (user, role) => {
        if (role === 'Candidate' && !user.resumeFile) {
            openResumeRequiredModal(user);
        } else {
            enterDashboard(user, role);
        }
    };

    getStartedButtons.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', openModal);
        }
    });

    if (modalClose) {
        modalClose.addEventListener('click', closeModal);
    }

    // Close modal by clicking outside
    if (profileModal) {
        profileModal.addEventListener('click', (e) => {
            if (e.target === profileModal) {
                closeModal();
            }
        });
        
        // Prevent clicks inside the card from bubbling to the overlay
        const card = profileModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // 5. File name display update on file choose
    const fileInput = document.getElementById('resume');
    const fileNameDisplay = document.getElementById('file-name-display');
    if (fileInput && fileNameDisplay) {
        fileInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0]?.name || 'No file chosen';
            fileNameDisplay.textContent = fileName;
        });
    }

    const profilePicInput = document.getElementById('profilePic');
    const picNameDisplay = document.getElementById('pic-name-display');
    if (profilePicInput && picNameDisplay) {
        profilePicInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0]?.name || 'No image chosen';
            picNameDisplay.textContent = fileName;
        });
    }

    // 6. Form Submission with AJAX
    const profileForm = document.getElementById('profile-form');
    const submitBtn = document.getElementById('form-submit-btn');
    const submitLoader = document.getElementById('submit-loader');
    const successScreen = document.getElementById('modal-success-screen');
    const successDoneBtn = document.getElementById('success-done-btn');
    let newlyCreatedProfile = null; // Stores the profile returned from signup API

    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // Set loading state
            submitBtn.disabled = true;
            submitLoader.style.display = 'block';
            submitBtn.querySelector('span').textContent = 'Saving Profile...';

            const formData = new FormData(profileForm);

            try {
                const response = await fetch('/api/profile', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('Profile setup success:', result);
                    newlyCreatedProfile = result.profile; // Store the new profile
                    // Show success screen
                    successScreen.classList.add('active');
                } else {
                    const errorText = await response.text();
                    alert('Error creating profile: ' + errorText);
                }
            } catch (err) {
                console.error('Network error during profile submit:', err);
                alert('Network error. Make sure server is running and try again.');
            } finally {
                // Reset loading state
                submitBtn.disabled = false;
                submitLoader.style.display = 'none';
                submitBtn.querySelector('span').textContent = 'Create Profile & Upload Resume';
            }
        });
    }

    if (successDoneBtn) {
        successDoneBtn.addEventListener('click', () => {
            closeModal();
            // Enter the dashboard with the newly created profile
            if (newlyCreatedProfile) {
                enterDashboard(newlyCreatedProfile, 'Candidate');
            }
        });
    }

    // Edit Profile Modal Controls
    const editProfileModal = document.getElementById('edit-profile-modal');
    const editModalClose = document.getElementById('edit-modal-close');
    const btnEditProfile = document.getElementById('btn-edit-profile');
    const editProfileForm = document.getElementById('edit-profile-form');
    
    const openEditModal = (e) => {
        if (e) e.preventDefault();
        if (!currentUserProfile) return;
        
        // Pre-fill form
        document.getElementById('editFullName').value = currentUserProfile.fullName || '';
        document.getElementById('editEmail').value = currentUserProfile.email || '';
        document.getElementById('editPhone').value = currentUserProfile.phone || '';
        document.getElementById('editJobTitle').value = currentUserProfile.jobTitle || '';
        document.getElementById('editSkills').value = (currentUserProfile.skills || []).join(', ');
        
        const el = document.getElementById('editExperienceLevel');
        if (currentUserProfile.experienceLevel) {
            for (let i = 0; i < el.options.length; i++) {
                if (el.options[i].value.toLowerCase() === currentUserProfile.experienceLevel.toLowerCase()) {
                    el.selectedIndex = i;
                    break;
                }
            }
        }
        
        editProfileModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };
    
    const closeEditModal = () => {
        editProfileModal.classList.remove('active');
        document.body.style.overflow = '';
        // If opened via hover "Edit Details" from dashboard, go back to dashboard
        if (window.location.pathname === '/app.html') {
            setTimeout(() => {
                // Only redirect if they actually had a session (not a new visitor)
                if (currentUserProfile) {
                    enterDashboard(currentUserProfile, localStorage.getItem('currentUserRole') || 'Candidate');
                }
            }, 300);
        }
    };
    
    if (btnEditProfile) btnEditProfile.addEventListener('click', openEditModal);
    if (editModalClose) editModalClose.addEventListener('click', closeEditModal);
    if (editProfileModal) {
        editProfileModal.addEventListener('click', (e) => {
            if (e.target === editProfileModal) closeEditModal();
        });
        const card = editProfileModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => e.stopPropagation());
        }
    }

    // Wire up file input label for edit modal
    const editResumeInput = document.getElementById('editResume');
    const editResumeDisplay = document.getElementById('edit-resume-name-display');
    if (editResumeInput && editResumeDisplay) {
        editResumeInput.addEventListener('change', () => {
            editResumeDisplay.textContent = editResumeInput.files[0]?.name || 'No file chosen';
        });
    }

    // Parse resume & auto-fill button in edit modal
    const btnParseEditResume = document.getElementById('btn-parse-edit-resume');
    if (btnParseEditResume) {
        btnParseEditResume.addEventListener('click', async () => {
            if (!editResumeInput || !editResumeInput.files[0]) {
                alert('Please choose a resume file first.');
                return;
            }
            const label = document.getElementById('parse-edit-resume-label');
            const loader = document.getElementById('edit-parse-loader');
            btnParseEditResume.disabled = true;
            if (label) label.textContent = 'Parsing...';
            if (loader) loader.style.display = 'block';

            try {
                const fd = new FormData();
                fd.append('resume', editResumeInput.files[0]);
                const res = await fetch('/api/parse-resume-only', { method: 'POST', body: fd });
                if (!res.ok) throw new Error(await res.text());
                const data = await res.json();

                // Auto-fill the edit form fields
                if (data.fullName) document.getElementById('editFullName').value = data.fullName;
                if (data.phone) document.getElementById('editPhone').value = data.phone;
                if (data.jobTitle) document.getElementById('editJobTitle').value = data.jobTitle;
                if (data.skills) document.getElementById('editSkills').value = Array.isArray(data.skills) ? data.skills.join(', ') : data.skills;
                if (data.experienceLevel) {
                    const sel = document.getElementById('editExperienceLevel');
                    for (let i = 0; i < sel.options.length; i++) {
                        if (sel.options[i].value.toLowerCase() === data.experienceLevel.toLowerCase()) {
                            sel.selectedIndex = i; break;
                        }
                    }
                }
                // Store resume file for submission
                editProfileForm.dataset.newResume = 'pending';
                alert('✅ Resume parsed! Review the auto-filled fields and click Save Changes.');
            } catch (err) {
                console.error('Resume parse error:', err);
                alert('Error parsing resume: ' + err.message);
            } finally {
                btnParseEditResume.disabled = false;
                if (label) label.textContent = '✨ Parse Resume & Auto-Fill Fields';
                if (loader) loader.style.display = 'none';
            }
        });
    }
    
    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('edit-form-submit-btn');
            const submitLoader = document.getElementById('edit-submit-loader');
            
            submitBtn.disabled = true;
            submitLoader.style.display = 'block';
            submitBtn.querySelector('span').textContent = 'Saving...';
            
            const hasNewResume = editResumeInput && editResumeInput.files[0];
            
            try {
                let res;
                if (hasNewResume) {
                    // If a new resume was uploaded, use the full /api/profile endpoint
                    // which handles resume conversion to MD
                    const fd = new FormData();
                    fd.append('resume', editResumeInput.files[0]);
                    fd.append('fullName', document.getElementById('editFullName').value);
                    fd.append('email', document.getElementById('editEmail').value);
                    fd.append('phone', document.getElementById('editPhone').value);
                    fd.append('jobTitle', document.getElementById('editJobTitle').value);
                    fd.append('experienceLevel', document.getElementById('editExperienceLevel').value);
                    fd.append('skills', document.getElementById('editSkills').value);
                    fd.append('isUpdate', 'true'); // Tell server to update existing profile
                    res = await fetch('/api/profile', { method: 'POST', body: fd });
                } else {
                    // No new resume — just update the fields
                    res = await fetch('/api/update-profile', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fullName: document.getElementById('editFullName').value,
                            email: document.getElementById('editEmail').value,
                            phone: document.getElementById('editPhone').value,
                            jobTitle: document.getElementById('editJobTitle').value,
                            experienceLevel: document.getElementById('editExperienceLevel').value,
                            skills: document.getElementById('editSkills').value
                        })
                    });
                }
                
                if (res.ok) {
                    const data = await res.json();
                    currentUserProfile = data.profile;
                    localStorage.setItem('currentUserProfile', JSON.stringify(currentUserProfile));
                    alert('✅ Profile updated successfully!');
                    closeEditModal();
                } else {
                    alert('Error updating profile: ' + await res.text());
                }
            } catch (err) {
                console.error(err);
                alert('Network error while updating profile.');
            } finally {
                submitBtn.disabled = false;
                submitLoader.style.display = 'none';
                submitBtn.querySelector('span').textContent = 'Save Changes';
            }
        });
    }

    // 7. Login Modal Controls
    const loginModal = document.getElementById('login-modal');
    const loginBtn = document.getElementById('btn-login');
    const loginClose = document.getElementById('login-modal-close');
    const switchToSignup = document.getElementById('switch-to-signup');

    const openLoginModal = (e) => {
        if (e) e.preventDefault();
        loginModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeLoginModal = () => {
        loginModal.classList.remove('active');
        document.body.style.overflow = '';
        document.getElementById('login-form').reset();
    };

    if (loginBtn) {
        loginBtn.addEventListener('click', openLoginModal);
    }

    if (loginClose) {
        loginClose.addEventListener('click', closeLoginModal);
    }

    if (loginModal) {
        loginModal.addEventListener('click', (e) => {
            if (e.target === loginModal) {
                closeLoginModal();
            }
        });

        const card = loginModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    if (switchToSignup) {
        switchToSignup.addEventListener('click', (e) => {
            e.preventDefault();
            closeLoginModal();
            openModal();
        });
    }

    // 7b. Auto-open modal based on URL hash (e.g. /app.html#login or /app.html#signup)
    const handleHashOnLoad = () => {
        const hash = window.location.hash;
        if (hash === '#login' && loginModal) {
            openLoginModal();
            // Clean the hash from URL without reloading
            history.replaceState(null, '', window.location.pathname);
        } else if ((hash === '#signup' || hash === '#get-started') && profileModal) {
            openModal();
            history.replaceState(null, '', window.location.pathname);
        }
    };
    // Run on page load
    handleHashOnLoad();


    // 8. Handle Login Submission
    const loginForm = document.getElementById('login-form');
    const loginSubmitBtn = document.getElementById('login-submit-btn');
    const loginLoader = document.getElementById('login-loader');
    const dashboardView = document.getElementById('dashboard-view');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            loginSubmitBtn.disabled = true;
            loginLoader.style.display = 'block';
            loginSubmitBtn.querySelector('span').textContent = 'Authenticating...';

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            const role = document.getElementById('loginRole').value;

            try {
                const response = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password, role })
                });

                if (response.ok) {
                    const data = await response.json();
                    closeLoginModal();
                    checkResumeAndEnter(data.user, data.role);
                } else {
                    const errText = await response.text();
                    alert(errText);
                }
            } catch (err) {
                console.error('Error logging in:', err);
                alert('Connection error. Is the server running?');
            } finally {
                loginSubmitBtn.disabled = false;
                loginLoader.style.display = 'none';
                loginSubmitBtn.querySelector('span').textContent = 'Log In';
            }
        });
    }

    // 9. Enter Dashboard View
    let currentUserProfile = null;

    // Tips and Tricks pool
    const interviewTips = [
        "Use the STAR method (Situation, Task, Action, Result) to structure behavioral answers.",
        "Align your resume keywords directly with the target job description to pass ATS filters.",
        "Minimize eye movement and avoid tab shifts during tests to maintain 100% integrity.",
        "Talk out loud during technical problems to let the AI evaluator follow your reasoning.",
        "Quantify your accomplishments! Highlight impact with numbers (e.g. 'boosted sales by 20%').",
        "Keep answers professional, well-structured, and concise during AI voice assessments."
    ];
    // State tracking for preparation checklist
    let prepState = {
        resumeUploaded: false,
        coursesReviewed: false,
        atsChecked: false,
        testPracticed: false,
        interviewPracticed: false,
        jobsExplored: false,
        hiringStatusChecked: false,
        coursesRefreshed: false,
        evalPracticed: false,
        tipsReviewed: false
    };

    const loadPrepState = () => {
        const saved = localStorage.getItem('recruitEasePrepState');
        if (saved) {
            prepState = JSON.parse(saved);
        }
        if (currentUserProfile && currentUserProfile.resumeFile) {
            prepState.resumeUploaded = true;
        }
    };

    const savePrepState = () => {
        localStorage.setItem('recruitEasePrepState', JSON.stringify(prepState));
        renderPreparationChecklist();
    };

    const candidateTasksPool = [
        { id: 'resume', text: 'Upload your latest resume profile', doneKey: 'resumeUploaded' },
        { id: 'courses', text: 'Review skill recommendations for your target role', doneKey: 'coursesReviewed' },
        { id: 'ats', text: 'Run a Resume Compatibility check under "Evaluate urself"', doneKey: 'atsChecked' },
        { id: 'test', text: 'Complete a practice NOVA test setup', doneKey: 'testPracticed' },
        { id: 'interview', text: 'Complete a practice AI Interview run', doneKey: 'interviewPracticed' },
        { id: 'explore-jobs', text: 'Explore matched positions and apply to jobs', doneKey: 'jobsExplored' },
        { id: 'hiring-status', text: 'Inspect your active application statuses', doneKey: 'hiringStatusChecked' },
        { id: 'refresh-courses', text: 'Refresh skill recommendations to find new courses', doneKey: 'coursesRefreshed' },
        { id: 'practice-eval', text: 'Practice answering scenario-based questions', doneKey: 'evalPracticed' },
        { id: 'scroll-tips', text: 'Review daily AI-generated interview tips', doneKey: 'tipsReviewed' }
    ];

    let currentDailyTasks = [];
    const initializeDailyTasks = () => {
        const shuffled = [...candidateTasksPool].sort(() => 0.5 - Math.random());
        currentDailyTasks = shuffled.slice(0, 3);
    };

    const getActiveTasks = () => {
        if (currentDailyTasks.length === 0) {
            initializeDailyTasks();
        }
        return currentDailyTasks.map(t => {
            return {
                id: t.id,
                text: t.text,
                done: !!prepState[t.doneKey]
            };
        });
    };

    const renderPreparationChecklist = () => {
        const todoList = document.getElementById('prep-todo-list');
        if (!todoList) return;

        todoList.innerHTML = '';
        const tasks = getActiveTasks();

        tasks.forEach(t => {
            const li = document.createElement('li');
            li.style.cssText = 'display: flex; align-items: center; gap: 0.6rem; font-size: 0.9rem; color: var(--dark-muted); transition: all 0.3s; margin-bottom: 0.25rem; padding: 0.5rem; border-radius: 6px;';
            
            const check = document.createElement('span');
            if (t.done) {
                check.style.cssText = 'color: var(--success); font-weight: bold; font-size: 1.1rem;';
                check.textContent = '✓';
                li.style.opacity = '0.65';
                li.style.textDecoration = 'line-through';
                li.style.background = 'rgba(16, 185, 129, 0.04)';
            } else {
                check.style.cssText = 'color: var(--primary); font-weight: bold; font-size: 1.1rem;';
                check.textContent = '→';
                li.style.cursor = 'pointer';
                li.style.background = 'var(--white)';
                li.style.border = '1px solid var(--gray-200)';
                li.style.boxShadow = 'var(--shadow-sm)';
                
                // Add hover style
                li.addEventListener('mouseenter', () => {
                    li.style.transform = 'translateY(-1px)';
                    li.style.borderColor = 'var(--primary)';
                    li.style.boxShadow = 'var(--shadow-md)';
                });
                li.addEventListener('mouseleave', () => {
                    li.style.transform = 'none';
                    li.style.borderColor = 'var(--gray-200)';
                    li.style.boxShadow = 'var(--shadow-sm)';
                });

                // Add active click action for all 10 tasks
                li.addEventListener('click', () => {
                    if (t.id === 'resume') {
                        if (typeof openModal === 'function') openModal();
                    } else if (t.id === 'courses') {
                        const carousel = document.getElementById('skills-courses-carousel');
                        if (carousel) {
                            carousel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const parentCard = carousel.closest('.db-card');
                            if (parentCard) {
                                parentCard.style.transition = 'all 0.5s ease';
                                parentCard.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.4)';
                                setTimeout(() => { parentCard.style.boxShadow = ''; }, 1500);
                            }
                        }
                    } else if (t.id === 'ats') {
                        const card = document.querySelector('.recommended-steps-card');
                        if (card) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            card.style.transition = 'all 0.5s ease';
                            card.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.4)';
                            setTimeout(() => { card.style.boxShadow = ''; }, 1500);
                            const btn = document.getElementById('btn-evaluate-resume-compat');
                            if (btn) btn.click();
                        }
                    } else if (t.id === 'test') {
                        const card = document.querySelector('.recommended-steps-card');
                        if (card) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            card.style.transition = 'all 0.5s ease';
                            card.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.4)';
                            setTimeout(() => { card.style.boxShadow = ''; }, 1500);
                            const btn = document.getElementById('btn-evaluate-evaluation');
                            if (btn) btn.click();
                        }
                    } else if (t.id === 'interview') {
                        const card = document.querySelector('.recommended-steps-card');
                        if (card) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            card.style.transition = 'all 0.5s ease';
                            card.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.4)';
                            setTimeout(() => { card.style.boxShadow = ''; }, 1500);
                            const btn = document.getElementById('btn-evaluate-interviews');
                            if (btn) btn.click();
                        }
                    } else if (t.id === 'explore-jobs') {
                        const tabBtn = document.getElementById('tab-btn-jobs');
                        if (tabBtn) tabBtn.click();
                        prepState.jobsExplored = true;
                        savePrepState();
                    } else if (t.id === 'hiring-status') {
                        const tabBtn = document.getElementById('tab-btn-hiring');
                        if (tabBtn) tabBtn.click();
                        prepState.hiringStatusChecked = true;
                        savePrepState();
                    } else if (t.id === 'refresh-courses') {
                        if (currentUserProfile && currentUserProfile.email) {
                            loadGeminiDashboardData(currentUserProfile.email);
                        }
                        prepState.coursesRefreshed = true;
                        savePrepState();
                    } else if (t.id === 'practice-eval') {
                        const card = document.querySelector('.recommended-steps-card');
                        if (card) {
                            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            const btn = document.getElementById('btn-evaluate-evaluation');
                            if (btn) btn.click();
                        }
                        prepState.evalPracticed = true;
                        savePrepState();
                    } else if (t.id === 'scroll-tips') {
                        const tipBox = document.getElementById('prep-tip-box');
                        if (tipBox) {
                            tipBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            tipBox.parentElement.style.transition = 'all 0.5s ease';
                            tipBox.parentElement.style.boxShadow = '0 0 15px rgba(37, 99, 235, 0.4)';
                            setTimeout(() => { tipBox.parentElement.style.boxShadow = ''; }, 1500);
                        }
                        prepState.tipsReviewed = true;
                        savePrepState();
                    }
                });
            }
            
            const label = document.createElement('span');
            label.textContent = t.text;
            
            li.appendChild(check);
            li.appendChild(label);
            todoList.appendChild(li);
        });

        // AI Daily Tips & Tricks
        const tipBox = document.getElementById('prep-tip-box');
        if (tipBox && !tipBox.getAttribute('data-loaded')) {
            tipBox.textContent = "AI generating daily tip...";
            fetch('/api/daily-tip', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobTitle: currentUserProfile ? currentUserProfile.jobTitle : '' })
            })
            .then(res => res.json())
            .then(data => {
                tipBox.textContent = data.tip;
                tipBox.setAttribute('data-loaded', 'true');
            })
            .catch(err => {
                console.error("Failed to load daily AI tip:", err);
                tipBox.textContent = "Focus on structuring your answers using the STAR method (Situation, Task, Action, Result) during the AI interview.";
            });
        }
    };

    let geminiJobRecommendations = [];
    const loadGeminiDashboardData = async (email) => {
        try {
            const res = await fetch('/api/generate-dashboard-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                const data = await res.json();
                
                // 1. Update Daily Tip Box
                const tipBox = document.getElementById('prep-tip-box');
                if (tipBox && data.dailyTip) {
                    tipBox.textContent = data.dailyTip;
                }
                
                // 2. Update Daily Tasks
                if (data.dailyTasks && data.dailyTasks.length > 0) {
                    currentDailyTasks = data.dailyTasks.map((taskText, idx) => ({
                        id: `gemini-task-${idx}`,
                        text: taskText,
                        doneKey: `gemini_task_done_${idx}`
                    }));
                    renderPreparationChecklist();
                }
                
                // 3. Update Skill Compatibility Bars
                const compatList = document.querySelector('.skill-compat-list');
                if (compatList && data.compatibility) {
                    compatList.innerHTML = `
                        <div class="skill-compat-item">
                            <div class="skill-compat-label">Overall Compatability</div>
                            <div class="skill-compat-bar"><div class="fill bg-primary" style="width: ${data.compatibility.overall}%;"></div></div>
                        </div>
                        <div class="skill-compat-item">
                            <div class="skill-compat-label">Interested Domain/Job</div>
                            <div class="skill-compat-bar"><div class="fill bg-secondary" style="width: ${data.compatibility.domain}%;"></div></div>
                        </div>
                        <div class="skill-compat-item">
                            <div class="skill-compat-label">Technical/Non technical</div>
                            <div class="skill-compat-bar"><div class="fill bg-accent" style="width: ${data.compatibility.tech}%;"></div></div>
                        </div>
                    `;
                }

                // 4. Update Mastery Topics Carousel
                const carousel = document.getElementById('skills-courses-carousel');
                if (carousel && data.masteryTopics) {
                    carousel.innerHTML = data.masteryTopics.map((topic, idx) => `
                        <div class="course-card" style="flex: 0 0 250px; background: var(--gray-50); border: 1px solid var(--gray-200); padding: 1.25rem; border-radius: 10px; display: flex; flex-direction: column; gap: 0.5rem; text-align: left; box-shadow: var(--shadow-sm); min-height: 160px;">
                            <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary); text-transform: uppercase;">Mastery Topic #${idx + 1}</span>
                            <h4 style="margin: 0; font-size: 1rem; color: var(--dark); font-weight: 700;">${topic.title}</h4>
                            <p style="margin: 0; font-size: 0.8rem; color: var(--gray-500); line-height: 1.4;">${topic.desc}</p>
                            <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(topic.title)}" target="_blank" class="btn btn-outline" style="margin-top: auto; padding: 0.35rem 0.75rem; font-size: 0.8rem; text-align: center; border-radius: 6px; display: inline-block;">Start Learning</a>
                        </div>
                    `).join('');
                }
            }
        } catch (err) {
            console.error('Failed to load Gemini dashboard details:', err);
        }
    };

    const loadGeminiJobRecommendations = async (email) => {
        try {
            const res = await fetch('/api/jobs/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });
            if (res.ok) {
                const data = await res.json();
                geminiJobRecommendations = data.recommendations || [];
                
                if (geminiJobRecommendations.length > 0 && allJobsList.length > 0) {
                    allJobsList.sort((a, b) => {
                        const recA = geminiJobRecommendations.find(r => r.jobId === a.external_job_id);
                        const recB = geminiJobRecommendations.find(r => r.jobId === b.external_job_id);
                        const scoreA = recA ? recA.score : 0;
                        const scoreB = recB ? recB.score : 0;
                        return scoreB - scoreA;
                    });
                    renderJobsPage(1);
                }
            }
        } catch (e) {
            console.error("Failed to load Gemini job recommendations:", e);
        }
    };

    const enterDashboard = (user, role) => {
        currentUserProfile = user;
        localStorage.setItem('currentUserProfile', JSON.stringify(user));
        localStorage.setItem('currentUserRole', role);
        
        if (role === 'HR Manager') {
            window.location.href = '/recruiter_workspace.html';
        } else {
            window.location.href = '/dashboard.html';
        }
    };

    const loadDynamicCourseRecommendations = async (email) => {
        const carousel = document.getElementById('skills-courses-carousel');
        if (!carousel) return;

        try {
            const response = await fetch('/api/recommend-courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            if (response.ok) {
                const courses = await response.json();
                carousel.innerHTML = '';
                
                courses.forEach(course => {
                    const card = document.createElement('div');
                    card.className = 'carousel-card';
                    card.style.cssText = 'flex: 1; min-width: 220px; background: linear-gradient(135deg, rgba(239, 246, 255, 0.6), rgba(219, 234, 254, 0.4)); border: 1px solid rgba(191, 219, 254, 0.6); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; justify-content: space-between; min-height: 180px;';
                    
                    const tagsHtml = (course.tags || []).map(t => `<span class="skill-tag" style="background: var(--white); padding: 0.25rem 0.6rem; border-radius: 20px; font-size: 0.75rem; color: var(--dark-muted); border: 1px solid var(--gray-200); font-weight: 500;">${t}</span>`).join('');
                    
                    card.innerHTML = `
                        <div>
                            <h4 style="font-size: 1rem; font-weight: 700; margin: 0 0 0.75rem 0; color: var(--dark); line-height: 1.3;">${course.course_title}</h4>
                            <div style="display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 1.5rem;">
                                ${tagsHtml}
                            </div>
                        </div>
                        <div>
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem;">
                                <a href="${course.redirect_url}" target="_blank" class="btn btn-sm btn-primary" style="border-radius: 20px; padding: 0.4rem 1.2rem; font-size: 0.8rem; background: var(--white); color: var(--primary); border: 1px solid var(--primary); font-weight: 700; text-decoration: none; text-align: center; display: inline-block;">Start now</a>
                                <a href="${course.redirect_url}" target="_blank" style="color: var(--primary); font-size: 0.8rem; text-decoration: none; font-weight: 600;">View details</a>
                            </div>
                            <div style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: var(--dark-muted);">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px; color: var(--dark-muted);"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg>
                                <span style="font-weight: 500;">${course.started_count || '+5.0k'} have started</span>
                            </div>
                        </div>
                    `;
                    carousel.appendChild(card);
                });
                if (courses.length > 0) {
                    prepState.coursesReviewed = true;
                    savePrepState();
                }
            } else {
                carousel.innerHTML = '<div style="color: var(--danger-color); padding: 1rem; width: 100%; text-align: center;">Failed to load recommended courses.</div>';
            }
        } catch (err) {
            console.error("Error loading courses:", err);
            carousel.innerHTML = '<div style="color: var(--danger-color); padding: 1rem; width: 100%; text-align: center;">Failed to load recommended courses.</div>';
        }
    };

    // 10. Load Candidate Table in HR Dashboard
    const loadHRDashboardData = async () => {
        const tableBody = document.getElementById('applicants-table-body');
        const hrCountApplicants = document.getElementById('hr-count-applicants');
        tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Loading applicant profiles...</td></tr>';

        try {
            const response = await fetch('/api/candidates');
            if (response.ok) {
                const candidates = await response.json();
                hrCountApplicants.textContent = candidates.length;

                if (candidates.length === 0) {
                    tableBody.innerHTML = `<tr class="empty-row"><td colspan="6">No applicant profiles submitted yet. Click "Get Started" to upload one.</td></tr>`;
                    return;
                }

                tableBody.innerHTML = '';
                candidates.forEach(cand => {
                    const row = document.createElement('tr');
                    
                    const skillsTags = cand.skills.map(s => `<span class="skill-tag">${s}</span>`).join('');
                    const submittedDate = new Date(cand.createdAt).toLocaleDateString();

                    row.innerHTML = `
                        <td style="font-weight: 700; color: var(--dark);">${cand.fullName}</td>
                        <td>${cand.jobTitle}</td>
                        <td>${cand.experienceLevel}</td>
                        <td><div class="skills-badge-list">${skillsTags}</div></td>
                        <td>${submittedDate}</td>
                        <td style="text-align: right;">
                            <button class="btn btn-outline btn-sm btn-view-md" data-file="${cand.markdownFile}" data-name="${cand.fullName}">
                                View Resume
                            </button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                });

                // Bind view resume actions
                const viewMdButtons = tableBody.querySelectorAll('.btn-view-md');
                viewMdButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        const filename = e.target.getAttribute('data-file');
                        const name = e.target.getAttribute('data-name');
                        openMarkdownPreview(filename, name);
                    });
                });
            } else {
                tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Failed to load data.</td></tr>';
            }
        } catch (err) {
            console.error('Error fetching candidates:', err);
            tableBody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Connection error.</td></tr>';
        }
    };

    // 11. View Candidate's parsed Markdown Resume
    const mdViewModal = document.getElementById('md-view-modal');
    const mdModalClose = document.getElementById('md-modal-close');
    const mdContentBody = document.getElementById('md-content-body');
    const mdViewTitle = document.getElementById('md-view-title');

    const openMarkdownPreview = async (filename, name) => {
        mdViewTitle.textContent = `${name}'s Resume (Parsed Markdown)`;
        mdContentBody.textContent = 'Loading markdown content...';
        mdViewModal.classList.add('active');

        try {
            const response = await fetch(`/uploads/${filename}`);
            if (response.ok) {
                const markdownText = await response.text();
                mdContentBody.textContent = markdownText;
            } else {
                mdContentBody.textContent = 'Failed to load the parsed Markdown resume. File might be missing.';
            }
        } catch (err) {
            console.error('Error fetching markdown resume:', err);
            mdContentBody.textContent = 'Error loading parsed Markdown file.';
        }
    };

    if (mdModalClose) {
        mdModalClose.addEventListener('click', () => {
            mdViewModal.classList.remove('active');
        });
    }

    if (mdViewModal) {
        mdViewModal.addEventListener('click', (e) => {
            if (e.target === mdViewModal) {
                mdViewModal.classList.remove('active');
            }
        });

        const card = mdViewModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // Bind Candidate view my resume button
    const btnViewMyResume = document.getElementById('btn-view-my-resume');
    if (btnViewMyResume) {
        btnViewMyResume.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentUserProfile) {
                openMarkdownPreview(currentUserProfile.markdownFile, currentUserProfile.fullName);
            }
        });
    }

    // 12. Candidate Dashboard Tab Switching
    const tabBtns = document.querySelectorAll('.db-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.getAttribute('data-target');
            
            // Remove active states
            tabBtns.forEach(b => {
                b.classList.remove('active', 'bg-primary-container', 'text-on-primary-container', 'font-medium');
                b.classList.add('text-on-surface-variant', 'hover:bg-surface-container-low', 'hover:text-on-surface');
            });
            document.querySelectorAll('.db-tab-content').forEach(c => {
                c.style.display = 'none';
                c.classList.remove('active');
            });

            // Add active states
            e.target.classList.add('active', 'bg-primary-container', 'text-on-primary-container', 'font-medium');
            e.target.classList.remove('text-on-surface-variant', 'hover:bg-surface-container-low', 'hover:text-on-surface');
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.style.display = 'block';
                targetContent.classList.add('active');
            }

            // Fetch jobs if switching to jobs tab
            if (targetId === 'cand-jobs-view') {
                loadJobOpenings();
            }
            if (targetId === 'cand-hiring-view') {
                renderHiringStatus();
            }
        });
    });

    // 12b. Get AI Recommendations (Gallery)
    let recJobsOffset = 0;
    let currentRecommendations = [];
    let currentRecIndex = 0;
    
    const btnFetchRecs = document.getElementById('btn-fetch-recs');
    const recsLoading = document.getElementById('recs-loading');
    const recsList = document.getElementById('recs-list');

    function renderGallery() {
        // Clear existing gallery items (but keep the fetch button)
        document.querySelectorAll('.recs-gallery-container, .recs-item').forEach(el => el.remove());
        
        if (currentRecommendations.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'recs-item';
            emptyMsg.style = 'color:var(--gray-500); font-size: 0.9rem; text-align: center;';
            emptyMsg.textContent = 'No perfect matches in this batch. Click Refresh to search more.';
            if (btnFetchRecs && btnFetchRecs.parentNode === recsList) {
                recsList.insertBefore(emptyMsg, btnFetchRecs);
            } else {
                recsList.appendChild(emptyMsg);
            }
            return;
        }

        const rec = currentRecommendations[currentRecIndex];
        
        const galleryContainer = document.createElement('div');
        galleryContainer.className = 'recs-gallery-container';
        galleryContainer.style.position = 'relative';
        galleryContainer.style.marginBottom = '1rem';
        
        const recEl = document.createElement('div');
        recEl.className = 'db-card';
        recEl.style.padding = '1.25rem';
        recEl.style.borderLeft = '4px solid var(--primary)';
        recEl.style.position = 'relative';
        recEl.style.transition = 'all 0.3s ease';
        
        recEl.innerHTML = `
            <div style="font-weight: 700; font-size: 1.1rem; color: var(--dark); padding-right: 2rem; margin-bottom: 0.25rem;">${rec.title}</div>
            <div style="font-size: 0.85rem; color: var(--primary); margin-bottom: 0.75rem; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase;">${rec.company}</div>
            <div style="font-size: 0.9rem; line-height: 1.5; color: var(--dark-muted);">${rec.reason}</div>
            <div style="margin-top: 1rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--gray-200); padding-top: 0.75rem;">
                <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: 600; background: var(--gray-100); padding: 2px 8px; border-radius: 12px;">Match ${currentRecIndex + 1} of ${currentRecommendations.length}</span>
                <button class="btn btn-primary btn-sm" onclick="document.getElementById('jobs-search-input').value='${rec.title}'; document.getElementById('jobs-search-input').dispatchEvent(new Event('input'));">View Role</button>
            </div>
        `;

        // Navigation Buttons
        const btnStyle = "position:absolute; top:50%; transform:translateY(-50%); background:var(--white); border:1px solid var(--gray-200); border-radius:50%; width:28px; height:28px; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:12px; opacity:0; transition:all 0.2s; box-shadow:0 2px 8px rgba(0,0,0,0.15); z-index:10; color:var(--dark);";
        
        const btnPrev = document.createElement('button');
        btnPrev.innerHTML = '&#10094;'; // Left Arrow
        btnPrev.style.cssText = btnStyle + 'left:-14px;';
        btnPrev.disabled = currentRecIndex === 0;
        if (btnPrev.disabled) btnPrev.style.color = 'var(--gray-300)';

        const btnNext = document.createElement('button');
        btnNext.innerHTML = '&#10095;'; // Right Arrow
        btnNext.style.cssText = btnStyle + 'right:-14px;';
        btnNext.disabled = currentRecIndex === currentRecommendations.length - 1;
        if (btnNext.disabled) btnNext.style.color = 'var(--gray-300)';

        btnPrev.onclick = () => { if (currentRecIndex > 0) { currentRecIndex--; renderGallery(); } };
        btnNext.onclick = () => { if (currentRecIndex < currentRecommendations.length - 1) { currentRecIndex++; renderGallery(); } };

        galleryContainer.appendChild(recEl);
        galleryContainer.appendChild(btnPrev);
        galleryContainer.appendChild(btnNext);

        galleryContainer.onmouseenter = () => { 
            if(!btnPrev.disabled) btnPrev.style.opacity = '1'; 
            if(!btnNext.disabled) btnNext.style.opacity = '1'; 
            recEl.style.boxShadow = '0 8px 16px rgba(0,0,0,0.08)';
            recEl.style.transform = 'translateY(-2px)';
        };
        galleryContainer.onmouseleave = () => { 
            btnPrev.style.opacity = '0'; 
            btnNext.style.opacity = '0'; 
            recEl.style.boxShadow = '0 4px 6px rgba(0,0,0,0.05)';
            recEl.style.transform = 'translateY(0)';
        };

        if (btnFetchRecs && btnFetchRecs.parentNode === recsList) {
            recsList.insertBefore(galleryContainer, btnFetchRecs);
        } else {
            recsList.appendChild(galleryContainer);
        }
    }

    if (btnFetchRecs) {
        btnFetchRecs.addEventListener('click', async () => {
            if (!currentUserProfile) return;
            
            btnFetchRecs.style.display = 'none';
            recsLoading.style.display = 'block';
            document.querySelectorAll('.recs-gallery-container, .recs-item').forEach(el => el.remove());

            try {
                const response = await fetch('/api/recommend-jobs', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUserProfile.email, offset: recJobsOffset })
                });

                if (response.ok) {
                    const result = await response.json();
                    recsLoading.style.display = 'none';
                    
                    if (Array.isArray(result) && result.length > 0) {
                        currentRecommendations = result;
                        currentRecIndex = 0;
                        renderGallery();
                    } else {
                        currentRecommendations = [];
                        renderGallery();
                    }
                    
                    recJobsOffset += 50; 
                    btnFetchRecs.style.display = 'flex';
                    btnFetchRecs.textContent = 'Refresh Recommendations';
                } else {
                    const errMsg = await response.text();
                    if (errMsg.includes("No more jobs")) {
                        recJobsOffset = 0;
                        const msg = document.createElement('div');
                        msg.className = 'recs-item';
                        msg.style = 'color:var(--gray-500); font-size: 0.9rem; text-align: center;';
                        msg.textContent = 'Reached the end of the database! Click Refresh to start over from the beginning.';
                        if (btnFetchRecs && btnFetchRecs.parentNode === recsList) {
                            recsList.insertBefore(msg, btnFetchRecs);
                        } else {
                            recsList.appendChild(msg);
                        }
                        recsLoading.style.display = 'none';
                        btnFetchRecs.style.display = 'flex';
                        btnFetchRecs.textContent = 'Refresh Recommendations';
                    } else {
                        throw new Error(errMsg);
                    }
                }
            } catch (err) {
                console.error("Recs error:", err);
                alert("Failed to fetch recommendations: " + err.message);
                recsLoading.style.display = 'none';
                btnFetchRecs.style.display = 'inline-flex';
            }
        });
    }

// --- Simulated Email Notification Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const emailModal = document.getElementById('email-notification-modal');
    const btnCloseEmail = document.getElementById('btn-close-email');
    
    if (btnCloseEmail && emailModal) {
        btnCloseEmail.addEventListener('click', () => {
            emailModal.classList.remove('active');
            // If ATS dashboard is open, keep body overflow hidden, otherwise reset it
            const atsModal = document.getElementById('ats-dashboard-modal');
            if (!atsModal || !atsModal.classList.contains('active')) {
                document.body.style.overflow = '';
            }
        });
    }
});

    // 13. Fetch, Paginate, and Render Jobs from Supabase
    let allJobsList = [];      // Stores all retrieved jobs
    let currentJobsPage = 1;  // Active UI page
    const companiesPerPage = 6; // Grouped companies to display per page
    let searchQuery = '';
    let searchDebounceTimeout = null;

    // Helper to group jobs by company and paginate them client-side
    const getGroupedCompaniesPage = (page) => {
        // Group allJobsList by company
        const companyGroups = {};
        allJobsList.forEach(job => {
            if (!companyGroups[job.company]) {
                companyGroups[job.company] = [];
            }
            companyGroups[job.company].push(job);
        });

        const sortedCompanyNames = Object.keys(companyGroups).sort();
        const totalPages = Math.max(1, Math.ceil(sortedCompanyNames.length / companiesPerPage));

        let targetPage = page;
        if (targetPage < 1) targetPage = 1;
        if (targetPage > totalPages) targetPage = totalPages;
        currentJobsPage = targetPage;

        const startIndex = (targetPage - 1) * companiesPerPage;
        const endIndex = startIndex + companiesPerPage;
        const pageCompanies = sortedCompanyNames.slice(startIndex, endIndex);

        const pageGroups = {};
        pageCompanies.forEach(c => {
            pageGroups[c] = companyGroups[c];
        });

        return {
            companies: pageGroups,
            totalPages,
            currentPage: targetPage
        };
    };

    const renderJobsPage = (page = currentJobsPage) => {
        const jobsContainer = document.getElementById('jobs-list-container');
        if (!jobsContainer) return;

        const { companies, totalPages, currentPage } = getGroupedCompaniesPage(page);
        const companyNames = Object.keys(companies);

        jobsContainer.innerHTML = '';

        if (companyNames.length === 0) {
            if (allJobsList.length === 0) {
                jobsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color:var(--gray-500); grid-column: 1/-1;">No jobs found in database.</div>';
            } else {
                jobsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color:var(--gray-500); grid-column: 1/-1;">No matching companies or jobs found.</div>';
            }
            return;
        }

        companyNames.forEach(company => {
            const jobs = companies[company];
            const groupCard = document.createElement('div');
            groupCard.className = 'company-group-card collapsed'; // Collapsed by default
            
            // Header
            const header = document.createElement('div');
            header.className = 'company-group-header';
            header.innerHTML = `
                <div class="company-title-area">
                    <h3>${company}</h3>
                    <span class="company-job-count-badge">${jobs.length} Job${jobs.length > 1 ? 's' : ''}</span>
                </div>
                <div class="company-toggle-icon">▼</div>
            `;

            // Jobs List Container
            const jobsList = document.createElement('div');
            jobsList.className = 'company-jobs-list';

            let renderedCount = 0;
            const jobsLimit = 10; // Render 10 jobs at a time

            const renderMoreJobs = () => {
                const nextBatch = jobs.slice(renderedCount, renderedCount + jobsLimit);
                nextBatch.forEach(job => {
                    const card = document.createElement('div');
                    card.className = 'job-card';
                    const department = job.department || 'Not Specified';
                    const source = job.source || 'Database';

                    const recommendation = geminiJobRecommendations.find(r => r.jobId === job.external_job_id);
                    const scoreBadge = recommendation 
                        ? `<span class="badge" style="background: rgba(16, 185, 129, 0.1); color: #10b981; font-weight: bold; margin-left: 0.5rem; font-size: 0.8rem; text-transform: uppercase;">${recommendation.score}% Match</span>`
                        : '';

                    card.innerHTML = `
                        <div class="job-card-header" style="display: flex; justify-content: space-between; align-items: flex-start; width: 100%;">
                            <div>
                                <h4 class="job-card-title">${job.title}</h4>
                                <span class="job-meta-tag location-tag" style="margin-top: 0.35rem; display: inline-block;">${job.location}</span>
                            </div>
                            ${scoreBadge}
                        </div>
                        <div class="job-card-meta" style="margin: 0.75rem 0;">
                            <span class="job-meta-tag">${department}</span>
                            <span class="job-meta-tag">${source}</span>
                        </div>
                        <div class="job-card-actions" style="margin-top: auto; padding-top: 0.75rem; border-top: 1px solid var(--gray-200);">
                            <a href="${job.application_url}" target="_blank" class="resume-link" style="font-size: 0.85rem;">View Original Post</a>
                            <button class="btn btn-primary btn-sm btn-apply-job" 
                                    data-id="${job.external_job_id}" 
                                    data-title="${job.title}" 
                                    data-company="${job.company}" 
                                    data-url="${job.application_url}">
                                Apply Now
                            </button>
                        </div>
                    `;

                    // Bind apply button handler immediately
                    card.querySelector('.btn-apply-job').addEventListener('click', (e) => {
                        openApplyModal(job.external_job_id, job.title, job.company, job.application_url);
                    });

                    jobsList.appendChild(card);
                });
                renderedCount += nextBatch.length;

                // Remove existing view more button if any
                const existingBtn = groupCard.querySelector('.view-more-jobs-btn');
                if (existingBtn) existingBtn.remove();

                // Add a new "Show More" button if there are more jobs remaining
                if (renderedCount < jobs.length) {
                    const viewMoreBtn = document.createElement('button');
                    viewMoreBtn.className = 'btn btn-outline view-more-jobs-btn';
                    viewMoreBtn.style.cssText = 'grid-column: 1 / -1; margin: 1rem auto 0; display: block; width: fit-content; font-size: 0.85rem; padding: 0.5rem 1.25rem;';
                    viewMoreBtn.textContent = `Show More (+${jobs.length - renderedCount} jobs)`;
                    viewMoreBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        renderMoreJobs();
                    });
                    jobsList.appendChild(viewMoreBtn);
                }
            };

            // Toggle collapse/expand on header click
            header.addEventListener('click', () => {
                const isCollapsed = groupCard.classList.toggle('collapsed');
                // Lazy-render jobs on first expansion
                if (!isCollapsed && renderedCount === 0) {
                    renderMoreJobs();
                }
            });

            groupCard.appendChild(header);
            groupCard.appendChild(jobsList);
            jobsContainer.appendChild(groupCard);
        });

        // Update pagination labels & buttons
        const pageInfo = document.getElementById('jobs-page-info');
        if (pageInfo) pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

        const btnPrev = document.getElementById('btn-jobs-prev');
        const btnNext = document.getElementById('btn-jobs-next');
        if (btnPrev) btnPrev.disabled = currentPage === 1;
        if (btnNext) btnNext.disabled = currentPage === totalPages;

        // Bind Apply Now handlers to open Apply Modal
        const applyButtons = jobsContainer.querySelectorAll('.btn-apply-job');
        applyButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const jobId = e.target.getAttribute('data-id');
                const title = e.target.getAttribute('data-title');
                const company = e.target.getAttribute('data-company');
                const url = e.target.getAttribute('data-url');
                openApplyModal(jobId, title, company, url);
            });
        });
    };

    const loadJobOpenings = async () => {
        const jobsContainer = document.getElementById('jobs-list-container');
        if (!jobsContainer) return;

        // If already loaded, just render
        if (allJobsList.length > 0) {
            renderJobsPage(currentJobsPage);
            return;
        }

        jobsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; grid-column: 1/-1;">Loading jobs...</div>';

        try {
            // 1. Fetch the first batch (page 1, limit 200)
            const firstBatchRes = await fetch(`/api/jobs?page=1&limit=200&search=${encodeURIComponent(searchQuery)}`);
            if (firstBatchRes.ok) {
                const firstBatchData = await firstBatchRes.json();
                allJobsList = firstBatchData.jobs;
                populatePracticeJobSelect();
                populateEvalJobSelect();
                
                // Render batch 1 instantly so the user sees companies right away
                renderJobsPage(1);

                // 2. Fetch the remaining batches sequentially in the background to fully retrieve without lag
                const totalRecords = firstBatchData.total;
                const totalPagesCount = Math.ceil(totalRecords / 200);

                if (totalPagesCount > 1) {
                    // Create a visual indicator in pagination info that background load is running
                    const pageInfo = document.getElementById('jobs-page-info');
                    const originalText = pageInfo ? pageInfo.textContent : '';
                    if (pageInfo) pageInfo.textContent = `${originalText} (Retrieving rest...)`;

                    // Run sequentially to prevent network congestion
                    for (let p = 2; p <= totalPagesCount; p++) {
                        try {
                            const batchRes = await fetch(`/api/jobs?page=${p}&limit=200&search=${encodeURIComponent(searchQuery)}`);
                            if (batchRes.ok) {
                                const batchData = await batchRes.json();
                                allJobsList = allJobsList.concat(batchData.jobs);
                                populatePracticeJobSelect();
                                populateEvalJobSelect();
                                // Soft render to include newly retrieved jobs without locking UI
                                renderJobsPage(currentJobsPage);
                            }
                        } catch (batchErr) {
                            console.error(`Error retrieving batch ${p}:`, batchErr);
                        }
                    }
                    
                    // Final update of pagination labels once fully retrieved
                    renderJobsPage(currentJobsPage);
                }
            } else {
                jobsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color:red; grid-column: 1/-1;">Failed to retrieve job listings.</div>';
            }
        } catch (err) {
            console.error('Error fetching jobs:', err);
            jobsContainer.innerHTML = '<div style="text-align:center; padding: 2rem; color:red; grid-column: 1/-1;">Connection error while loading jobs.</div>';
        }
    };

    // Bind Search and Filter Input Controls
    const searchInput = document.getElementById('jobs-search-input');

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchDebounceTimeout);
            searchDebounceTimeout = setTimeout(() => {
                searchQuery = e.target.value.trim();
                currentJobsPage = 1;
                allJobsList = [];
                loadJobOpenings();
            }, 300);
        });
    }

    // Bind Pagination Button Click Handlers
    const btnPrev = document.getElementById('btn-jobs-prev');
    const btnNext = document.getElementById('btn-jobs-next');
    if (btnPrev) {
        btnPrev.addEventListener('click', () => {
            if (currentJobsPage > 1) {
                renderJobsPage(currentJobsPage - 1);
            }
        });
    }
    if (btnNext) {
        btnNext.addEventListener('click', () => {
            const { totalPages } = getGroupedCompaniesPage(currentJobsPage);
            if (currentJobsPage < totalPages) {
                renderJobsPage(currentJobsPage + 1);
            }
        });
    }

    // 14. Apply Modal controls & PDF Extraction
    const applyModal = document.getElementById('apply-job-modal');
    const applyClose = document.getElementById('apply-modal-close');
    const applyForm = document.getElementById('apply-job-form');
    const applyFileInput = document.getElementById('apply-resume-file');
    const applyFileNameDisplay = document.getElementById('apply-file-name-display');
    const extractionStatus = document.getElementById('extraction-status');
    const extractionStatusText = document.getElementById('extraction-status-text');
    const extractionSpinner = document.getElementById('extraction-spinner');
    const applySubmitBtn = document.getElementById('apply-submit-btn');
    const applyLoader = document.getElementById('apply-loader');

    let extractedResumeText = '';

    const openApplyModal = (jobId, title, company, url) => {
        document.getElementById('apply-job-id').value = jobId;
        document.getElementById('apply-job-url').value = url || `https://recruitease.com/jobs/${jobId}`;
        document.getElementById('apply-job-title').textContent = `Apply for: ${title}`;
        document.getElementById('apply-job-company').textContent = company;
        
        // Reset states
        applyForm.reset();
        applyFileNameDisplay.textContent = 'No file chosen';
        extractionStatus.style.display = 'none';
        applySubmitBtn.disabled = true;
        extractedResumeText = '';

        applyModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeApplyModal = () => {
        applyModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (applyClose) {
        applyClose.addEventListener('click', closeApplyModal);
    }

    if (applyModal) {
        applyModal.addEventListener('click', (e) => {
            if (e.target === applyModal) {
                closeApplyModal();
            }
        });
        
        const card = applyModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // PDF Text Extraction Logic
    if (applyFileInput) {
        applyFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) {
                applyFileNameDisplay.textContent = 'No file chosen';
                extractionStatus.style.display = 'none';
                applySubmitBtn.disabled = true;
                return;
            }

            applyFileNameDisplay.textContent = file.name;
            
            // Show extraction loading spinner
            extractionStatus.style.display = 'flex';
            extractionSpinner.style.display = 'block';
            extractionStatusText.textContent = 'Extracting plain text from PDF...';
            applySubmitBtn.disabled = true;

            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                let fullText = '';

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n';
                }

                // Clean extracted text (remove HTML, Markdown, duplicate spaces)
                extractedResumeText = cleanExtractedText(fullText);
                console.log('Cleaned Extracted Resume Text:', extractedResumeText);

                // Update UI state
                extractionSpinner.style.display = 'none';
                extractionStatusText.textContent = 'Text extracted & cleaned successfully! ✓';
                applySubmitBtn.disabled = false;
            } catch (err) {
                console.error('Error extracting PDF text:', err);
                extractionSpinner.style.display = 'none';
                extractionStatusText.textContent = 'Error parsing PDF. Try another file.';
                applySubmitBtn.disabled = true;
            }
        });
    }

    // Clean Extracted Text and Convert to Markdown Helper
    const cleanExtractedText = (text) => {
        if (!text) return '';
        // 1. Remove HTML tags
        let clean = text.replace(/<[^>]*>/g, '');
        // 2. Normalize newlines
        clean = clean.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
        // 3. Trim whitespace per line and filter empty
        let lines = clean.split('\n')
                     .map(line => line.trim())
                     .filter(line => line.length > 0);
        
        // 4. Heuristic Markdown Conversion
        let markdownLines = lines.map(line => {
            // If line is short and doesn't end with punctuation, assume it's a header
            if (line.length > 2 && line.length < 40 && !/[.,;:]$/.test(line)) {
                return `## ${line}`;
            }
            // If line starts with a bullet or dash, ensure it has a markdown bullet
            if (/^[•·\-\*]/.test(line)) {
                return `- ${line.substring(1).trim()}`;
            }
            // Otherwise, it's a regular paragraph line or list item
            return line;
        });

        return markdownLines.join('\n\n');
    };

    // 15. Submit Application to SNS Workbench Webhook
    if (applyForm) {
        applyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!WORKBENCH_WEBHOOK_URL) {
                alert('Workbench Webhook configuration has not loaded yet. Please wait a moment.');
                return;
            }

            applySubmitBtn.disabled = true;
            applyLoader.style.display = 'block';
            applySubmitBtn.querySelector('span').textContent = 'Submitting to ATS...';

            const job_id = document.getElementById('apply-job-id').value;
            lastAppliedJobId = job_id;
            const application_url = document.getElementById('apply-job-url').value;

            let jobRequirements = null;
            try {
                const jobRes = await fetch(`/api/jobs/${job_id}`);
                if (jobRes.ok) {
                    jobRequirements = await jobRes.json();
                } else {
                    console.warn('Failed to fetch job requirements for webhook payload.');
                    alert('Warning: Could not fetch Job Requirements from the local server. Did you restart server.js? The SNS Agent might fail without them.');
                }
            } catch (err) {
                console.error('Error fetching job details:', err);
                alert('Warning: Error fetching Job Requirements from the local server. Is the server running?');
            }

            const payload = {
                action: 'resume_screening',
                external_job_id: job_id,
                job_id: job_id,
                candidate_name: 'Candidate',
                candidate_email: 'candidate@example.com',
                candidate_phone: '555-0100',
                resume_text: extractedResumeText,
                resume_markdown: extractedResumeText
            };

            try {
                // Hitting the local backend because the SNS Workflow is bugged and cannot be fixed from the frontend
                const response = await fetch('http://localhost:8000/api/eval-resume', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.ok) {
                    let data = await response.json();
                    let responseText = data.response || data.result || data;
                    
                    let evaluationData;
                    if (typeof responseText === 'string') {
                        // Extract JSON blocks if present
                        const jsonBlocks = [...responseText.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)];
                        let jsonStrToParse = responseText;
                        
                        if (jsonBlocks.length > 0) {
                            // Use the last JSON block (often the 'Final Evaluation')
                            jsonStrToParse = jsonBlocks[jsonBlocks.length - 1][1].trim();
                        } else {
                            jsonStrToParse = jsonStrToParse.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
                        }

                        try {
                            evaluationData = JSON.parse(jsonStrToParse);
                        } catch (parseErr) {
                            console.error('JSON parsing failed. Raw response:', responseText);
                            alert('Failed to parse evaluation response as JSON: ' + parseErr.message + '\n\nRaw Response: ' + jsonStrToParse.substring(0, 300));
                            return;
                        }
                    } else {
                        evaluationData = responseText;
                    }
                    
                    console.log('SNS Workbench ATS evaluation:', evaluationData);

                    closeApplyModal();
                    openATSDashboard(evaluationData);

                    if (!isPracticeEvaluation) {
                        const title = document.getElementById('apply-job-title').textContent.replace('Apply for: ', '');
                        const company = document.getElementById('apply-job-company').textContent;
                        const overallScore = evaluationData.overall_score || 0;
                        const currentStatus = overallScore >= 70 ? 'NOVA Evaluation' : 'Resume Screening';
                        saveAppliedJob(job_id, title, company, currentStatus);
                    }

                    // Check if score is >= 70 to simulate email invitation to NOVA test
                    if (!isPracticeEvaluation && evaluationData && evaluationData.overall_score >= 70) {
                        setTimeout(async () => {
                            // Call the backend to send the actual email
                            const candidateEmail = (currentUserProfile && currentUserProfile.email) ? currentUserProfile.email : 'aadiljm2007@gmail.com';
                            try {
                                await fetch('/api/send-nova-invite', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        email: candidateEmail,
                                        candidateName: (currentUserProfile && currentUserProfile.fullName) ? currentUserProfile.fullName : 'Candidate',
                                        score: evaluationData.overall_score
                                    })
                                });
                            } catch (e) {
                                console.error('Failed to send email invite', e);
                            }

                            // Show the modal notification as well
                            const emailModal = document.getElementById('email-notification-modal');
                            const scoreDisplay = document.getElementById('email-ats-score');
                            if (emailModal && scoreDisplay) {
                                scoreDisplay.textContent = evaluationData.overall_score + '%';
                                emailModal.classList.add('active');
                                document.body.style.overflow = 'hidden';
                            }
                        }, 2000); // 2 second delay to simulate email arrival
                    }
                } else {
                    const errText = await response.text();
                    alert('ATS Evaluation failed: ' + errText);
                }
            } catch (err) {
                console.error('Error submitting application:', err);
                alert('Network connection error: ' + err.message + '. Failed to post to SNS Webhook.');
            } finally {
                applySubmitBtn.disabled = false;
                applyLoader.style.display = 'none';
                applySubmitBtn.querySelector('span').textContent = 'Submit to ATS Review';
            }
        });
    }

    // 16. ATS Dashboard Modal Population & Controls
    const atsModal = document.getElementById('ats-dashboard-modal');
    const atsModalClose = document.getElementById('ats-modal-close');
    const btnAtsDone = document.getElementById('btn-ats-done');

    const openATSDashboard = (data) => {
        // Status Badge
        const statusBadge = document.getElementById('ats-status-badge');
        const recommendation = data.recommendation || data.status || 'Screened';
        
        // Populate ATS fields with Practice Mode labels if active
        if (isPracticeEvaluation) {
            document.getElementById('ats-candidate-name').textContent = `${data.candidate_name || 'Candidate'} (Personal Practice)`;
            statusBadge.textContent = `${recommendation} (Practice)`;
            prepState.atsChecked = true;
            savePrepState();
        } else {
            document.getElementById('ats-candidate-name').textContent = data.candidate_name || 'Candidate Name';
            statusBadge.textContent = recommendation;
        }
        
        statusBadge.className = 'ats-badge'; // reset
        if (recommendation.toLowerCase().includes('short') || recommendation.toLowerCase().includes('strong') || recommendation.toLowerCase().includes('select')) {
            statusBadge.classList.add('shortlisted');
        }

        // Scores
        document.getElementById('ats-score-overall').textContent = data.overall_score || '0';
        document.getElementById('ats-score-tech').textContent = `${data.technical_score ?? 0}/30`;
        document.getElementById('ats-score-exp').textContent = `${data.experience_score ?? 0}/20`;
        document.getElementById('ats-score-proj').textContent = `${data.projects_score ?? 0}/15`;
        document.getElementById('ats-score-edu').textContent = `${data.education_score ?? 0}/10`;
        document.getElementById('ats-score-pref').textContent = `${data.preferred_skill_score ?? 0}/10`;
        document.getElementById('ats-score-kw').textContent = `${data.keyword_score ?? 0}/15`;

        // Executive Summary
        document.getElementById('ats-summary-text').textContent = data.summary || 'No summary text returned.';

        // Matched Skills
        const matchedContainer = document.getElementById('ats-matched-skills-list');
        matchedContainer.innerHTML = '';
        if (data.matched_skills && data.matched_skills.length > 0) {
            data.matched_skills.forEach(skill => {
                const tag = document.createElement('span');
                tag.className = 'skill-tag';
                tag.textContent = skill;
                matchedContainer.appendChild(tag);
            });
        } else {
            matchedContainer.innerHTML = '<span style="font-size:0.85rem;color:var(--gray-400);">None detected</span>';
        }

        // Missing Skills
        const missingContainer = document.getElementById('ats-missing-skills-list');
        missingContainer.innerHTML = '';
        if (data.missing_skills && data.missing_skills.length > 0) {
            data.missing_skills.forEach(skill => {
                const tag = document.createElement('span');
                tag.className = 'skill-tag';
                tag.style.borderColor = '#FCA5A5';
                tag.style.color = '#EF4444';
                tag.style.backgroundColor = '#FEF2F2';
                tag.textContent = skill;
                missingContainer.appendChild(tag);
            });
        } else {
            missingContainer.innerHTML = '<span style="font-size:0.85rem;color:var(--gray-400);">None detected</span>';
        }

        // Strengths
        const strengthsList = document.getElementById('ats-strengths-list');
        strengthsList.innerHTML = '';
        if (data.strengths && data.strengths.length > 0) {
            data.strengths.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                strengthsList.appendChild(li);
            });
        } else {
            strengthsList.innerHTML = '<li>No strengths noted</li>';
        }

        // Weaknesses
        const weaknessesList = document.getElementById('ats-weaknesses-list');
        weaknessesList.innerHTML = '';
        if (data.weaknesses && data.weaknesses.length > 0) {
            data.weaknesses.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                weaknessesList.appendChild(li);
            });
        } else {
            weaknessesList.innerHTML = '<li>No weaknesses noted</li>';
        }

        // Interview Focus
        const focusList = document.getElementById('ats-focus-list');
        focusList.innerHTML = '';
        if (data.interview_focus && data.interview_focus.length > 0) {
            data.interview_focus.forEach(item => {
                const li = document.createElement('li');
                li.textContent = item;
                focusList.appendChild(li);
            });
        } else {
            focusList.innerHTML = '<li>No specific items noted</li>';
        }

        atsModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    };

    const closeATSDashboard = () => {
        atsModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (atsModalClose) {
        atsModalClose.addEventListener('click', closeATSDashboard);
    }
    if (btnAtsDone) {
        btnAtsDone.addEventListener('click', closeATSDashboard);
    }
    if (atsModal) {
        atsModal.addEventListener('click', (e) => {
            if (e.target === atsModal) {
                closeATSDashboard();
            }
        });
        const card = atsModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    // 17b. Edit profile picture from Candidate dashboard
    const candPicCircle = document.getElementById('cand-profile-pic');
    const candPicFileInput = document.getElementById('cand-pic-file-input');

    if (candPicCircle && candPicFileInput) {
        // Trigger file input click when clicking on the avatar circle
        candPicCircle.addEventListener('click', () => {
            candPicFileInput.click();
        });

        // Trigger upload when a file is selected
        candPicFileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !currentUserProfile) return;

            const formData = new FormData();
            formData.append('email', currentUserProfile.email);
            formData.append('profilePic', file);

            try {
                // Show visual upload feedback by temporarily lowering opacity
                candPicCircle.style.opacity = '0.5';
                
                const response = await fetch('/api/profile/avatar', {
                    method: 'POST',
                    body: formData
                });

                if (response.ok) {
                    const result = await response.json();
                    
                    // Update user memory structure
                    currentUserProfile.profilePic = result.profilePic;
                    
                    // Re-render user avatars across elements
                    const imgHtml = `<img src="${result.profilePic}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    const avatar = document.getElementById('db-user-avatar');
                    
                    avatar.innerHTML = imgHtml;
                    avatar.style.backgroundColor = 'transparent';
                    
                    candPicCircle.innerHTML = imgHtml;
                    candPicCircle.style.backgroundColor = 'transparent';
                } else {
                    const err = await response.text();
                    alert('Failed to update profile picture: ' + err);
                }
            } catch (err) {
                console.error('Error uploading avatar:', err);
                alert('Connection error. Failed to save new profile picture.');
            } finally {
                candPicCircle.style.opacity = '1';
            }
        });
    }

    // 17. Logout
    
    // 18. AI Interview Assistant Interactive Logic
    const aiInterviewModal = document.getElementById('ai-interview-modal');
    const interviewModalClose = document.getElementById('interview-modal-close');
    const btnAtsStartInterview = document.getElementById('btn-ats-start-interview');
    const btnStartInterviewConfirm = document.getElementById('btn-start-interview-confirm');
    const btnSubmitAnswer = document.getElementById('btn-submit-answer');
    const btnInterviewDone = document.getElementById('btn-interview-done');
    
    const interviewStartScreen = document.getElementById('interview-start-screen');
    const interviewQuestionScreen = document.getElementById('interview-question-screen');
    const interviewGradingScreen = document.getElementById('interview-grading-screen');
    
    const interviewQuestionText = document.getElementById('interview-question-text');
    const interviewAnswerInput = document.getElementById('interview-answer-input');
    const charCountDisplay = document.getElementById('char-count-display');
    const interviewJobTitle = document.getElementById('interview-job-title');
    const interviewDemoBadge = document.getElementById('interview-demo-badge');
    const interviewProgressFill = document.getElementById('interview-progress-fill');
    const questionNumberLabel = document.getElementById('question-number-label');
    
    let interviewQuestions = [];
    let interviewAnswers = [];
    let activeInterviewJobId = '';
    let currentQuestionIdx = 0;
    let isPracticeEvaluation = false;

    const populatePracticeJobSelect = () => {
        const select = document.getElementById('practice-job-select');
        if (!select) return;

        select.innerHTML = '<option value="" disabled selected>Select a job...</option>';
        
        allJobsList.forEach(job => {
            const opt = document.createElement('option');
            opt.value = job.external_job_id;
            opt.textContent = `${job.title} at ${job.company} (${job.location})`;
            select.appendChild(opt);
        });
    };

    const populateEvalJobSelect = () => {
        const select = document.getElementById('eval-job-select');
        if (!select) return;

        select.innerHTML = '<option value="" disabled selected>Select a job role...</option>';
        
        allJobsList.forEach(job => {
            const opt = document.createElement('option');
            opt.value = job.external_job_id;
            opt.textContent = `${job.title} at ${job.company} (${job.location})`;
            select.appendChild(opt);
        });
    };

    const openInterviewModal = async (e) => {
        let jobId = lastAppliedJobId;
        
        if (isPracticeEvaluation) {
            prepState.interviewPracticed = true;
            savePrepState();
        }
        
        // Check if we are running in practice mode
        const practiceSelect = document.getElementById('practice-job-select');
        const evalSelect = document.getElementById('eval-job-select');
        const isPractice = e && e.target && (e.target.id === 'btn-start-practice-interview' || e.target.closest('#btn-evaluate-interviews'));

        if (isPractice) {
            if (e.target.closest('#btn-evaluate-interviews')) {
                if (evalSelect) {
                    jobId = evalSelect.value;
                }
                if (!jobId) {
                    alert('Please select a job role from the Target Role dropdown first before starting your personal interview.');
                    return;
                }
            } else {
                if (practiceSelect) {
                    jobId = practiceSelect.value;
                }
                if (!jobId) {
                    alert('Please select a job role from the dropdown first before starting the practice interview.');
                    return;
                }
            }
        } else {
            if (!jobId) {
                const preferred = (currentUserProfile && currentUserProfile.jobTitle) ? currentUserProfile.jobTitle.toLowerCase() : '';
                const matchedJob = allJobsList.find(j => j.title.toLowerCase().includes(preferred)) || allJobsList[0];
                if (matchedJob) {
                    jobId = matchedJob.external_job_id;
                } else {
                    await loadJobOpenings();
                    const fallbackJob = allJobsList[0];
                    if (fallbackJob) {
                        jobId = fallbackJob.external_job_id;
                    }
                }
            }
        }

        if (!jobId) {
            alert('No job listings available in the database for the practice interview. Please try again.');
            return;
        }

        activeInterviewJobId = jobId;
        // Close ATS modal if open
        closeATSDashboard();

        // Reset state
        interviewQuestions = [];
        interviewAnswers = [];
        currentQuestionIdx = 0;
        interviewAnswerInput.value = '';
        charCountDisplay.textContent = '0 characters typed';
        
        // Reset screens
        interviewStartScreen.style.display = 'block';
        interviewQuestionScreen.style.display = 'none';
        interviewGradingScreen.style.display = 'none';
        
        document.getElementById('interview-start-spinner').style.display = 'block';
        document.getElementById('interview-start-title').textContent = 'Preparing Your Interview';
        document.getElementById('interview-start-desc').textContent = 'Our AI is analyzing the job requirements to generate scenario-based questions...';
        btnStartInterviewConfirm.style.display = 'none';
        interviewDemoBadge.style.display = 'none';

        aiInterviewModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        try {
            const res = await fetch('/api/interview/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jobId: activeInterviewJobId })
            });

            if (res.ok) {
                const data = await res.json();
                interviewQuestions = data.questions;
                interviewJobTitle.textContent = `${data.jobTitle} at ${data.company}`;

                if (data.isDemoMode) {
                    interviewDemoBadge.style.display = 'inline-block';
                }

                // Ready to start
                document.getElementById('interview-start-spinner').style.display = 'none';
                document.getElementById('interview-start-title').textContent = 'Interview Prepared!';
                document.getElementById('interview-start-desc').textContent = 'The AI has compiled 3 challenging scenario questions based on this role. Click below to begin.';
                btnStartInterviewConfirm.style.display = 'block';
            } else {
                throw new Error(await res.text());
            }
        } catch (err) {
            console.error('Error starting interview:', err);
            document.getElementById('interview-start-spinner').style.display = 'none';
            document.getElementById('interview-start-title').textContent = 'Preparation Failed';
            document.getElementById('interview-start-desc').textContent = 'Connection error while generating questions. Please try again.';
        }
    };

    const closeInterviewModal = () => {
        aiInterviewModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    const renderQuestion = () => {
        if (currentQuestionIdx >= interviewQuestions.length) {
            submitInterviewAnswers();
            return;
        }

        questionNumberLabel.textContent = `Question ${currentQuestionIdx + 1} of ${interviewQuestions.length}`;
        interviewQuestionText.textContent = interviewQuestions[currentQuestionIdx];
        interviewAnswerInput.value = '';
        charCountDisplay.textContent = '0 characters typed';
        
        // Progress fill
        const progressPct = ((currentQuestionIdx + 1) / interviewQuestions.length) * 100;
        interviewProgressFill.style.width = `${progressPct}%`;

        // Update button text
        if (currentQuestionIdx === interviewQuestions.length - 1) {
            btnSubmitAnswer.textContent = 'Submit Assessment';
        } else {
            btnSubmitAnswer.textContent = 'Next Question';
        }
    };

    const submitInterviewAnswers = async () => {
        interviewQuestionScreen.style.display = 'none';
        interviewStartScreen.style.display = 'block';
        
        document.getElementById('interview-start-spinner').style.display = 'block';
        document.getElementById('interview-start-title').textContent = 'Evaluating Answers';
        document.getElementById('interview-start-desc').textContent = 'Grading statement Innovation, Relevancy, Accuracy, and Tone... Please wait.';
        btnStartInterviewConfirm.style.display = 'none';

        try {
            const payload = {
                jobId: activeInterviewJobId,
                questions: interviewQuestions,
                answers: interviewAnswers
            };
            if (!isPracticeEvaluation && currentUserProfile) {
                payload.candidateEmail = currentUserProfile.email;
            }

            const res = await fetch('/api/interview/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const result = await res.json();
                const evalData = result.evaluation;

                // Draw scorecard
                document.getElementById('score-val-innovation').textContent = `${evalData.scores.innovation}/100`;
                document.getElementById('score-bar-innovation').style.width = `${evalData.scores.innovation}%`;

                document.getElementById('score-val-relevancy').textContent = `${evalData.scores.relevancy}/100`;
                document.getElementById('score-bar-relevancy').style.width = `${evalData.scores.relevancy}%`;

                document.getElementById('score-val-accuracy').textContent = `${evalData.scores.accuracy}/100`;
                document.getElementById('score-bar-accuracy').style.width = `${evalData.scores.accuracy}%`;

                document.getElementById('score-val-tone').textContent = `${evalData.scores.tone}/100`;
                document.getElementById('score-bar-tone').style.width = `${evalData.scores.tone}%`;

                document.getElementById('score-val-overall').textContent = `${evalData.overallScore}%`;

                // Set Rank/Label
                const rankLabel = document.getElementById('score-rank-label');
                rankLabel.textContent = evalData.overallScore >= 90 ? 'Exceptional' : 
                                        evalData.overallScore >= 80 ? 'Highly Competent' : 
                                        evalData.overallScore >= 70 ? 'Competent' : 'Needs Practice';
                
                if (evalData.overallScore >= 80) {
                    rankLabel.style.color = 'var(--success)';
                    rankLabel.style.background = 'var(--primary-light)';
                } else if (evalData.overallScore >= 70) {
                    rankLabel.style.color = '#D97706';
                    rankLabel.style.background = '#FEF3C7';
                } else {
                    rankLabel.style.color = '#EF4444';
                    rankLabel.style.background = '#FEF2F2';
                }

                // Comments
                document.getElementById('interview-feedback-strengths').textContent = evalData.feedback.strengths;
                document.getElementById('interview-feedback-weaknesses').textContent = evalData.feedback.weaknesses;
                document.getElementById('interview-feedback-analysis').textContent = evalData.feedback.detailedAnalysis;

                interviewStartScreen.style.display = 'none';
                interviewGradingScreen.style.display = 'block';
            } else {
                throw new Error(await res.text());
            }
        } catch (err) {
            console.error('Error submitting assessment:', err);
            document.getElementById('interview-start-spinner').style.display = 'none';
            document.getElementById('interview-start-title').textContent = 'Evaluation Failed';
            document.getElementById('interview-start-desc').textContent = 'Connection error while saving grades. Please try again.';
        }
    };

    // Event listeners
    if (btnAtsStartInterview) {
        btnAtsStartInterview.addEventListener('click', (e) => {
            isPracticeEvaluation = false;
            openInterviewModal(e);
        });
    }
    const btnStartPracticeInterview = document.getElementById('btn-start-practice-interview');
    if (btnStartPracticeInterview) {
        btnStartPracticeInterview.addEventListener('click', (e) => {
            isPracticeEvaluation = true;
            openInterviewModal(e);
        });
    }
    const btnEvaluateInterviews = document.getElementById('btn-evaluate-interviews');
    if (btnEvaluateInterviews) {
        btnEvaluateInterviews.addEventListener('click', (e) => {
            const evalSelect = document.getElementById('eval-job-select');
            if (!evalSelect || !evalSelect.value) {
                alert('Please select a job role from the Target Role dropdown first.');
                return;
            }
            isPracticeEvaluation = true;
            openInterviewModal(e);
        });
    }
    const btnEvaluateResumeCompat = document.getElementById('btn-evaluate-resume-compat');
    if (btnEvaluateResumeCompat) {
        btnEvaluateResumeCompat.addEventListener('click', async (e) => {
            e.preventDefault();
            const evalSelect = document.getElementById('eval-job-select');
            if (!evalSelect || !evalSelect.value) {
                alert('Please select a job role from the Target Role dropdown first.');
                return;
            }
            isPracticeEvaluation = true;
            
            const jobId = evalSelect.value;
            const matchedJob = allJobsList.find(j => j.external_job_id === jobId);
            
            let title = 'Account Executive';
            let company = 'RecruitEase';
            let url = '';

            if (matchedJob) {
                title = matchedJob.title;
                company = matchedJob.company;
                url = matchedJob.application_url;
            }

            openApplyModal(jobId, title, company, url);
        });
    }
    const btnEvaluateEvaluation = document.getElementById('btn-evaluate-evaluation');
    if (btnEvaluateEvaluation) {
        btnEvaluateEvaluation.addEventListener('click', (e) => {
            e.preventDefault();
            const evalSelect = document.getElementById('eval-job-select');
            if (!evalSelect || !evalSelect.value) {
                alert('Please select a job role from the Target Role dropdown first.');
                return;
            }
            prepState.testPracticed = true;
            savePrepState();
            const jobId = evalSelect.value;
            window.open(`/nova/test-setup?practice=true&jobId=${jobId}`, '_blank');
        });
    }
    if (interviewModalClose) {
        interviewModalClose.addEventListener('click', closeInterviewModal);
    }
    if (aiInterviewModal) {
        aiInterviewModal.addEventListener('click', (e) => {
            if (e.target === aiInterviewModal) {
                closeInterviewModal();
            }
        });
        const card = aiInterviewModal.querySelector('.modal-card');
        if (card) {
            card.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }
    }

    if (btnStartInterviewConfirm) {
        btnStartInterviewConfirm.addEventListener('click', () => {
            interviewStartScreen.style.display = 'none';
            interviewQuestionScreen.style.display = 'block';
            renderQuestion();
        });
    }

    if (interviewAnswerInput) {
        interviewAnswerInput.addEventListener('input', (e) => {
            charCountDisplay.textContent = `${e.target.value.length} characters typed`;
        });
    }

    if (btnSubmitAnswer) {
        btnSubmitAnswer.addEventListener('click', () => {
            const answer = interviewAnswerInput.value.trim();
            if (!answer) {
                alert('Please type an answer before proceeding.');
                return;
            }
            interviewAnswers.push(answer);
            currentQuestionIdx++;
            renderQuestion();
        });
    }

    if (btnInterviewDone) {
        btnInterviewDone.addEventListener('click', closeInterviewModal);
    }

    // 17. Logout
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            // Reset Candidate tab states back to status tab
            tabBtns.forEach((b, idx) => {
                if (idx === 0) b.classList.add('active');
                else b.classList.remove('active');
            });
            document.querySelectorAll('.db-tab-content').forEach((c, idx) => {
                if (idx === 0) c.style.display = 'block';
                else c.style.display = 'none';
            });

            dashboardView.classList.remove('active');
            document.body.classList.remove('dashboard-active');
            document.body.style.overflow = '';
            localStorage.removeItem('currentUserProfile');
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('sb-ldcfkvvxtpyttvvgkifp-auth-token');
            currentUserProfile = null;
            if (supabase) {
                supabase.auth.signOut().catch(err => console.error('Error signing out from Supabase:', err));
            }
        });
    }

    // Auto-restore session on refresh — verify the profile still exists on the server
    (async () => {
        const savedUser = localStorage.getItem('currentUserProfile');
        const savedRole = localStorage.getItem('currentUserRole');
        if (savedUser && savedRole) {
            try {
                const parsed = JSON.parse(savedUser);
                const verifyRes = await fetch('/api/verify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: parsed.email, role: savedRole })
                });
                const verifyData = await verifyRes.json();
                if (verifyData.valid) {
                    if (window.location.hash === '#edit-profile') {
                        // Set the current user profile so openEditModal can read it
                        currentUserProfile = verifyData.user;
                        localStorage.setItem('currentUserProfile', JSON.stringify(currentUserProfile));
                        localStorage.setItem('currentUserRole', verifyData.role);
                        history.replaceState(null, '', window.location.pathname); // clean hash
                        openEditModal(null); // Open the EDIT modal (not signup)
                    } else {
                        checkResumeAndEnter(verifyData.user, verifyData.role);
                    }
                } else {
                    // Profile no longer exists — clear stale session
                    localStorage.removeItem('currentUserProfile');
                    localStorage.removeItem('currentUserRole');
                    localStorage.removeItem('sb-ldcfkvvxtpyttvvgkifp-auth-token');
                    console.log('Stale session cleared — please log in again.');
                }
            } catch (e) {
                console.error('Failed to restore session:', e);
                localStorage.removeItem('currentUserProfile');
                localStorage.removeItem('currentUserRole');
                localStorage.removeItem('sb-ldcfkvvxtpyttvvgkifp-auth-token');
            }
        }

    // --- AI Self-Intro Generator Interaction ---
    let generatedSelfIntros = null;
    let activeIntroTab = 'elevator';

    const btnGenerateIntro = document.getElementById('btn-generate-self-intro');
    const introText = document.getElementById('self-intro-text');
    const btnCopyIntro = document.getElementById('btn-copy-self-intro');
    const selfIntroTabBtns = document.querySelectorAll('.self-intro-tab-btn');

    if (btnGenerateIntro) {
        btnGenerateIntro.addEventListener('click', async () => {
            if (!currentUserProfile || !currentUserProfile.email) {
                alert('Please upload your resume first to generate a pitch.');
                return;
            }

            btnGenerateIntro.disabled = true;
            btnGenerateIntro.textContent = 'Generating...';
            introText.innerHTML = '<span style="color: var(--primary);">Analyzing resume and drafting professional pitches...</span>';

            try {
                const res = await fetch('/api/generate-self-intro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUserProfile.email })
                });

                if (res.ok) {
                    generatedSelfIntros = await res.json();
                    renderActiveIntroPitch();
                    if (btnCopyIntro) btnCopyIntro.style.display = 'block';
                    const btnPractice = document.getElementById('btn-practice-speak');
                    if (btnPractice) btnPractice.style.display = 'inline-flex';
                } else {
                    const err = await res.text();
                    introText.textContent = 'Failed to generate pitches: ' + err;
                }
            } catch (err) {
                console.error(err);
                introText.textContent = 'Connection error while contacting Gemini API.';
            } finally {
                btnGenerateIntro.disabled = false;
                btnGenerateIntro.textContent = 'Generate Pitch';
            }
        });
    }

    // --- Speech Practice Functionality ---
    const btnPractice = document.getElementById('btn-practice-speak');
    const speechPanel = document.getElementById('speech-practice-panel');
    const speechText = document.getElementById('speech-transcript-text');
    const btnStopSpeak = document.getElementById('btn-stop-speak');
    let speechRecognition = null;

    if (btnPractice) {
        btnPractice.addEventListener('click', () => {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert("Speech recognition is not supported in this browser. Please use Google Chrome or Microsoft Edge.");
                return;
            }

            if (!speechRecognition) {
                speechRecognition = new SpeechRecognition();
                speechRecognition.continuous = true;
                speechRecognition.interimResults = true;
                speechRecognition.lang = 'en-US';

                speechRecognition.onresult = (event) => {
                    let transcript = '';
                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        transcript += event.results[i][0].transcript;
                    }
                    if (speechText) {
                        speechText.textContent = transcript || 'Listening...';
                    }
                };

                speechRecognition.onerror = (event) => {
                    console.error('Speech recognition error:', event.error);
                    if (speechText) speechText.textContent = 'Error: ' + event.error;
                };

                speechRecognition.onend = () => {
                    if (btnPractice.classList.contains('recording')) {
                        speechRecognition.start(); // Keep listening if active
                    }
                };
            }

            if (btnPractice.classList.contains('recording')) {
                stopSpeechPractice(false); // Stop and evaluate
            } else {
                btnPractice.classList.add('recording');
                btnPractice.innerHTML = '🛑 Stop Recording';
                btnPractice.style.borderColor = '#ef4444';
                btnPractice.style.color = '#ef4444';
                const scoreBox = document.getElementById('speech-score-box');
                if (scoreBox) scoreBox.style.display = 'none';
                if (speechPanel) speechPanel.style.display = 'flex';
                if (speechText) speechText.textContent = 'Listening... Speak your pitch now.';
                if (btnStopSpeak) btnStopSpeak.textContent = 'Cancel';
                try {
                    speechRecognition.start();
                } catch (e) {
                    console.log('Recognition already started:', e);
                }
            }
        });
    }

    const stopSpeechPractice = (dismiss = true) => {
        if (speechRecognition) {
            try {
                speechRecognition.stop();
            } catch (e) {
                console.log(e);
            }
        }
        if (btnPractice) {
            btnPractice.classList.remove('recording');
            btnPractice.innerHTML = '🎤 Practice Speaking';
            btnPractice.style.borderColor = '';
            btnPractice.style.color = '';
        }
        if (dismiss) {
            if (speechPanel) speechPanel.style.display = 'none';
        } else {
            // Evaluate matching accuracy score
            const originalText = introText.textContent || '';
            const spokenText = speechText.textContent || '';
            
            const cleanWords = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(Boolean);
            const origWords = cleanWords(originalText);
            const spokenWords = cleanWords(spokenText);
            
            let score = 0;
            if (origWords.length > 0 && spokenWords.length > 0) {
                let matchCount = 0;
                const spokenSet = new Set(spokenWords);
                origWords.forEach(w => {
                    if (spokenSet.has(w)) matchCount++;
                });
                score = Math.round((matchCount / origWords.length) * 100);
            }
            
            const scoreBox = document.getElementById('speech-score-box');
            const gradeTitle = document.getElementById('speech-grade-title');
            const scoreFeedback = document.getElementById('speech-score-feedback');
            const scoreCircle = document.getElementById('speech-score-circle');
            
            if (scoreBox) scoreBox.style.display = 'flex';
            if (scoreCircle) {
                scoreCircle.textContent = `${score}%`;
                if (score >= 80) {
                    scoreCircle.style.borderColor = '#10b981';
                    scoreCircle.style.color = '#10b981';
                    if (gradeTitle) gradeTitle.textContent = 'Excellent Clarity! 🌟';
                    if (scoreFeedback) scoreFeedback.textContent = "Your speaking matches the pitch beautifully. You're ready!";
                } else if (score >= 50) {
                    scoreCircle.style.borderColor = '#f59e0b';
                    scoreCircle.style.color = '#f59e0b';
                    if (gradeTitle) gradeTitle.textContent = 'Good Effort! 👍';
                    if (scoreFeedback) scoreFeedback.textContent = "Very clear speaking. Try to include more of the key terms.";
                } else {
                    scoreCircle.style.borderColor = '#ef4444';
                    scoreCircle.style.color = '#ef4444';
                    if (gradeTitle) gradeTitle.textContent = 'Keep Practicing! 🎤';
                    if (scoreFeedback) scoreFeedback.textContent = "Focus on speaking clearly and matching the drafted pitch text.";
                }
            }
            if (btnStopSpeak) btnStopSpeak.textContent = 'Dismiss Panel';
        }
    };

    if (btnStopSpeak) {
        btnStopSpeak.addEventListener('click', () => {
            stopSpeechPractice(true);
        });
    }

    const renderActiveIntroPitch = () => {
        if (!generatedSelfIntros) return;
        if (activeIntroTab === 'elevator') {
            introText.textContent = generatedSelfIntros.elevatorPitch || '';
        } else if (activeIntroTab === 'summary') {
            introText.textContent = generatedSelfIntros.professionalSummary || '';
        } else if (activeIntroTab === 'hook') {
            introText.textContent = generatedSelfIntros.coverLetterHook || '';
        }
    };

    selfIntroTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selfIntroTabBtns.forEach(b => {
                b.classList.remove('active');
                b.style.background = 'transparent';
                b.style.color = 'var(--gray-600)';
            });
            btn.classList.add('active');
            btn.style.background = 'var(--primary-light)';
            btn.style.color = 'var(--primary)';

            activeIntroTab = btn.getAttribute('data-intro-tab');
            renderActiveIntroPitch();
        });
    });

    if (btnCopyIntro) {
        btnCopyIntro.addEventListener('click', () => {
            navigator.clipboard.writeText(introText.textContent).then(() => {
                const originalText = btnCopyIntro.textContent;
                btnCopyIntro.textContent = 'Copied!';
                setTimeout(() => {
                    btnCopyIntro.textContent = originalText;
                }, 1500);
            });
        });
    }
});




// --- Dynamic Hiring Status Tracker Logic ---
function saveAppliedJob(jobId, title, company, status) {
    let applied = JSON.parse(localStorage.getItem('appliedJobs') || '[]');
    const existingIdx = applied.findIndex(j => j.jobId === jobId);
    if (existingIdx > -1) {
        applied[existingIdx].status = status;
    } else {
        applied.push({
            jobId: jobId,
            title: title,
            company: company,
            appliedAt: new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
            status: status
        });
    }
    localStorage.setItem('appliedJobs', JSON.stringify(applied));
    if (typeof renderHiringStatus === 'function') {
        renderHiringStatus();
    }
}

const renderTeamsCalendar = () => {
    const calendarGrid = document.getElementById('teams-calendar-grid');
    const meetingsList = document.getElementById('teams-meetings-list');
    if (!calendarGrid || !meetingsList) return;

    const emptyDaysBefore = 5; // August 2026 starts on Saturday (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6)
    const daysInMonth = 31;
    
    // Dynamically generate meetings based on applied jobs in localStorage
    const applied = JSON.parse(localStorage.getItem('appliedJobs') || '[]');
    const meetings = {};

    applied.forEach((job) => {
        let appDay = 7; // Default to today's date if parsing fails
        if (job.appliedAt) {
            // appliedAt format is e.g. "8/7/2026 04:30 AM" or "07/08/2026"
            const parts = job.appliedAt.split('/');
            if (parts.length > 1) {
                // If it's MM/DD/YYYY or DD/MM/YYYY, check both indices
                let parsedDay = parseInt(parts[1]);
                if (isNaN(parsedDay) || parsedDay < 1 || parsedDay > 31) {
                    parsedDay = parseInt(parts[0]);
                }
                if (!isNaN(parsedDay) && parsedDay >= 1 && parsedDay <= 31) {
                    appDay = parsedDay;
                }
            }
        }

        if (job.status === 'Resume Screening') {
            const meetDay = (appDay + 1) > 31 ? 31 : (appDay + 1);
            if (!meetings[meetDay]) meetings[meetDay] = [];
            meetings[meetDay].push({
                title: `ATS Resume Review: ${job.title}`,
                time: "10:00 AM - 10:30 AM",
                type: "HR Consultation",
                link: "https://teams.microsoft.com/"
            });
        } else if (job.status === 'NOVA Evaluation') {
            const meetDay = (appDay + 2) > 31 ? 31 : (appDay + 2);
            if (!meetings[meetDay]) meetings[meetDay] = [];
            meetings[meetDay].push({
                title: `NOVA Skill Test Prep: ${job.title}`,
                time: "1:00 PM - 1:45 PM",
                type: "Teams Meeting",
                link: "https://teams.microsoft.com/"
            });
        } else if (job.status === 'AI Interview') {
            const meetDay = (appDay + 3) > 31 ? 31 : (appDay + 3);
            if (!meetings[meetDay]) meetings[meetDay] = [];
            meetings[meetDay].push({
                title: `AI Interview Prep Briefing: ${job.title}`,
                time: "3:00 PM - 3:30 PM",
                type: "Teams Meeting",
                link: "https://teams.microsoft.com/"
            });
        }
    });

    let selectedDay = parseInt(localStorage.getItem('selectedCalendarDay') || '7');

    calendarGrid.innerHTML = '';
    
    // Empty prefix cells
    for (let i = 0; i < emptyDaysBefore; i++) {
        const emptyCell = document.createElement('div');
        calendarGrid.appendChild(emptyCell);
    }
    
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
        const dayCell = document.createElement('div');
        dayCell.style.cssText = 'padding: 0.4rem; border-radius: 6px; cursor: pointer; font-size: 0.85rem; font-weight: 500; transition: all 0.2s; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 32px;';
        dayCell.textContent = d;
        
        const hasMeetings = !!meetings[d];
        if (hasMeetings) {
            const marker = document.createElement('span');
            marker.style.cssText = 'width: 4px; height: 4px; border-radius: 50%; background: #4B53BC; position: absolute; bottom: 3px;';
            dayCell.appendChild(marker);
        }

        if (d === selectedDay) {
            dayCell.style.background = '#4B53BC';
            dayCell.style.color = 'var(--white)';
            if (hasMeetings) {
                dayCell.querySelector('span').style.background = 'var(--white)';
            }
        } else {
            dayCell.addEventListener('mouseenter', () => {
                dayCell.style.background = 'var(--gray-100)';
            });
            dayCell.addEventListener('mouseleave', () => {
                if (d !== selectedDay) {
                    dayCell.style.background = 'transparent';
                }
            });
        }
        
        dayCell.addEventListener('click', () => {
            localStorage.setItem('selectedCalendarDay', d);
            renderTeamsCalendar();
        });
        
        calendarGrid.appendChild(dayCell);
    }

    const dayMeetings = meetings[selectedDay] || [];
    meetingsList.innerHTML = '';
    
    if (dayMeetings.length === 0) {
        meetingsList.innerHTML = `
            <div style="text-align: center; padding: 1.5rem; color: var(--gray-400); font-size: 0.8rem; border: 1px dashed var(--gray-100); border-radius: 6px;">
                No meetings scheduled for August ${selectedDay}.
            </div>
        `;
    } else {
        dayMeetings.forEach(m => {
            const mCard = document.createElement('div');
            mCard.style.cssText = 'padding: 0.85rem; border-radius: 6px; border-left: 4px solid #4B53BC; background: #F3F4F6; display: flex; flex-direction: column; gap: 0.4rem; box-shadow: var(--shadow-sm); text-align: left;';
            mCard.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 0.5rem;">
                    <h5 style="margin: 0; font-size: 0.85rem; font-weight: 700; color: var(--dark);">${m.title}</h5>
                    <span style="font-size: 0.7rem; font-weight: 700; color: #4B53BC; background: rgba(75, 83, 188, 0.1); padding: 0.15rem 0.4rem; border-radius: 3px; white-space: nowrap;">${m.type}</span>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 0.25rem;">
                    <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: 500;">⏰ ${m.time}</span>
                    <a href="${m.link}" target="_blank" class="btn btn-sm" style="background: #4B53BC; color: var(--white); font-size: 0.7rem; padding: 0.25rem 0.6rem; border-radius: 4px; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem; border: none; cursor: pointer;">
                        Join
                    </a>
                </div>
            `;
            meetingsList.appendChild(mCard);
        });
    }
};

const getPipelinePercentage = (status) => {
    switch (status) {
        case 'Resume Screening': return 10;
        case 'NOVA Evaluation': return 40;
        case 'Rejected': return 40;
        case 'AI Interview': return 65;
        case 'HR Round': return 85;
        case 'Completed':
        case 'Hired': return 100;
        default: return 10;
    }
};

const getStepStatus = (stepIndex, status) => {
    if (status === 'Rejected') {
        if (stepIndex === 1 || stepIndex === 2) return 'completed';
        if (stepIndex === 3) return 'failed';
        return 'pending';
    }

    const statusOrder = ['Resume Screening', 'NOVA Evaluation', 'AI Interview', 'HR Round', 'Completed', 'Hired'];
    const currentStatusIndex = statusOrder.indexOf(status);
    
    let isCompleted = false;
    let isCurrent = false;
    
    if (stepIndex === 1) {
        if (currentStatusIndex > 0) isCompleted = true;
        else if (currentStatusIndex === 0) isCurrent = true;
    } else if (stepIndex === 2) {
        if (currentStatusIndex > 0) isCompleted = true;
        else if (currentStatusIndex === 0) isCurrent = true;
    } else if (stepIndex === 3) {
        if (currentStatusIndex > 1) isCompleted = true;
        else if (currentStatusIndex === 1) isCurrent = true;
    } else if (stepIndex === 4) {
        if (currentStatusIndex > 2) isCompleted = true;
        else if (currentStatusIndex === 2) isCurrent = true;
    } else if (stepIndex === 5) {
        if (currentStatusIndex > 3) isCompleted = true;
        else if (currentStatusIndex === 3) isCurrent = true;
    } else if (stepIndex === 6) {
        if (currentStatusIndex >= 4) isCompleted = true;
    }
    
    if (isCompleted) return 'completed';
    if (isCurrent) return 'current';
    return 'pending';
};

const getStepDetails = (index, label, status) => {
    const userProfile = JSON.parse(localStorage.getItem('currentUserProfile') || '{}');
    const atsScore = userProfile.overall_score || 86;
    
    const details = {
        1: {
            title: "ATS Resume Screening",
            completed: `Your resume successfully passed our ATS screening with a score of <strong>${atsScore}%</strong>. The AI verified that your technical background matches the job's core requirements.`,
            current: "Your resume is currently undergoing ATS screening. Our AI is parsing your skills, projects, and education details.",
            pending: "Resume screening pending. Please upload your resume first."
        },
        2: {
            title: "Requirements Matching",
            completed: `Mandatory and preferred skills matching analysis completed. Your profile shows compatibility with the role's stack.`,
            current: "Analyzing matching compatibility between your profile and job description.",
            pending: "Role matching will run automatically after your profile details are saved."
        },
        3: {
            title: "NOVA Technical Test",
            completed: "You have completed the NOVA AI-driven technical assessment! Your answers have been evaluated and recorded.",
            current: "You have been invited to attend the NOVA Technical Test. <br><br><strong>Next Step:</strong> Check your inbox modal or click <strong>'Start NOVA Test'</strong> on the dashboard email invitation to attend.",
            pending: "NOVA technical test pending. Complete the preceding matching analysis to unlock."
        },
        4: {
            title: "AI Voice Interview",
            completed: "AI Voice Interview complete. Speech logs transcribed, and tone/sentiment checked.",
            current: "AI Voice Interview is active. <br><br><strong>Next Step:</strong> Record your spoken responses to standard scenario questions in the Practice Portal to proceed.",
            pending: "AI voice interview pending. Attend after completing the NOVA technical test."
        },
        5: {
            title: "HR Discussion",
            completed: "HR feedback round completed and candidate evaluation recorded.",
            current: "HR Discussion active. Your recruiter will contact you shortly to schedule the final interview.",
            pending: "HR Discussion pending. Complete all technical and AI rounds first."
        },
        6: {
            title: "Final Hiring Decision",
            completed: "Hiring decision made: Selected! Welcome to the team.",
            current: "Final review of your application is underway by the hiring manager.",
            pending: "Final hiring decision pending."
        }
    };
    
    return details[index] || { title: label, completed: "", current: "", pending: "" };
};

window.showStepperInfo = (index, label, status) => {
    const details = getStepDetails(index, label, status);
    let message = '';
    let badgeClass = '';
    let badgeBg = '';
    let badgeColor = '';
    
    if (status === 'completed') {
        message = details.completed;
        badgeBg = 'rgba(16, 185, 129, 0.1)';
        badgeColor = '#10b981';
    } else if (status === 'current') {
        message = details.current;
        badgeBg = 'rgba(245, 158, 11, 0.1)';
        badgeColor = '#f59e0b';
    } else {
        message = details.pending;
        badgeBg = 'rgba(107, 114, 128, 0.1)';
        badgeColor = '#6b7280';
    }
    
    let modal = document.getElementById('stepper-info-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'stepper-info-modal';
        document.body.appendChild(modal);
    }
    
    let modalActions = `
        <button class="btn btn-primary" onclick="document.getElementById('stepper-info-modal').classList.remove('active'); document.body.style.overflow = '';">Got It</button>
    `;
    
    if (index === 3 && status === 'current') {
        modalActions = `
            <button class="btn btn-outline" onclick="document.getElementById('stepper-info-modal').classList.remove('active'); document.body.style.overflow = '';">Got It</button>
            <a href="/nova/test-setup" class="btn btn-primary" onclick="document.getElementById('stepper-info-modal').classList.remove('active'); document.body.style.overflow = '';">Start Test</a>
        `;
    }
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 500px; padding: 2.5rem; text-align: center;">
            <div style="background: #E0E7FF; width: 64px; height: 64px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem;">
                <span style="font-size: 1.5rem; font-weight: bold; color: var(--primary);">${index}</span>
            </div>
            <h3 style="margin-bottom: 0.5rem; color: var(--dark);">${details.title}</h3>
            <div style="margin-bottom: 1.5rem;">
                <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; text-transform: uppercase; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.75rem; border-radius: 20px;">
                    ${status}
                </span>
            </div>
            <p style="color: var(--dark-muted); line-height: 1.6; text-align: left; margin-bottom: 2rem; font-size: 0.95rem; background: var(--gray-50); padding: 1.25rem; border-radius: 8px; border: 1px solid var(--gray-200);">
                ${message}
            </p>
            <div style="display: flex; gap: 1rem; justify-content: center;">
                ${modalActions}
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

const renderStepNode = (index, label, status) => {
    let circleBg = 'var(--gray-200)';
    let circleColor = 'var(--gray-500)';
    let borderStyle = 'none';
    let checkIcon = index;
    let labelColor = 'var(--gray-400)';
    let labelWeight = '500';

    if (status === 'completed') {
        circleBg = 'var(--primary)';
        circleColor = 'var(--white)';
        checkIcon = '✓';
        labelColor = 'var(--primary-dark)';
        labelWeight = '700';
    } else if (status === 'current') {
        circleBg = 'var(--white)';
        circleColor = 'var(--primary)';
        borderStyle = '2px solid var(--primary)';
        labelColor = 'var(--primary)';
        labelWeight = '700';
    }

    return `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 0.35rem; position: relative; z-index: 3; width: 60px; cursor: pointer;" onclick="showStepperInfo(${index}, '${label}', '${status}')">
            <div style="width: 24px; height: 24px; border-radius: 50%; background: ${circleBg}; border: ${borderStyle}; color: ${circleColor}; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; box-shadow: var(--shadow-sm);">
                ${checkIcon}
            </div>
            <span style="font-size: 0.65rem; color: ${labelColor}; font-weight: ${labelWeight}; text-align: center; white-space: nowrap;">${label}</span>
        </div>
    `;
};

function renderHiringStatus() {
    const applied = JSON.parse(localStorage.getItem('appliedJobs') || '[]');
    const listContainer = document.querySelector('#cand-hiring-view .jobs-list');
    
    if (!listContainer) return;
    
    if (applied.length === 0) {
        listContainer.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: var(--gray-400); font-size: 0.9rem; border: 1px dashed var(--gray-200); border-radius: 8px; background: var(--gray-50);">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 32px; height: 32px; margin-bottom: 0.5rem; opacity: 0.5;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                <p style="margin: 0;">No active applications yet. Go to "Explore Jobs" and apply!</p>
            </div>
        `;
        renderTeamsCalendar();
        return;
    }

    let selectedJobId = localStorage.getItem('selectedHiringJobId') || applied[0].jobId;
    if (!applied.some(j => j.jobId === selectedJobId)) {
        selectedJobId = applied[0].jobId;
    }
    localStorage.setItem('selectedHiringJobId', selectedJobId);
    
    const selectedJob = applied.find(j => j.jobId === selectedJobId);

    listContainer.innerHTML = applied.map(job => {
        const isSelected = job.jobId === selectedJobId;
        let badgeBg = 'rgba(239, 68, 68, 0.1)';
        let badgeColor = '#ef4444';
        if (job.status === 'NOVA Evaluation') {
            badgeBg = 'rgba(37, 99, 235, 0.1)';
            badgeColor = 'var(--primary)';
        } else if (job.status === 'AI Interview') {
            badgeBg = 'rgba(139, 92, 246, 0.1)';
            badgeColor = '#8b5cf6';
        } else if (job.status === 'Completed' || job.status === 'Hired') {
            badgeBg = 'rgba(16, 185, 129, 0.1)';
            badgeColor = '#10b981';
        } else if (job.status === 'Resume Screening') {
            badgeBg = 'rgba(245, 158, 11, 0.1)';
            badgeColor = '#f59e0b';
        }

        return `
            <div class="job-item" data-id="${job.jobId}" style="padding: 1.5rem; border-radius: 12px; border: ${isSelected ? '2px solid var(--primary)' : '1px solid var(--gray-200)'}; background: var(--white); display: flex; flex-direction: column; gap: 1.25rem; box-shadow: var(--shadow-sm); cursor: pointer; transition: all 0.2s ease; text-align: left;">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <div>
                        <h4 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--dark);">${job.title}</h4>
                        <span style="font-size: 0.85rem; color: var(--gray-500); display: block; margin-top: 0.25rem;">${job.company}</span>
                    </div>
                    <div style="text-align: right;">
                        <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; padding: 0.35rem 0.75rem; border-radius: 20px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase;">${job.status}</span>
                        <span style="font-size: 0.8rem; color: var(--gray-400); display: block; margin-top: 0.35rem;">Applied ${job.appliedAt}</span>
                    </div>
                </div>
                
                <!-- Pipeline Stepper (6 Steps) for Selected Application -->
                ${isSelected ? `
                <div style="border-top: 1px solid var(--gray-100); padding-top: 1rem; margin-top: 0.25rem; width: 100%;">
                    <h5 style="margin: 0 0 1rem 0; font-size: 0.8rem; color: var(--gray-500); font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em;">Recruitment Pipeline</h5>
                    <div style="display: flex; justify-content: space-between; align-items: center; position: relative; margin-top: 0.5rem; padding: 0 0.5rem;">
                        <div style="position: absolute; left: 0; right: 0; top: 12px; height: 3px; background: var(--gray-200); z-index: 1;"></div>
                        <div style="position: absolute; left: 0; width: ${getPipelinePercentage(job.status)}%; top: 12px; height: 3px; background: var(--primary); z-index: 2; transition: width 0.5s ease;"></div>
                        
                        ${renderStepNode(1, "ATS Screen", getStepStatus(1, job.status))}
                        ${renderStepNode(2, "Matching", getStepStatus(2, job.status))}
                        ${renderStepNode(3, "NOVA Test", getStepStatus(3, job.status))}
                        ${renderStepNode(4, "AI Interview", getStepStatus(4, job.status))}
                        ${renderStepNode(5, "HR Round", getStepStatus(5, job.status))}
                        ${renderStepNode(6, "Decision", getStepStatus(6, job.status))}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');

    listContainer.querySelectorAll('.job-item').forEach(item => {
        item.addEventListener('click', () => {
            const jobId = item.getAttribute('data-id');
            localStorage.setItem('selectedHiringJobId', jobId);
            renderHiringStatus();
        });
    });

    renderTeamsCalendar();
}

// Initial render
document.addEventListener('DOMContentLoaded', () => {
    renderHiringStatus();
});
