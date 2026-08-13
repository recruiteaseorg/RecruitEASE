// hr_portal.js - Unified JavaScript logic for all HR & Recruiter Pages in RecruitEase

document.addEventListener('DOMContentLoaded', () => {
    // Populate HR Profile Header globally on all HR pages
    const hrUserStr = localStorage.getItem('currentUserProfile');
    if (hrUserStr) {
        try {
            const hrUser = JSON.parse(hrUserStr);
            const hrNameEl = document.querySelector('header .text-label-md.text-on-surface');
            const hrRoleEl = document.querySelector('header .text-label-sm.text-on-surface-variant');
            if (hrNameEl) hrNameEl.textContent = hrUser.fullName || hrUser.email;
            if (hrRoleEl) hrRoleEl.textContent = hrUser.role || 'HR';
            
            // Also update "Welcome back, [Name]" in recruiter_workspace.html if it exists
            const welcomeText = document.querySelector('p.font-body-lg.text-on-surface-variant.mt-2');
            if (welcomeText && welcomeText.textContent.includes('Welcome back')) {
                const firstName = (hrUser.fullName || hrUser.email || 'HR').split(' ')[0];
                welcomeText.textContent = `Welcome back, ${firstName}. Here is the pulse of your recruitment pipeline.`;
            }
        } catch(e) {
            console.error('Error parsing HR profile', e);
        }
    }

    const currentPath = window.location.pathname.split('/').pop() || 'recruiter_workspace.html';
    
    // Check if we are inside a drawer iframe
    const urlParams = new URLSearchParams(window.location.search);
    const isDrawer = urlParams.get('drawer') === 'true';

    if (isDrawer) {
        // Strip out the layout since we are inside a 850px side drawer
        const sidebar = document.querySelector('aside');
        if (sidebar) sidebar.style.display = 'none';

        const header = document.querySelector('header');
        if (header) header.style.display = 'none';

        const mainContainer = document.querySelector('.pl-\\[240px\\]');
        if (mainContainer) mainContainer.classList.remove('pl-[240px]');

        const mainTag = document.querySelector('main');
        if (mainTag) mainTag.classList.remove('pt-[64px]');

        const pagePadding = document.querySelector('.p-margin_page');
        if (pagePadding) {
            pagePadding.classList.remove('p-margin_page');
            pagePadding.classList.add('p-6'); // tighter padding for drawer
        }
    }

    // 1. Render Dedicated Recruiter Sidebar Navigation
    const navSidebar = document.querySelector('aside nav');
    if (navSidebar) {
        const activeClass = "bg-primary-container text-on-primary-container font-medium";
        const inactiveClass = "text-body-sm text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface";

        const hrNavItems = [
            { path: 'recruiter_workspace.html', icon: 'grid_view', label: 'Workspace' },
            { path: 'hr_guide.html', icon: 'menu_book', label: 'Platform Guide' },
            { path: 'job_management.html', icon: 'work', label: 'Job Management' }
        ];

        navSidebar.innerHTML = `
            <section>
                <p class="px-4 mb-2 text-label-md text-on-surface-variant uppercase tracking-wider">RECRUITER PORTAL</p>
                <div class="space-y-1">
                    ${hrNavItems.map(item => {
                        const isActive = currentPath === item.path;
                        return `
                            <a href="${item.path}" class="flex items-center px-4 py-2.5 rounded-lg transition-all ${isActive ? activeClass : inactiveClass}">
                                <span class="material-symbols-outlined mr-3 text-[20px]">${item.icon}</span>
                                ${item.label}
                            </a>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }

    // 2. Set HR Header Profile & Dropdown
    let currentUserProfile = null;
    try {
        const saved = localStorage.getItem('currentUserProfile');
        if (saved) currentUserProfile = JSON.parse(saved);
    } catch (e) {}

    const headerProfileContainer = document.querySelector('header .border-l');
    if (headerProfileContainer) {
        headerProfileContainer.classList.add('relative', 'cursor-pointer', 'group'); // Group for hover
        
        const fullName = currentUserProfile ? currentUserProfile.fullName : 'HR Recruiter';
        const role = currentUserProfile ? (currentUserProfile.jobTitle || 'Recruitment Manager') : 'Recruitment Manager';
        const initials = fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        headerProfileContainer.innerHTML = `
            <div class="text-right">
                <p class="text-label-md text-on-surface user-name-target">${fullName}</p>
                <p class="text-label-sm text-on-surface-variant user-role-target">${role}</p>
            </div>
            <div class="user-avatar-target w-10 h-10 rounded-full bg-primary flex items-center justify-center font-bold text-white relative border border-outline-variant shadow-sm text-sm">
                ${initials}
            </div>
            
            <!-- Hover Dropdown Menu Wrapper -->
            <div class="hidden absolute right-0 top-full pt-3 w-48 group-hover:block z-50">
                <div class="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant py-2 transition-all opacity-0 group-hover:opacity-100 animate-[fade-in-up_0.2s_ease-out]">
                    <button class="w-full text-left px-4 py-2 hover:bg-error-container text-error text-body-sm font-medium flex items-center gap-2 btn-logout-trigger transition-colors">
                        <span class="material-symbols-outlined text-[18px]">logout</span> Logout
                    </button>
                </div>
            </div>
        `;
    }

    // Logout Handler (must re-bind since we injected new HTML)
    document.body.addEventListener('click', (e) => {
        if (e.target.closest('.btn-logout-trigger') || e.target.closest('#btn-logout')) {
            e.preventDefault();
            localStorage.removeItem('currentUserProfile');
            localStorage.removeItem('currentUserRole');
            localStorage.removeItem('sb-ldcfkvvxtpyttvvgkifp-auth-token');
            window.location.href = '/index.html';
        }
    });

    // 3. Backend: Fetch Candidates from /api/candidates & Populate Table
    const loadHRCandidates = async () => {
        const tableBody = document.getElementById('applicants-table-body');
        const countMetric = document.getElementById('hr-count-applicants');

        try {
            const res = await fetch('/api/candidates');
            if (res.ok) {
                const candidatesData = await res.json();
                
                let allCandidates = candidatesData.map(c => ({
                    ...c,
                    resumeScore: typeof c.resumeScore === 'number' ? c.resumeScore : 0,
                    location: c.location || 'Remote'
                }));

                if (countMetric) {
                    countMetric.textContent = allCandidates.length;
                }

                const interviewRateMetric = document.getElementById('hr-interview-rate');
                if (interviewRateMetric) {
                    const interviewedCount = allCandidates.filter(c => ['Interviewing', 'Offered', 'Rejected'].includes(c.recruitmentStage)).length;
                    const rate = allCandidates.length ? Math.round((interviewedCount / allCandidates.length) * 100) : 0;
                    interviewRateMetric.textContent = rate + '%';
                    const bar = interviewRateMetric.parentElement.parentElement.querySelector('.bg-secondary');
                    if (bar) bar.style.width = rate + '%';
                }

                const offerAcceptanceMetric = document.getElementById('hr-offer-acceptance');
                if (offerAcceptanceMetric) {
                    const offeredCount = allCandidates.filter(c => c.recruitmentStage === 'Offered').length;
                    const acceptanceRate = offeredCount > 0 ? 100 : 0; 
                    offerAcceptanceMetric.textContent = acceptanceRate + '%';
                }

                if (!tableBody) return;

                // Populate job filter dropdown
                const jobFilter = document.getElementById('filter-job');
                if (jobFilter) {
                    const uniqueJobs = [...new Set(allCandidates.map(c => c.jobTitle).filter(Boolean))];
                    const currentVal = jobFilter.value;
                    jobFilter.innerHTML = '<option value="">All Jobs</option>' + uniqueJobs.map(j => `<option value="${j}">${j}</option>`).join('');
                    jobFilter.value = currentVal; // Restore value if re-rendering
                }

                const renderCandidates = () => {
                    let filtered = [...allCandidates];
                    
                    // Filter by Search (Name or Location)
                    const searchInput = document.getElementById('filter-search');
                    if (searchInput && searchInput.value) {
                        const q = searchInput.value.toLowerCase();
                        filtered = filtered.filter(c => 
                            (c.fullName || '').toLowerCase().includes(q) || 
                            (c.location || '').toLowerCase().includes(q)
                        );
                    }

                    // Filter by Job
                    if (jobFilter && jobFilter.value) {
                        filtered = filtered.filter(c => c.jobTitle === jobFilter.value);
                    }

                    // Sort
                    const sortSelect = document.getElementById('sort-candidates');
                    if (sortSelect && sortSelect.value) {
                        const sortVal = sortSelect.value;
                        if (sortVal === 'date-desc') filtered.sort((a,b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
                        if (sortVal === 'date-asc') filtered.sort((a,b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
                        if (sortVal === 'score-desc') filtered.sort((a,b) => (b.resumeScore || 0) - (a.resumeScore || 0));
                        if (sortVal === 'score-asc') filtered.sort((a,b) => (a.resumeScore || 0) - (b.resumeScore || 0));
                    }

                    if (filtered.length === 0) {
                        tableBody.innerHTML = `
                            <tr>
                                <td colspan="7" class="p-8 text-center text-gray-500">No candidates match your criteria.</td>
                            </tr>
                        `;
                        return;
                    }

                    tableBody.innerHTML = filtered.map(cand => {
                        const dateStr = cand.createdAt ? new Date(cand.createdAt).toLocaleDateString() : 'Recent';
                        const stage = cand.recruitmentStage || 'Applied';
                        
                        const stages = ['Applied', 'Under Review', 'Interviewing', 'Considered', 'Offered', 'Rejected'];
                        let stageOptions = stages.map(s => `<option value="${s}" ${s === stage ? 'selected' : ''}>${s}</option>`).join('');
                        if (stage === 'Considered - Selected') stageOptions += `<option value="Considered - Selected" selected>Considered - Selected</option>`;
                        if (stage === 'Considered - Rejected') stageOptions += `<option value="Considered - Rejected" selected>Considered - Rejected</option>`;

                        let scoreColor = 'text-green-600 bg-green-50 border-green-200';
                        if (cand.resumeScore < 70) scoreColor = 'text-yellow-600 bg-yellow-50 border-yellow-200';
                        if (cand.resumeScore < 50) scoreColor = 'text-red-600 bg-red-50 border-red-200';

                        return `
                            <tr class="border-b border-gray-100 hover:bg-gray-50/50 transition-colors">
                                <td class="p-4 font-bold text-gray-900">
                                    <a href="#" data-email="${cand.email}" class="cand-name-link hover:text-primary transition-colors underline decoration-transparent hover:decoration-primary underline-offset-4">
                                        ${cand.fullName || 'Anonymous Candidate'}
                                    </a>
                                </td>
                                <td class="p-4 text-gray-700">${cand.jobTitle || 'N/A'}</td>
                                <td class="p-4 text-gray-700">${cand.location || 'Remote'}</td>
                                <td class="p-4">
                                    <span class="px-2 py-1 rounded border text-xs font-bold ${scoreColor}">${cand.resumeScore || 0}%</span>
                                </td>
                                <td class="p-4 flex items-center gap-1">
                                    <select class="stage-select border border-gray-300 rounded px-2 py-1 text-sm bg-white" data-email="${cand.email}">
                                        ${stageOptions}
                                    </select>
                                    <div class="considered-actions ${stage === 'Considered' ? 'flex' : 'hidden'} gap-1 items-center ml-1" data-email="${cand.email}">
                                        <button class="btn-cons-yes text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded font-bold transition-colors border border-green-200" title="Considered & Selected">Yes</button>
                                        <button class="btn-cons-no text-xs bg-red-50 text-red-700 hover:bg-red-100 px-2 py-1 rounded font-bold transition-colors border border-red-200" title="Considered & Rejected">No</button>
                                    </div>
                                </td>
                                <td class="p-4 text-gray-500 text-xs">${dateStr}</td>
                                <td class="p-4 text-right">
                                    <button class="btn-view-md border border-primary text-primary px-3 py-1 rounded text-xs font-semibold hover:bg-primary/5 transition-colors" data-file="${cand.markdownFile || ''}" data-name="${cand.fullName || 'Candidate'}">
                                        View Resume
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('');

                    // Bind resume view triggers
                    const viewBtns = tableBody.querySelectorAll('.btn-view-md');
                    viewBtns.forEach(btn => {
                        btn.addEventListener('click', (e) => {
                            const file = e.currentTarget.getAttribute('data-file');
                            const name = e.currentTarget.getAttribute('data-name');
                            openMarkdownPreview(file, name);
                        });
                    });

                    // Bind candidate name click triggers for side drawer
                    const nameLinks = tableBody.querySelectorAll('.cand-name-link');
                    nameLinks.forEach(link => {
                        link.addEventListener('click', (e) => {
                            e.preventDefault();
                            const email = e.currentTarget.getAttribute('data-email');
                            openCandidateDrawer(email);
                        });
                    });

                    // Bind stage update triggers
                    const stageSelects = tableBody.querySelectorAll('.stage-select');
                    stageSelects.forEach(select => {
                        select.addEventListener('change', async (e) => {
                            const targetElement = e.currentTarget;
                            const email = targetElement.getAttribute('data-email');
                            const newStage = targetElement.value;
                            const cand = allCandidates.find(c => c.email === email);
                            // Get HR Name
                            let hrName = 'Recruitment Manager';
                            try {
                                const hrUserStr = localStorage.getItem('currentUserProfile');
                                if (hrUserStr) {
                                    const hrUser = JSON.parse(hrUserStr);
                                    hrName = hrUser.fullName || hrUser.email || hrName;
                                }
                            } catch (e) {}

                            const updateStageAPI = async (payload) => {
                                try {
                                    const res = await fetch('/api/update-stage', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(payload)
                                    });
                                    if (res.ok) {
                                        if(cand) cand.recruitmentStage = newStage;
                                        console.log('Stage updated');
                                        const actionsDiv = targetElement.parentElement.querySelector('.considered-actions');
                                        if (actionsDiv) {
                                            if (newStage === 'Considered') {
                                                actionsDiv.classList.remove('hidden');
                                                actionsDiv.classList.add('flex');
                                            } else {
                                                actionsDiv.classList.remove('flex');
                                                actionsDiv.classList.add('hidden');
                                            }
                                        }
                                    } else {
                                        alert('Failed to update stage');
                                        targetElement.value = cand ? cand.recruitmentStage : 'Applied';
                                    }
                                } catch (err) {
                                    console.error(err);
                                    alert('Network error while updating stage');
                                    targetElement.value = cand ? cand.recruitmentStage : 'Applied';
                                }
                            };

                            if (newStage === 'Interviewing') {
                                // Show Modal
                                const modal = document.getElementById('interview-modal');
                                const form = document.getElementById('interview-form');
                                document.getElementById('int-modal-name').textContent = cand ? cand.fullName : 'Candidate';
                                document.getElementById('int-modal-email').value = email;
                                
                                modal.classList.remove('hidden');

                                const cancelBtn = document.getElementById('int-cancel-btn');
                                const handleCancel = () => {
                                    modal.classList.add('hidden');
                                    targetElement.value = cand ? cand.recruitmentStage : 'Applied';
                                    cleanup();
                                };

                                const handleSubmit = (ev) => {
                                    ev.preventDefault();
                                    const details = {
                                        date: document.getElementById('int-date').value,
                                        time: document.getElementById('int-time').value,
                                        location: document.getElementById('int-location').value,
                                        requiredDocs: document.getElementById('int-docs').value
                                    };
                                    
                                    if(cand) cand.interviewDetails = details;
                                    
                                    updateStageAPI({ email, newStage, interviewDetails: details, hrName });
                                    
                                    modal.classList.add('hidden');
                                    cleanup();
                                };

                                const cleanup = () => {
                                    cancelBtn.removeEventListener('click', handleCancel);
                                    form.removeEventListener('submit', handleSubmit);
                                    form.reset();
                                };

                                cancelBtn.addEventListener('click', handleCancel);
                                form.addEventListener('submit', handleSubmit);
                            } else {
                                let extraDetails = '';
                                if (newStage === 'Rejected') {
                                    extraDetails = prompt('Optional: Enter any specific feedback for the candidate (or leave blank):');
                                    if (extraDetails === null) { targetElement.value = cand ? cand.recruitmentStage : 'Applied'; return; }
                                } else if (newStage === 'Offered') {
                                    extraDetails = prompt('Optional: Enter any specific next steps or offer details (or leave blank):');
                                    if (extraDetails === null) { targetElement.value = cand ? cand.recruitmentStage : 'Applied'; return; }
                                }
                                
                                updateStageAPI({ email, newStage, hrName, extraDetails });
                            }
                        });
                    });

                    // Bind Considered Yes/No triggers
                    const consYesBtns = tableBody.querySelectorAll('.btn-cons-yes');
                    consYesBtns.forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const container = e.currentTarget.closest('.considered-actions');
                            const email = container.getAttribute('data-email');
                            const extraDetails = prompt('Optional: Enter any specific next steps for this candidate (or leave blank):');
                            if (extraDetails === null) return;
                            
                            let hrName = 'Recruitment Manager';
                            try {
                                const hrUserStr = localStorage.getItem('currentUserProfile');
                                if (hrUserStr) hrName = JSON.parse(hrUserStr).fullName || JSON.parse(hrUserStr).email || hrName;
                            } catch (err) {}

                            try {
                                const res = await fetch('/api/update-stage', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email, newStage: 'Considered - Selected', hrName, extraDetails })
                                });
                                if (res.ok) {
                                    const cand = allCandidates.find(c => c.email === email);
                                    if(cand) cand.recruitmentStage = 'Considered - Selected';
                                    renderCandidates();
                                } else {
                                    alert('Failed to update stage');
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        });
                    });

                    const consNoBtns = tableBody.querySelectorAll('.btn-cons-no');
                    consNoBtns.forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            const container = e.currentTarget.closest('.considered-actions');
                            const email = container.getAttribute('data-email');
                            const extraDetails = prompt('Optional: Enter any specific feedback for this candidate (or leave blank):');
                            if (extraDetails === null) return;
                            
                            let hrName = 'Recruitment Manager';
                            try {
                                const hrUserStr = localStorage.getItem('currentUserProfile');
                                if (hrUserStr) hrName = JSON.parse(hrUserStr).fullName || JSON.parse(hrUserStr).email || hrName;
                            } catch (err) {}

                            try {
                                const res = await fetch('/api/update-stage', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ email, newStage: 'Considered - Rejected', hrName, extraDetails })
                                });
                                if (res.ok) {
                                    const cand = allCandidates.find(c => c.email === email);
                                    if(cand) cand.recruitmentStage = 'Considered - Rejected';
                                    renderCandidates();
                                } else {
                                    alert('Failed to update stage');
                                }
                            } catch (err) {
                                console.error(err);
                            }
                        });
                    });
                };

                // Initial Render
                renderCandidates();

                // Bind Filter Events
                const searchInput = document.getElementById('filter-search');
                if (searchInput) searchInput.addEventListener('input', renderCandidates);
                if (jobFilter) jobFilter.addEventListener('change', renderCandidates);
                const sortSelect = document.getElementById('sort-candidates');
                if (sortSelect) sortSelect.addEventListener('change', renderCandidates);
            } else {
                throw new Error(`Server returned ${res.status}`);
            }
        } catch (e) {
            console.error("Failed to fetch HR candidates data:", e);
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-red-500 font-bold"><span class="material-symbols-outlined align-middle mr-2">error</span>Failed to load candidates. Make sure your MongoDB IP is whitelisted and server is running.</td></tr>`;
            }
        }
    };
    loadHRCandidates();

    // 4. Backend: Fetch Jobs for HR Job Management Page
    const loadHRJobManagement = async () => {
        const jobListContainer = document.getElementById('hr-jobs-container');
        if (!jobListContainer) return;

        try {
            const res = await fetch('/api/jobs?limit=50');
            if (res.ok) {
                const data = await res.json();
                const jobs = data.jobs || [];

                const activeJobsMetric = document.getElementById('hr-count-active-jobs');
                if (activeJobsMetric) {
                    activeJobsMetric.textContent = jobs.length;
                }

                jobListContainer.innerHTML = jobs.map(job => `
                    <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-3">
                        <div class="flex justify-between items-start">
                            <div>
                                <h3 class="font-bold text-lg text-gray-900">${job.title || 'Role'}</h3>
                                <p class="text-sm text-gray-500">${job.company || 'Tech Corp'} • ${job.location || 'Remote'}</p>
                            </div>
                            <span class="bg-emerald-50 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-emerald-200">Active</span>
                        </div>
                        <p class="text-sm text-gray-600 line-clamp-2">${job.description || ''}</p>
                        <div class="pt-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                            <span>ID: ${job.external_job_id || 'N/A'}</span>
                            <a href="candidate_evaluation.html" class="text-primary font-semibold hover:underline">View Applicants &rarr;</a>
                        </div>
                    </div>
                `).join('');
            }
        } catch (e) {
            console.error("Failed to load jobs for HR management:", e);
        }
    };
    loadHRJobManagement();

    // 5. Markdown Resume Modal for Recruiters
    const openMarkdownPreview = async (filename, name) => {
        let modal = document.getElementById('md-view-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'md-view-modal';
            modal.className = 'fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4';
            modal.innerHTML = `
                <div class="bg-white rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col p-6 shadow-2xl relative">
                    <div class="flex justify-between items-center pb-4 border-b border-gray-200">
                        <h3 class="text-xl font-bold text-gray-900" id="md-view-title">${name}'s Resume (Parsed Markdown)</h3>
                        <button class="text-gray-500 hover:text-gray-800 text-2xl font-bold" id="md-modal-close">&times;</button>
                    </div>
                    <div class="py-4 overflow-y-auto flex-1 font-mono text-sm text-gray-800 whitespace-pre-wrap leading-relaxed bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4" id="md-content-body">Loading markdown content...</div>
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
            const res = await fetch(`/api/candidates/${cand.email}/resume`);
            if (res.ok) {
                bodyEl.textContent = await res.text();
            } else {
                bodyEl.textContent = `# Resume: ${name}\n\nCandidate record saved on disk.`;
            }
        } catch (e) {
            bodyEl.textContent = `# Resume: ${name}\n\nUnable to fetch parsed markdown file from server.`;
        }
    };

    // Candidate Drawer Logic
    const drawerOverlay = document.getElementById('candidate-drawer-overlay');
    const drawer = document.getElementById('candidate-drawer');
    const drawerCloseBtn = document.getElementById('close-candidate-drawer');
    const candidateIframe = document.getElementById('candidate-iframe');
    const drawerLoader = document.getElementById('drawer-loader');

    const openCandidateDrawer = (email) => {
        if (!drawer || !drawerOverlay) return;
        
        // Show drawer and overlay
        drawerOverlay.classList.remove('hidden');
        // trigger reflow
        void drawerOverlay.offsetWidth;
        drawerOverlay.classList.remove('opacity-0');
        
        drawer.classList.remove('translate-x-full');
        
        // Show loader
        if(drawerLoader) drawerLoader.classList.remove('hidden');
        
        // Load iframe with drawer=true param and a cache-busting timestamp
        if(candidateIframe) {
            const cacheBuster = new Date().getTime();
            candidateIframe.src = `candidate_evaluation.html?email=${encodeURIComponent(email)}&drawer=true&v=${cacheBuster}`;
            candidateIframe.onload = () => {
                if(drawerLoader) drawerLoader.classList.add('hidden');
            };
        }
    };

    const closeCandidateDrawer = () => {
        if (!drawer || !drawerOverlay) return;
        drawer.classList.add('translate-x-full');
        drawerOverlay.classList.add('opacity-0');
        setTimeout(() => {
            drawerOverlay.classList.add('hidden');
            if(candidateIframe) candidateIframe.src = 'about:blank';
        }, 300);
    };

    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeCandidateDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeCandidateDrawer);

    // Dynamic Candidate Evaluation Page Logic
    if (currentPath === 'candidate_evaluation.html') {
        const urlParams = new URLSearchParams(window.location.search);
        const candEmail = urlParams.get('email');
        const isDrawer = urlParams.get('drawer') === 'true';

        if (isDrawer) {
            const aside = document.querySelector('aside');
            const header = document.querySelector('header');
            const plDiv = document.querySelector('.pl-\\[240px\\]');
            const main = document.querySelector('main');
            
            if(aside) aside.style.display = 'none';
            if(header) header.style.display = 'none';
            if(plDiv) { plDiv.classList.remove('pl-[240px]'); plDiv.classList.add('pl-0'); }
            if(main) { main.classList.remove('pt-[64px]'); main.classList.add('pt-0'); }
        }

        if (candEmail) {
            console.log("Fetching profiles for email:", candEmail);
            fetch('/api/candidates')
                .then(r => r.json())
                .then(profiles => {
                    console.log("Profiles loaded:", profiles.length);
                    const cand = profiles.find(p => p.email === candEmail);
                    console.log("Candidate found:", cand);
                    if (cand) {
                        // Populate basic details using precise IDs
                        const safeSetText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
                        
                        safeSetText('cand-name', cand.fullName || 'Anonymous Candidate');
                        safeSetText('cand-title', cand.jobTitle || 'Candidate');
                        safeSetText('cand-bio', cand.bio || 'No bio provided.');
                        
                        const skillsContainer = document.getElementById('cand-skills-container');
                        const skillsWrapper = document.getElementById('cand-skills-wrapper');
                        if (skillsContainer && skillsWrapper) {
                            if (cand.skills && cand.skills.length > 0) {
                                skillsContainer.innerHTML = cand.skills.map(s => 
                                    `<span class="px-3 py-1.5 bg-secondary-container/30 text-on-secondary-container rounded-md font-body-sm text-body-sm flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-secondary-fixed rounded-full"></span> ${s}</span>`
                                ).join('');
                            } else {
                                skillsContainer.innerHTML = '<p class="text-on-surface-variant font-body-sm">No skills listed.</p>';
                            }
                        }

                        const resumeArea = document.getElementById('resume-content-area');
                        if (resumeArea && cand.resumeFile) {
                            resumeArea.innerHTML = `<div class="p-4 bg-gray-50 rounded-lg text-gray-600 text-center mt-10"><i class="fas fa-file-alt text-4xl mb-4 text-primary"></i><br>PDF view is disabled in Serverless mode. Please view the parsed data instead.</div>`;
                            resumeArea.classList.remove('p-8', 'text-center', 'py-20');
                            resumeArea.classList.add('p-0');
                        }
                        
                        // Set Resume Score Match
                        const scoreNum = cand.resumeScore || 0;
                        const scoreStr = scoreNum + '%';
                        const scoreBars = document.querySelectorAll('.bg-surface-container .bg-primary, .bg-surface-container .bg-primary-fixed-dim');
                        if (scoreBars.length > 0) {
                            scoreBars[0].style.width = scoreStr;
                            if (scoreBars[0].parentElement && scoreBars[0].parentElement.nextElementSibling) {
                                scoreBars[0].parentElement.nextElementSibling.textContent = scoreStr;
                            }
                        }
                        
                        // Set Big Circle Score
                        safeSetText('cand-big-score', scoreNum);
                        
                        let matchText = 'Good Match';
                        if (scoreNum >= 90) matchText = 'Excellent Match';
                        else if (scoreNum < 70) matchText = 'Average Match';
                        else if (scoreNum < 50) matchText = 'Poor Match';
                        safeSetText('cand-match-text', matchText);
                        
                        // Circle SVG stroke-dashoffset (approx math)
                        const overallCircle = document.getElementById('circle-overall');
                        if(overallCircle) {
                            const offset = 282.7 - (282.7 * scoreNum / 100);
                            overallCircle.style.strokeDashoffset = offset;
                        }
                        
                        // Populate Missing/Matched skills dynamically if possible
                        if (cand.skills && Array.isArray(cand.skills)) {
                            const matchedContainer = document.querySelector('.mb-6 .flex.flex-wrap');
                            if (matchedContainer) {
                                matchedContainer.innerHTML = cand.skills.map(skill => 
                                    `<span class="px-3 py-1.5 bg-secondary-container/30 text-on-secondary-container rounded-md font-body-sm text-body-sm flex items-center gap-1.5"><span class="w-1.5 h-1.5 bg-secondary-fixed rounded-full"></span> ${skill}</span>`
                                ).join('');
                            }
                        }
                        
                        // Handle Candidate Actions
                        const updateStatusAndEmail = async (action, stageName, promptMessage) => {
                            let extraDetails = '';
                            if (promptMessage) {
                                extraDetails = prompt(promptMessage);
                                if (extraDetails === null) return; // User cancelled
                            }

                            // Get HR Name
                            let hrName = 'Recruitment Manager';
                            try {
                                const hrUserStr = localStorage.getItem('currentUserProfile');
                                if (hrUserStr) {
                                    const hrUser = JSON.parse(hrUserStr);
                                    hrName = hrUser.fullName || hrUser.email || hrName;
                                }
                            } catch (e) {}

                            try {
                                const res = await fetch(`/api/candidates/${cand._id}/status`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ action, hrName, extraDetails })
                                });
                                if (res.ok) {
                                    alert(`Successfully updated candidate to ${stageName} and sent email notification.`);
                                } else {
                                    const errData = await res.json();
                                    alert(`Failed to update candidate: ${errData.error || 'Unknown error'}`);
                                }
                            } catch (error) {
                                alert('Error updating candidate status.');
                                console.error(error);
                            }
                        };

                        const btnReject = document.getElementById('btn-reject');
                        const btnSchedule = document.getElementById('btn-schedule');
                        const btnShortlist = document.getElementById('btn-shortlist');

                        if (btnReject) btnReject.addEventListener('click', () => updateStatusAndEmail('reject', 'Rejected', 'Optional: Enter any specific feedback for the candidate (or leave blank):'));
                        if (btnSchedule) btnSchedule.addEventListener('click', () => updateStatusAndEmail('schedule', 'Interviewing', 'Enter the proposed date and time for the interview (e.g., Friday at 2:00 PM EST):'));
                        if (btnShortlist) btnShortlist.addEventListener('click', () => updateStatusAndEmail('shortlist', 'Shortlisted', 'Optional: Enter any specific next steps for the candidate (or leave blank):'));
                    }
                })
                .catch(err => console.error("Error loading candidate profile for evaluation:", err));
        }
    }

});
