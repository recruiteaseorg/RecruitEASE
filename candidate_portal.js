// candidate_portal.js - Unified JavaScript logic for all Candidate Portal Pages in RecruitEase

document.addEventListener('DOMContentLoaded', () => {
    // 1. Session & Profile Management
    let currentUserProfile = null;
    try {
        const saved = localStorage.getItem('currentUserProfile');
        if (saved) {
            currentUserProfile = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to parse candidate profile from localStorage:', e);
    }

    // The auth_guard.js ensures currentUserProfile is present.
    if (!currentUserProfile) {
        console.warn("User profile not found. Auth guard should have redirected.");
        return; // Prevent crash if auth guard is missing
    }

    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';

    // 2. Render Dedicated Candidate Sidebar
    const navSidebar = document.querySelector('aside nav');
    if (navSidebar) {
        const activeClass = "bg-primary-container text-on-primary-container font-medium";
        const inactiveClass = "text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface";
        
        const candidateNavItems = [
            { path: 'dashboard.html', icon: 'grid_view', label: 'Dashboard' },
            { path: 'profile.html', icon: 'person', label: 'My Profile' },
            { path: 'explore_jobs.html', icon: 'work', label: 'Explore Jobs' },
            { path: 'applications.html', icon: 'assignment', label: 'Applications & Status' },
            { path: 'self_development.html', icon: 'psychology', label: 'Self Development' },
            { path: 'ai_interview.html', icon: 'mic', label: 'AI Mock Interview' },
            { path: 'behavioral_assessment.html', icon: 'quiz', label: 'Behavioral Test' },
            { path: 'proctored_assessment.html', icon: 'verified_user', label: 'NOVA Assessment' }
        ];

        navSidebar.innerHTML = `
            <section>
                <p class="px-4 mb-2 text-label-md text-on-surface-variant uppercase tracking-wider">CANDIDATE PORTAL</p>
                <div class="space-y-1">
                    ${candidateNavItems.map(item => {
                        const isActive = currentPath === item.path || (currentPath === '' && item.path === 'dashboard.html');
                        return `
                            <a href="${item.path}" ${item.id ? `id="${item.id}"` : ''} class="flex items-center px-4 py-2.5 rounded-lg transition-all ${isActive ? activeClass : inactiveClass}">
                                <span class="material-symbols-outlined mr-3 text-[20px]">${item.icon}</span>
                                ${item.label}
                            </a>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }

    // 3. Ensure Header Profile Container is interactive with dropdown
    const headerProfileContainer = document.querySelector('header .border-l');
    if (headerProfileContainer && !headerProfileContainer.querySelector('.user-avatar-target')) {
        headerProfileContainer.classList.add('relative', 'cursor-pointer', 'group', 'flex', 'items-center', 'gap-3'); // Group for hover
        headerProfileContainer.innerHTML = `
            <div class="text-right">
                <p class="text-label-md text-on-surface user-name-target">Candidate Name</p>
                <p class="text-label-sm text-on-surface-variant user-role-target">Candidate Role</p>
            </div>
            <div class="user-avatar-target w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center font-bold text-on-surface relative border border-outline-variant shadow-sm">
            </div>
            
            <!-- Hover Dropdown Menu Wrapper (invisible bridge) -->
            <div class="hidden absolute right-0 top-full pt-3 w-56 group-hover:block z-50">
                <div class="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant py-2 transition-all opacity-0 group-hover:opacity-100 animate-[fade-in-up_0.2s_ease-out]">
                    <button id="btn-edit-profile-hover" class="w-full text-left px-4 py-2 hover:bg-surface-container-low text-body-sm font-medium flex items-center gap-2 text-on-surface transition-colors">
                        <span class="material-symbols-outlined text-[18px]">edit</span> Edit Details & Resume
                    </button>
                    <div class="h-px w-full bg-outline-variant/30 my-1"></div>
                    <button class="w-full text-left px-4 py-2 hover:bg-error-container text-error text-body-sm font-medium flex items-center gap-2 btn-logout-trigger transition-colors">
                        <span class="material-symbols-outlined text-[18px]">logout</span> Logout
                    </button>
                </div>
            </div>
        `;
        // Event delegation handles the click events for these buttons globally.
        // Also allow clicking the header container directly to open the profile
        headerProfileContainer.addEventListener('click', (e) => {
            // Do not trigger if they are clicking a button inside the dropdown (like Logout)
            if (e.target.closest('button')) return;
            window.location.href = 'profile.html';
        });
    }
    // 3.5 Global Notifications Dropdown
    const notifBtnIcon = Array.from(document.querySelectorAll('header span.material-symbols-outlined')).find(span => span.textContent.trim() === 'notifications');
    if (notifBtnIcon) {
        const notifBtn = notifBtnIcon.closest('button');
        if (notifBtn) {
            notifBtn.id = 'global-notif-btn';
            
            // The notification dropdown container
            const notifDropdown = document.createElement('div');
            notifDropdown.id = 'global-notif-dropdown';
            notifDropdown.className = 'absolute right-0 top-[110%] w-80 bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant/40 overflow-hidden z-[100] transition-all transform origin-top-right scale-95 opacity-0 pointer-events-none';
            notifDropdown.innerHTML = `
                <div class="px-4 py-3 border-b border-outline-variant/40 bg-surface-container/30 flex justify-between items-center">
                    <h3 class="font-headline-sm text-sm text-primary">Notifications</h3>
                    <button class="text-xs text-secondary hover:text-secondary-fixed-dim font-medium transition-colors">Mark all as read</button>
                </div>
                <div class="max-h-[350px] overflow-y-auto">
                    <!-- Notification Item 1 -->
                    <div class="p-4 border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer flex gap-3 group">
                        <div class="w-2 h-2 rounded-full bg-error mt-2 flex-shrink-0"></div>
                        <div>
                            <p class="text-body-sm text-on-surface font-medium group-hover:text-primary transition-colors">Application Status Updated</p>
                            <p class="text-xs text-on-surface-variant mt-0.5">Your application for Senior AI Engineer was moved to ATS Screening.</p>
                            <p class="text-[10px] text-outline mt-1 font-semibold">2 hours ago</p>
                        </div>
                    </div>
                    <!-- Notification Item 2 -->
                    <div class="p-4 border-b border-outline-variant/20 hover:bg-surface-container-low transition-colors cursor-pointer flex gap-3 group">
                        <div class="w-2 h-2 rounded-full bg-error mt-2 flex-shrink-0"></div>
                        <div>
                            <p class="text-body-sm text-on-surface font-medium group-hover:text-primary transition-colors">New Assessment Available</p>
                            <p class="text-xs text-on-surface-variant mt-0.5">Please complete the Behavioral Test by Friday.</p>
                            <p class="text-[10px] text-outline mt-1 font-semibold">Yesterday</p>
                        </div>
                    </div>
                    <!-- Notification Item 3 -->
                    <div class="p-4 hover:bg-surface-container-low transition-colors cursor-pointer flex gap-3 group">
                        <div class="w-2 h-2 rounded-full bg-transparent mt-2 flex-shrink-0"></div>
                        <div>
                            <p class="text-body-sm text-on-surface font-medium group-hover:text-primary transition-colors">Profile Reminder</p>
                            <p class="text-xs text-on-surface-variant mt-0.5">Update your profile location to boost visibility.</p>
                            <p class="text-[10px] text-outline mt-1 font-semibold">3 days ago</p>
                        </div>
                    </div>
                </div>
                <div class="px-4 py-2 border-t border-outline-variant/40 bg-surface-container/10 text-center">
                    <a href="notifications.html" class="inline-block w-full text-xs text-on-surface-variant hover:text-primary font-medium transition-colors">View All Notifications</a>
                </div>
            `;
            
            // Ensure button's parent is relative to anchor the dropdown
            notifBtn.parentElement.style.position = 'relative';
            notifBtn.parentElement.appendChild(notifDropdown);

            // Toggle logic
            let isDropdownOpen = false;
            notifBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                isDropdownOpen = !isDropdownOpen;
                if (isDropdownOpen) {
                    notifDropdown.classList.remove('scale-95', 'opacity-0', 'pointer-events-none');
                    notifDropdown.classList.add('scale-100', 'opacity-100', 'pointer-events-auto');
                    // Clear the red dot on the button
                    const badge = notifBtn.querySelector('.bg-error');
                    if (badge) badge.style.display = 'none';
                } else {
                    notifDropdown.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
                    notifDropdown.classList.remove('scale-100', 'opacity-100', 'pointer-events-auto');
                }
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (isDropdownOpen && !notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
                    isDropdownOpen = false;
                    notifDropdown.classList.add('scale-95', 'opacity-0', 'pointer-events-none');
                    notifDropdown.classList.remove('scale-100', 'opacity-100', 'pointer-events-auto');
                }
            });
        }
    }


    // 4. Update Header & User Avatar
    const updateCandidateHeader = () => {
        // Name & Profile Picture elements
        const nameHeader = document.getElementById('cand-name-header');
        if (nameHeader) nameHeader.textContent = currentUserProfile.fullName.split(' ')[0];

        const userAvatarEls = document.querySelectorAll('.user-avatar-target, #db-user-avatar');
        userAvatarEls.forEach(el => {
            if (currentUserProfile.profilePic) {
                el.innerHTML = `<img src="${currentUserProfile.profilePic}" class="w-full h-full object-cover rounded-full">`;
            } else {
                const initials = currentUserProfile.fullName.substring(0, 2).toUpperCase();
                el.textContent = initials;
            }
        });

        const userNameEls = document.querySelectorAll('#db-username, .user-name-target');
        userNameEls.forEach(el => el.textContent = currentUserProfile.fullName);

        const userRoleEls = document.querySelectorAll('#db-user-role, .user-role-target');
        userRoleEls.forEach(el => el.textContent = currentUserProfile.jobTitle || 'Candidate');

        // Dynamic Candidacy Profile Card Text
        const safeSetText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        };
        safeSetText('cand-name', currentUserProfile.fullName);
        safeSetText('cand-email', currentUserProfile.email);
        safeSetText('cand-phone', currentUserProfile.phone || 'N/A');
        safeSetText('cand-title', currentUserProfile.jobTitle);
        safeSetText('cand-exp', currentUserProfile.experienceLevel);
        safeSetText('cand-skills', currentUserProfile.skills ? (Array.isArray(currentUserProfile.skills) ? currentUserProfile.skills.join(', ') : currentUserProfile.skills) : 'N/A');
        safeSetText('cand-resume-file', currentUserProfile.resumeFile || 'resume.md');

        if (currentUserProfile.interviewDetails) {
            safeSetText('cand-int-date', new Date(currentUserProfile.interviewDetails.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
            safeSetText('cand-int-time', currentUserProfile.interviewDetails.time);
            safeSetText('cand-int-location', currentUserProfile.interviewDetails.location);
            safeSetText('cand-int-docs', currentUserProfile.interviewDetails.requiredDocs || 'None');
            
            const eventBlock = document.getElementById('candidate-interview-event');
            if (eventBlock) eventBlock.classList.remove('hidden');
        }
    };
    updateCandidateHeader();

    // 4. Global Event Delegation for Header Actions
    document.body.addEventListener('click', (e) => {
        // Edit Profile Handler
        if (e.target.closest('#btn-edit-profile-hover')) {
            e.preventDefault();
            window.location.href = 'profile.html';
        }
        
        // Logout Handler
        if (e.target.closest('.btn-logout-trigger') || e.target.closest('#btn-logout')) {
            e.preventDefault();
            localStorage.removeItem('currentUserProfile');
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('sb-ldcfkvvxtpyttvvgkifp-auth-token');
            window.location.href = '/index.html';
        }
    });

    // 5. Backend: Markdown Resume Viewer Modal Handler
    const btnViewResume = document.getElementById('btn-view-my-resume');
    if (btnViewResume) {
        btnViewResume.addEventListener('click', async (e) => {
            e.preventDefault();
            const mdFilename = currentUserProfile.markdownFile || 'demo_resume.md';
            openResumeModal(mdFilename, currentUserProfile.fullName);
        });
    }

    const openResumeModal = async (filename, name) => {
        let modal = document.getElementById('md-view-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'md-view-modal';
            modal.className = 'fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl relative">
                    <div class="flex justify-between items-center pb-4 border-b border-gray-200">
                        <h3 class="text-xl font-bold text-gray-900" id="md-view-title">${name}'s Parsed Resume</h3>
                        <button class="text-gray-500 hover:text-gray-800 text-2xl font-bold" id="md-modal-close">&times;</button>
                    </div>
                    <div class="py-4 overflow-y-auto flex-1 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4" id="md-content-body">Loading markdown resume...</div>
                </div>
            `;
            document.body.appendChild(modal);
            document.getElementById('md-modal-close').addEventListener('click', () => modal.remove());
            modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
        } else {
            modal.classList.remove('hidden');
        }

        const bodyEl = document.getElementById('md-content-body');
        try {
            const res = await fetch(`/api/candidates/${currentUserProfile.email}/resume`);
            if (res.ok) {
                bodyEl.textContent = await res.text();
            } else {
                bodyEl.textContent = `# Resume: ${name}\n\nCandidate profile active. Direct text file sample available on disk.`;
            }
        } catch (e) {
            bodyEl.textContent = `# Resume: ${name}\n\nUnable to fetch parsed markdown file from server.`;
        }
    };

    // 6. Backend: AI Self-Intro Generator
    const btnGenerateIntro = document.getElementById('btn-generate-self-intro');
    if (btnGenerateIntro) {
        btnGenerateIntro.addEventListener('click', async () => {
            const introText = document.getElementById('self-intro-text');
            if (introText) introText.textContent = "AI Career Coach analyzing your resume to generate pitch...";

            try {
                const res = await fetch('/api/generate-self-intro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: currentUserProfile.email })
                });

                if (res.ok) {
                    const data = await res.json();
                    window.generatedSelfIntroData = data;
                    if (introText) {
                        introText.textContent = data.elevatorPitch || data.professionalSummary || "Generated professional pitch ready!";
                    }
                    const btnSpeak = document.getElementById('btn-practice-speak');
                    if (btnSpeak) btnSpeak.style.display = 'inline-flex';
                    const btnCopy = document.getElementById('btn-copy-self-intro');
                    if (btnCopy) btnCopy.style.display = 'inline-flex';
                }
            } catch (err) {
                console.error("AI self-intro generation failed:", err);
                if (introText) {
                    introText.textContent = `"I am a driven software developer passionate about building scalable web applications. In my previous role, I optimized backend API response speeds by 40% and led team agile standups."`;
                }
            }
        });
    }

    // 7. Backend: Fetch Supabase Jobs & Gemini Recommendations
    const loadJobsList = async () => {
        const container = document.getElementById('jobs-list-container');
        if (!container) return;

        container.innerHTML = '<div class="p-8 text-center text-gray-500">Fetching live job opportunities from database...</div>';
        try {
            const res = await fetch('/api/jobs?limit=20');
            if (res.ok) {
                const data = await res.json();
                const jobs = data.jobs || [];

                if (jobs.length === 0) {
                    container.innerHTML = '<div class="p-8 text-center text-gray-500">No active job listings found.</div>';
                    return;
                }

                container.innerHTML = jobs.map(job => `
                    <article class="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-200 flex justify-between items-start gap-4">
                        <div class="space-y-2 flex-1">
                            <div class="flex items-center gap-3">
                                <h3 class="font-bold text-lg text-gray-900">${job.title || 'Software Position'}</h3>
                                <span class="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">Active</span>
                            </div>
                            <p class="text-sm text-gray-600 font-medium">${job.company || 'Tech Retail Corp'} • ${job.location || 'Remote'}</p>
                            <p class="text-sm text-gray-700 line-clamp-2 mt-2">${job.description || 'Full-time position working with web and cloud infrastructure.'}</p>
                        </div>
                        <div class="flex flex-col items-end gap-3 shrink-0">
                            <span class="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">✨ AI Matched</span>
                            <button class="bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary/90 transition-colors">Apply Now</button>
                        </div>
                    </article>
                `).join('');
            }
        } catch (e) {
            console.error("Failed to load jobs list:", e);
            if (container) container.innerHTML = '<div class="p-8 text-center text-red-500">Failed to connect to jobs backend.</div>';
        }
    };
    loadJobsList();

    // 8. Backend: Gemini AI Dashboard details (Daily tasks checklist & tips)
    const loadGeminiDashboardData = async () => {
        try {
            const res = await fetch('/api/generate-dashboard-ai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentUserProfile.email })
            });

            if (res.ok) {
                const data = await res.json();
                const tipBox = document.getElementById('prep-tip-box');
                if (tipBox && data.dailyTip) {
                    tipBox.textContent = data.dailyTip;
                }

                const todoList = document.getElementById('prep-todo-list');
                if (todoList && data.dailyTasks && data.dailyTasks.length > 0) {
                    todoList.innerHTML = data.dailyTasks.map(task => `
                        <li class="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700">
                            <span class="text-emerald-600 font-bold">✓</span>
                            <span>${task}</span>
                        </li>
                    `).join('');
                }
            }
        } catch (e) {
            console.error("Failed to load AI dashboard data:", e);
        }
    };
    loadGeminiDashboardData();
});

// Add notification handler to candidate_portal.js
document.addEventListener('DOMContentLoaded', () => {
    // 9. Notifications Logic
    const btnNotif = document.getElementById('btn-notifications');
    const dropdown = document.getElementById('notification-dropdown');
    const badge = document.getElementById('notification-badge');
    const list = document.getElementById('notification-list');
    const markReadBtn = document.getElementById('mark-read-btn');

    if (btnNotif && dropdown) {
        let notifications = [];
        try {
            notifications = JSON.parse(localStorage.getItem('userNotifications') || '[]');
        } catch(e) {}
        
        // If empty, add a welcome notification for candidates
        if (notifications.length === 0) {
            notifications = [
                { id: 1, text: "Welcome to RecruitEase! Complete your profile.", read: false, time: new Date().toISOString() }
            ];
            localStorage.setItem('userNotifications', JSON.stringify(notifications));
        }

        const unreadCount = notifications.filter(n => !n.read).length;
        if (unreadCount > 0 && badge) {
            badge.classList.remove('hidden');
        }

        const renderNotifs = () => {
            if (notifications.length === 0) {
                list.innerHTML = '<li class="p-4 text-center text-gray-500">No new notifications</li>';
                return;
            }
            list.innerHTML = notifications.map(n => `
                <li class="p-3 border-b border-outline-variant hover:bg-surface-container-low transition-colors ${!n.read ? 'bg-surface' : ''}">
                    <div class="flex items-start gap-2">
                        ${!n.read ? '<div class="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0"></div>' : '<div class="w-2 h-2 mt-1.5 rounded-full shrink-0"></div>'}
                        <div>
                            <p class="text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}">${n.text}</p>
                            <p class="text-xs text-gray-400 mt-1">${new Date(n.time).toLocaleDateString()}</p>
                        </div>
                    </div>
                </li>
            `).join('');
        };
        renderNotifs();

        btnNotif.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('hidden');
            setTimeout(() => dropdown.classList.toggle('opacity-0'), 10);
        });

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target) && !btnNotif.contains(e.target)) {
                dropdown.classList.add('opacity-0');
                setTimeout(() => dropdown.classList.add('hidden'), 200);
            }
        });

        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                notifications.forEach(n => n.read = true);
                localStorage.setItem('userNotifications', JSON.stringify(notifications));
                if (badge) badge.classList.add('hidden');
                renderNotifs();
            });
        }
    }
});
