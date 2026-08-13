// Configuration
const API_URL = 'https://api.agents.snsihub.ai/webhook/8c2f2441-ed83-4d97-9a2b-625ef1a8ae38/hrjob';
const API_TEST_URL = 'https://api.agents.snsihub.ai/webhook-test/8c2f2441-ed83-4d97-9a2b-625ef1a8ae38/hrjob';

// State
let state = {
  currentCompany: 'instacart', // Default active company session
  jobs: [],                    // Authorized company jobs from backend
  filteredJobs: [],            // Active company jobs matching UI filters
  isMockMode: false,           // Default: Live Webhook API (OFF = Real Webhook)
  isLoading: false,            // Network loading state
  errorMessage: null,          // Backend connection error state
  editingJobId: null           // Stores raw_external_job_id during edit operations
};

let searchDebounceTimeout = null;

// Initial Seed Data (strictly for Mock Mode testing when explicitly enabled)
const initialSeedJobs = [
  {
    title: 'Software Engineer',
    company: 'instacart',
    location: 'Bangalore, India',
    mandatory_skills: ['JavaScript', 'React'],
    preferred_skills: ['Node.js', 'Express'],
    status: 'active',
    external_job_id: 'instacart_12345',
    source: 'Greenhouse',
    application_url: 'https://example.com/job',
    department: 'Technology',
    description: 'We are looking for a Software Engineer to join our core applications team. You will build and scale high-performance interfaces and web applications.'
  },
  {
    title: 'Frontend Developer',
    company: 'instacart',
    location: 'Bangalore, India',
    mandatory_skills: ['HTML', 'CSS', 'JavaScript', 'React'],
    preferred_skills: ['TypeScript', 'Next.js'],
    status: 'active',
    external_job_id: 'instacart_custom_001',
    source: 'RecruitEASE',
    application_url: 'https://example.com/job2',
    department: 'Technology',
    description: 'Frontend Developer responsible for developing and maintaining responsive web applications.'
  },
  {
    title: 'Cloud Architect',
    company: 'amazon',
    location: 'Seattle, WA',
    mandatory_skills: ['AWS', 'Kubernetes', 'Terraform'],
    preferred_skills: ['Go', 'Python'],
    status: 'active',
    external_job_id: 'amazon_98765',
    source: 'Internal Referral',
    application_url: 'https://amazon.jobs/cloud-architect',
    department: 'Cloud Solutions',
    description: 'Design and deploy scalable containerized architectures for our cloud platform operations.'
  },
  {
    title: 'HR Generalist',
    company: 'walmart',
    location: 'Bentonville, AR',
    mandatory_skills: ['HR Operations', 'Employee Relations'],
    preferred_skills: ['Workday', 'Excel'],
    status: 'active',
    external_job_id: 'walmart_55442',
    source: 'LinkedIn',
    application_url: 'https://walmart.com/careers',
    department: 'Human Resources',
    description: 'Manage HR operations, onboard staff, and ensure compliance across the regional offices.'
  }
];

// Initialize Mock LocalStorage if empty
try {
  let existingMockJobs = localStorage.getItem('recruitease_mock_jobs');
  if (existingMockJobs && existingMockJobs.includes('instamart')) {
    existingMockJobs = existingMockJobs.replace(/instamart/gi, 'instacart');
    localStorage.setItem('recruitease_mock_jobs', existingMockJobs);
  }
  if (!localStorage.getItem('recruitease_mock_jobs')) {
    localStorage.setItem('recruitease_mock_jobs', JSON.stringify(initialSeedJobs));
  }
} catch (e) {
  console.warn('LocalStorage initialization warning:', e);
}

// DOM Elements
const sessionSelect = document.getElementById('user-session-select');
const mockModeToggle = document.getElementById('mock-mode-toggle');
const apiStatusBadge = document.getElementById('api-status');
const apiStatusText = document.getElementById('api-status-text');
const companySubtitle = document.getElementById('company-subtitle');

const jobsTbody = document.getElementById('jobs-tbody');
const emptyState = document.getElementById('empty-state');

const statTotal = document.getElementById('stat-total');
const statActive = document.getElementById('stat-active');
const statDepts = document.getElementById('stat-depts');
const statLocations = document.getElementById('stat-locations');

const searchJobs = document.getElementById('search-jobs');
const filterDept = document.getElementById('filter-department');
const filterStatus = document.getElementById('filter-status');
const addJobBtn = document.getElementById('add-job-btn');

// Modals
const jobModal = document.getElementById('job-modal');
const jobForm = document.getElementById('job-form');
const saveJobBtn = document.getElementById('save-job-btn');
const modalTitle = document.getElementById('modal-title');
const cancelModal = document.getElementById('cancel-modal');
const closeModal = document.getElementById('close-modal');

const viewModal = document.getElementById('view-modal');
const closeViewModal = document.getElementById('close-view-modal');
const closeViewBtn = document.getElementById('close-view-btn');
const viewDetailsContent = document.getElementById('view-details-content');

// Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${escapeHtml(message)}</span>
    <span style="cursor:pointer;" onclick="this.parentElement.remove()">&times;</span>
  `;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 4500);
}

// Set Webhook API Status Indicator
function setApiStatus(isMock) {
  state.isMockMode = isMock;
  if (isMock) {
    apiStatusBadge.className = 'api-status-badge status-mock';
    apiStatusText.textContent = 'Demo Mode (Offline)';
  } else {
    apiStatusBadge.className = 'api-status-badge status-live';
    apiStatusText.textContent = 'Live Webhook API';
  }
}

// Request Wrapper - Communicates directly with SNS Workbench Live Webhook
async function makeRequest(payload) {
  console.log(`🌐 [makeRequest] Outgoing HTTP POST -> Action: "${payload.action}" | Company: "${payload.company}"`, payload);

  if (state.isMockMode) {
    console.log('ℹ️ [makeRequest] Using Local Demo Mode (Mock)');
    return handleMockRequest(payload);
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(errText || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`✅ [makeRequest] Received Response for "${payload.action}":`, data);
    return data;
  } catch (error) {
    console.error(`❌ [makeRequest Error] Action "${payload.action}" failed:`, error);
    return { success: false, error: error.message || 'Unable to load jobs. Please try again.' };
  }
}

// Mock Request Handler (Active ONLY when Use Mock Data = ON)
function handleMockRequest(payload) {
  let mockJobs = JSON.parse(localStorage.getItem('recruitease_mock_jobs')) || [];
  const action = payload.action;
  const company = payload.company;

  if (!company) {
    return { success: false, error: 'Company is required' };
  }

  switch (action) {
    case 'get_jobs': {
      let companyJobs = mockJobs.filter(j => j.company.toLowerCase() === company.toLowerCase());
      if (payload.search) {
        const q = payload.search.toLowerCase();
        companyJobs = companyJobs.filter(j => j.title.toLowerCase().includes(q) || j.location.toLowerCase().includes(q));
      }
      if (payload.department) {
        companyJobs = companyJobs.filter(j => j.department === payload.department);
      }
      if (payload.status) {
        const s = payload.status.toLowerCase();
        companyJobs = companyJobs.filter(j => s === 'active' ? (j.status === 'active' || j.status === 'open') : (j.status === 'inactive' || j.status === 'closed'));
      }
      return { success: true, action: 'get_jobs', company: company, jobs: companyJobs };
    }

    case 'create_job': {
      const jobData = payload.job;
      if (!jobData) return { success: false, error: 'Job data is required' };
      const newJob = {
        title: jobData.title,
        company: company,
        location: jobData.location,
        mandatory_skills: jobData.mandatory_skills,
        preferred_skills: jobData.preferred_skills || [],
        status: jobData.status || 'open',
        external_job_id: jobData.external_job_id,
        source: jobData.source || 'HR Portal',
        application_url: jobData.application_url || '',
        department: jobData.department,
        description: jobData.description
      };
      mockJobs.push(newJob);
      localStorage.setItem('recruitease_mock_jobs', JSON.stringify(mockJobs));
      return { success: true, action: 'create_job', message: 'Job created successfully', job: newJob };
    }

    case 'update_job': {
      const jobIndex = mockJobs.findIndex(j => j.external_job_id === payload.job_id);
      if (jobIndex === -1) {
        return { success: false, error: 'Job not found' };
      }
      const jobData = payload.job || {};
      mockJobs[jobIndex] = {
        ...mockJobs[jobIndex],
        title: jobData.title,
        location: jobData.location,
        mandatory_skills: jobData.mandatory_skills,
        preferred_skills: jobData.preferred_skills,
        status: jobData.status,
        application_url: jobData.application_url,
        department: jobData.department,
        description: jobData.description
      };
      localStorage.setItem('recruitease_mock_jobs', JSON.stringify(mockJobs));
      return { success: true, action: 'update_job', message: 'Job updated successfully', job: mockJobs[jobIndex] };
    }

    case 'delete_job': {
      const jobIndex = mockJobs.findIndex(j => 
        j.external_job_id === payload.job_id || 
        (j.raw_external_job_id && j.raw_external_job_id === payload.job_id)
      );
      if (jobIndex === -1) {
        return { success: false, error: 'Job not found' };
      }
      mockJobs.splice(jobIndex, 1);
      localStorage.setItem('recruitease_mock_jobs', JSON.stringify(mockJobs));
      return { success: true, action: 'delete_job', message: 'Job deleted successfully' };
    }

    case 'get_selected_candidates': {
      return { success: true, action: 'get_selected_candidates', company: company, candidates: [] };
    }

    default:
      return { success: false, error: 'Invalid action' };
  }
}

// Sanitizes job objects to preserve raw database ID while normalizing display names
function sanitizeJob(job) {
  if (job) {
    if (!job.raw_external_job_id) {
      job.raw_external_job_id = job.external_job_id;
    }
    if (job.company && job.company.toLowerCase() === 'instamart') {
      job.company = 'instacart';
    }
    if (job.external_job_id && job.external_job_id.toLowerCase().includes('instamart')) {
      job.external_job_id = job.external_job_id.replace(/instamart/gi, 'instacart');
    }
  }
  return job;
}

// Helper to check if API returned a successful response
function isApiSuccess(result, actionName = '') {
  if (!result) return false;
  if (result.success === false) return false;
  if (result.error && typeof result.error === 'string' && result.error.length > 0) return false;
  if (result.success === true) return true;
  if (result.status === 'completed') return true;
  if (Array.isArray(result)) return true;
  if (result.external_job_id || result.id || result.title || result.company) return true;
  if (result.result || result.data || result.body) return true;
  if (actionName === 'delete_job' && typeof result === 'object') return true;
  if (typeof result === 'object' && Object.keys(result).length === 0) return true;
  return false;
}

// Render Loading State in Table
function renderLoadingState() {
  emptyState.style.display = 'none';
  jobsTbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-secondary);">
        <div style="display: flex; align-items: center; justify-content: center; gap: 0.75rem; font-weight: 500; font-size: 0.95rem;">
          <svg class="spin-loader" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
            <path d="M12 2a10 10 0 0 1 10 10" stroke="var(--primary)"></path>
          </svg>
          Loading jobs for ${escapeHtml(state.currentCompany.toUpperCase())}...
        </div>
      </td>
    </tr>
  `;
}

// Render Error State when Live API call fails (Do NOT fallback silently to mock data)
function renderErrorState() {
  jobsTbody.innerHTML = '';
  emptyState.innerHTML = `
    <svg width="48" height="48" fill="none" stroke="var(--danger)" stroke-width="1.5" viewBox="0 0 24 24">
      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
    </svg>
    <h3 style="color: var(--danger); margin-top: 0.75rem;">Unable to load jobs. Please try again.</h3>
    <p style="color: var(--text-secondary); max-width: 420px; margin: 0.5rem auto 0; font-size: 0.875rem;">
      Failed to connect to backend workflow for ${escapeHtml(state.currentCompany.toUpperCase())}. Please verify your connection or switch to Demo Mode.
    </p>
  `;
  emptyState.style.display = 'flex';
}

// Fetch and Render Job List from Backend Webhook
async function fetchJobs() {
  state.isLoading = true;
  state.errorMessage = null;
  renderLoadingState();

  const searchQuery = searchJobs.value.trim();
  const deptQuery = filterDept.value;
  const statusQuery = filterStatus.value;

  // Build Request Payload with Active HR Company & Filter Parameters
  const requestPayload = {
    action: 'get_jobs',
    company: state.currentCompany
  };

  if (searchQuery) requestPayload.search = searchQuery;
  if (deptQuery) requestPayload.department = deptQuery;
  if (statusQuery) requestPayload.status = statusQuery;

  const result = await makeRequest(requestPayload);

  state.isLoading = false;

  if (isApiSuccess(result, 'get_jobs')) {
    let jobsList = [];
    let statisticsData = null;

    if (result.statistics) {
      statisticsData = result.statistics;
    }

    if (result.jobs && Array.isArray(result.jobs)) {
      jobsList = result.jobs;
    } else if (result.result && Array.isArray(result.result)) {
      jobsList = result.result;
    } else if (result.result && result.result.jobs && Array.isArray(result.result.jobs)) {
      jobsList = result.result.jobs;
    } else if (result.result && result.result.body && result.result.body.jobs && Array.isArray(result.result.body.jobs)) {
      jobsList = result.result.body.jobs;
    } else if (result.output && result.output.items && Array.isArray(result.output.items)) {
      result.output.items.forEach(item => {
        if (item.json) {
          if (Array.isArray(item.json)) jobsList.push(...item.json);
          else if (item.json.jobs && Array.isArray(item.json.jobs)) jobsList.push(...item.json.jobs);
          else if (item.json.body && item.json.body.jobs && Array.isArray(item.json.body.jobs)) jobsList.push(...item.json.body.jobs);
          else if (item.json.title || item.json.external_job_id) jobsList.push(item.json);
        }
      });
    }

    // STRICT HR COMPANY BOUNDARY CHECK:
    // Never allow jobs belonging to another company to render if returned
    state.jobs = jobsList
      .map(sanitizeJob)
      .filter(j => !j.company || j.company.toLowerCase() === state.currentCompany.toLowerCase());

    populateDepartmentFilter();
    updateStats(statisticsData);
    applyFilters();
  } else {
    // API Failed - Display Error State as required by Architecture Guidelines (NO SILENT MOCK FALLBACK)
    state.jobs = [];
    state.filteredJobs = [];
    state.errorMessage = 'Unable to load jobs. Please try again.';
    renderErrorState();
    showToast(state.errorMessage, 'error');
  }
}

// Populate Department Filter Options dynamically based on company jobs
function populateDepartmentFilter() {
  const departments = [...new Set(state.jobs.map(j => j.department).filter(Boolean))];
  const currentSelection = filterDept.value;
  
  filterDept.innerHTML = '<option value="">All Departments</option>';
  departments.forEach(dept => {
    const option = document.createElement('option');
    option.value = dept;
    option.textContent = dept;
    filterDept.appendChild(option);
  });
  
  if (departments.includes(currentSelection)) {
    filterDept.value = currentSelection;
  }
}

// Update Stats Dashboard Cards (Using backend statistics object if provided, or authorized company jobs)
function updateStats(backendStats = null) {
  if (backendStats) {
    if (backendStats.total_jobs !== undefined) statTotal.textContent = backendStats.total_jobs;
    if (backendStats.active_positions !== undefined) statActive.textContent = backendStats.active_positions;
    if (backendStats.departments !== undefined) statDepts.textContent = backendStats.departments;
    if (backendStats.job_locations !== undefined) statLocations.textContent = backendStats.job_locations;
    return;
  }

  // Calculate stats strictly from authorized company jobs
  statTotal.textContent = state.jobs.length;
  statActive.textContent = state.jobs.filter(j => j.status === 'active' || j.status === 'open').length;
  
  const uniqueDepts = new Set(state.jobs.map(j => j.department ? j.department.trim().toLowerCase() : ''));
  uniqueDepts.delete('');
  statDepts.textContent = uniqueDepts.size;

  const uniqueLocations = new Set(state.jobs.map(j => j.location ? j.location.trim().toLowerCase() : ''));
  uniqueLocations.delete('');
  statLocations.textContent = uniqueLocations.size;
}

// Helper to render skills as tags
function getSkillsHtml(skills) {
  if (!skills) return '';
  let skillsArray = [];
  if (Array.isArray(skills)) {
    skillsArray = skills;
  } else if (typeof skills === 'string') {
    skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
  }
  return skillsArray.map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');
}

// Helper to convert skills back to input string
function getSkillsInputString(skills) {
  if (!skills) return '';
  if (Array.isArray(skills)) {
    return skills.join(', ');
  }
  return skills;
}

// Render Jobs Table
function renderJobs() {
  if (state.isLoading) return; // Loading state rendered separately

  if (state.errorMessage) {
    renderErrorState();
    return;
  }

  jobsTbody.innerHTML = '';
  
  if (state.filteredJobs.length === 0) {
    emptyState.innerHTML = `
      <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
      </svg>
      <h3>No jobs found</h3>
      <p>Try clearing your filters or create a new job position for ${escapeHtml(state.currentCompany.toUpperCase())}.</p>
    `;
    emptyState.style.display = 'flex';
    return;
  }
  
  emptyState.style.display = 'none';
  
  state.filteredJobs.forEach(job => {
    const tr = document.createElement('tr');
    const statusClass = (job.status === 'active' || job.status === 'open') ? 'status-active' : 'status-inactive';
    const skillsHtml = getSkillsHtml(job.mandatory_skills);

    tr.innerHTML = `
      <td>
        <div class="job-title-cell">${escapeHtml(job.title)}</div>
        <div class="company-badge">${escapeHtml(job.company || state.currentCompany)}</div>
      </td>
      <td>${escapeHtml(job.department || 'N/A')}</td>
      <td>${escapeHtml(job.location)}</td>
      <td>
        <span class="status-badge ${statusClass}">
          <span class="status-dot"></span>
          ${escapeHtml(job.status || 'open')}
        </span>
      </td>
      <td>${skillsHtml || '<span style="color:var(--text-muted)">None</span>'}</td>
      <td class="actions-cell">
        <button class="btn btn-secondary btn-sm" onclick="viewJob('${escapeHtml(job.external_job_id)}')">View</button>
        <button class="btn btn-secondary btn-sm" onclick="openEditModal('${escapeHtml(job.external_job_id)}')">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteJob('${escapeHtml(job.external_job_id)}')">Delete</button>
      </td>
    `;
    jobsTbody.appendChild(tr);
  });
}

// Apply Client-Side Filter on Company Jobs Dataset
function applyFilters() {
  if (state.isLoading) return;
  if (state.errorMessage) {
    renderErrorState();
    return;
  }

  const searchQuery = searchJobs.value.trim().toLowerCase();
  const deptQuery = filterDept.value;
  const statusQuery = filterStatus.value;

  state.filteredJobs = state.jobs.filter(job => {
    if (!job || !job.title) return false;
    
    // Strict Company Authorization Boundary
    if (job.company && job.company.toLowerCase() !== state.currentCompany.toLowerCase()) {
      return false;
    }

    const matchesSearch = !searchQuery || 
                          (job.title && job.title.toLowerCase().includes(searchQuery)) || 
                          (job.location && job.location.toLowerCase().includes(searchQuery)) ||
                          (job.department && job.department.toLowerCase().includes(searchQuery));
    
    const matchesDept = !deptQuery || job.department === deptQuery;
    
    let matchesStatus = true;
    if (statusQuery) {
      if (statusQuery === 'active') {
        matchesStatus = job.status === 'active' || job.status === 'open';
      } else {
        matchesStatus = job.status === 'inactive' || job.status === 'closed';
      }
    }

    return matchesSearch && matchesDept && matchesStatus;
  });

  renderJobs();
}

// View Single Job Details (All backend fields)
function viewJob(id) {
  const job = sanitizeJob(state.jobs.find(j => j.external_job_id === id || j.raw_external_job_id === id));
  if (!job) {
    showToast('Job details not found', 'error');
    return;
  }

  viewDetailsContent.innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Job Title</div>
      <div class="detail-value" style="font-weight: 700; font-size: 1.15rem; color: var(--primary);">${escapeHtml(job.title)}</div>
    </div>
    <div class="form-grid" style="margin-bottom: 1.5rem;">
      <div class="detail-section">
        <div class="detail-label">Company</div>
        <div class="detail-value">${escapeHtml(job.company || state.currentCompany)}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">External Job ID</div>
        <div class="detail-value">${escapeHtml(job.external_job_id || 'N/A')}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Location</div>
        <div class="detail-value">${escapeHtml(job.location || 'N/A')}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Department</div>
        <div class="detail-value">${escapeHtml(job.department || 'N/A')}</div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Status</div>
        <div class="detail-value">
          <span class="status-badge ${(job.status === 'active' || job.status === 'open') ? 'status-active' : 'status-inactive'}">
            ${escapeHtml(job.status || 'open')}
          </span>
        </div>
      </div>
      <div class="detail-section">
        <div class="detail-label">Source</div>
        <div class="detail-value">${escapeHtml(job.source || 'HR Portal')}</div>
      </div>
    </div>
    
    ${job.application_url ? `
    <div class="detail-section">
      <div class="detail-label">Application URL</div>
      <div class="detail-value">
        <a href="${escapeHtml(job.application_url)}" target="_blank" style="color: var(--primary); text-decoration: underline;">
          ${escapeHtml(job.application_url)}
        </a>
      </div>
    </div>` : ''}

    <div class="detail-section">
      <div class="detail-label">Mandatory Skills</div>
      <div class="detail-value">
        ${getSkillsHtml(job.mandatory_skills) || '<span style="color:var(--text-muted)">None</span>'}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Preferred Skills</div>
      <div class="detail-value">
        ${getSkillsHtml(job.preferred_skills) || '<span style="color:var(--text-muted)">None Specified</span>'}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Job Description</div>
      <div class="detail-value" style="white-space: pre-wrap; background: rgba(0,0,0,0.15); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--border-color);">${escapeHtml(job.description || 'No description available.')}</div>
    </div>
  `;
  viewModal.classList.add('active');
}

// Delete Job Call - Sends action: delete_job to Webhook
async function deleteJob(id) {
  console.log(`🗑️ [deleteJob] Delete button clicked for job ID: "${id}"`);
  if (!confirm('Are you sure you want to delete this job position?')) {
    console.log('ℹ️ [deleteJob] User cancelled deletion dialog.');
    return;
  }

  const targetJob = state.jobs.find(j => j.external_job_id === id || j.raw_external_job_id === id || j.id === id);
  const dbJobId = targetJob ? (targetJob.raw_external_job_id || targetJob.external_job_id || id) : id;

  console.log(`🚀 [deleteJob] Sending delete request to Webhook API for DB Job ID: "${dbJobId}"`);

  const result = await makeRequest({
    action: 'delete_job',
    company: state.currentCompany,
    job_id: dbJobId,
    external_job_id: dbJobId,
    id: dbJobId
  });

  if (isApiSuccess(result, 'delete_job')) {
    console.log('✅ [deleteJob] Deletion confirmed by backend.');
    showToast((result && result.message) || 'Job deleted successfully');
    await fetchJobs(); // Refresh job list and statistics from backend
  } else {
    console.error('❌ [deleteJob Error] Delete API Response:', result);
    const errMsg = (result && (result.message || result.error || (result.error && result.error.message))) || 'Failed to delete job position';
    showToast(errMsg, 'error');
  }
}

// Candidate Data API Helper (Consistent Webhook Action Standard)
async function getCandidatesForJob(jobId) {
  const result = await makeRequest({
    action: 'get_selected_candidates',
    company: state.currentCompany,
    job_id: jobId
  });
  return result;
}

// Save/Submit Form (Create or Update)
saveJobBtn.addEventListener('click', async (e) => {
  console.log('💾 [saveJobBtn] Save Job button clicked.');
  if (!jobForm.checkValidity()) {
    console.warn('⚠️ [saveJobBtn] Form validation failed.');
    jobForm.reportValidity();
    return;
  }

  if (saveJobBtn.disabled) return;
  saveJobBtn.disabled = true;
  saveJobBtn.textContent = 'Saving...';

  try {
    const title = document.getElementById('form-title').value.trim();
    // Company is strictly bound to active HR company session
    const company = state.currentCompany;
    const location = document.getElementById('form-location').value.trim();
    const department = document.getElementById('form-department').value.trim();
    const mandatory_skills = document.getElementById('form-mandatory-skills').value.trim();
    const preferred_skills = document.getElementById('form-preferred-skills').value.trim();
    const status = document.getElementById('form-status').value;
    const application_url = document.getElementById('form-url').value.trim();
    const source = document.getElementById('form-source').value.trim() || 'HR Portal';
    const description = document.getElementById('form-description').value.trim();

    const mandatoryArray = mandatory_skills.split(',').map(s => s.trim()).filter(Boolean);
    const preferredArray = preferred_skills.split(',').map(s => s.trim()).filter(Boolean);

    let result;

    if (state.editingJobId) {
      // UPDATE JOB - Sends both top-level and nested job properties for backend compatibility
      const jobPayload = {
        title,
        location,
        mandatory_skills: mandatoryArray,
        preferred_skills: preferredArray,
        status,
        application_url,
        source,
        department,
        description
      };

      result = await makeRequest({
        action: 'update_job',
        company: company,
        job_id: state.editingJobId,
        external_job_id: state.editingJobId,
        ...jobPayload,
        job: jobPayload
      });

      if ((result && result.success === true) || isApiSuccess(result, 'update_job')) {
        showToast((result && result.message) || 'Job updated successfully.');
        closeJobModal();
        await fetchJobs(); // Refresh job list from backend after update confirmation
      } else {
        console.error('Update API Error Response:', result);
        const errMsg = (result && (result.message || result.error)) || 'Failed to update job position';
        showToast(errMsg, 'error');
      }

    } else {
      // CREATE JOB - Sends both top-level and nested job properties for backend compatibility
      const uniqueSuffix = Date.now().toString().slice(-6);
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
      const external_job_id = `${company}_${slug}_${uniqueSuffix}`;

      const jobPayload = {
        title,
        location,
        mandatory_skills: mandatoryArray,
        preferred_skills: preferredArray,
        status,
        external_job_id,
        source,
        application_url,
        department,
        description
      };

      result = await makeRequest({
        action: 'create_job',
        company: company,
        external_job_id: external_job_id,
        ...jobPayload,
        job: jobPayload
      });

      if ((result && result.success === true) || isApiSuccess(result, 'create_job')) {
        showToast((result && result.message) || 'Job created successfully.');
        closeJobModal();
        await fetchJobs(); // Refresh job list from backend after creation confirmation
      } else {
        console.error('Create API Error Response:', result);
        const errMsg = (result && (result.message || result.error)) || 'Failed to create job position';
        showToast(errMsg, 'error');
      }
    }

  } catch (err) {
    console.error('Form submission exception:', err);
    showToast(`Submission Error: ${err.message}`, 'error');
  } finally {
    saveJobBtn.disabled = false;
    saveJobBtn.textContent = 'Save Job';
  }
});

// Modal Utilities
function closeJobModal() {
  jobModal.classList.remove('active');
  jobForm.reset();
  state.editingJobId = null;
}

function openCreateModal() {
  modalTitle.textContent = 'Create Job Position';
  document.getElementById('form-company').value = state.currentCompany.toUpperCase();
  state.editingJobId = null;
  jobModal.classList.add('active');
}

// Edit Modal Loader
function openEditModal(id) {
  const job = sanitizeJob(state.jobs.find(j => j.external_job_id === id || j.raw_external_job_id === id));
  if (!job) {
    showToast('Job details not found', 'error');
    return;
  }

  state.editingJobId = job.raw_external_job_id || job.external_job_id || id;
  
  modalTitle.textContent = 'Edit Job Position';
  document.getElementById('form-title').value = job.title;
  document.getElementById('form-company').value = (job.company || state.currentCompany).toUpperCase();
  document.getElementById('form-location').value = job.location;
  document.getElementById('form-department').value = job.department || '';
  document.getElementById('form-source').value = job.source || '';
  document.getElementById('form-status').value = job.status || 'open';
  document.getElementById('form-url').value = job.application_url || '';
  document.getElementById('form-mandatory-skills').value = getSkillsInputString(job.mandatory_skills);
  document.getElementById('form-preferred-skills').value = getSkillsInputString(job.preferred_skills);
  document.getElementById('form-description').value = job.description || '';

  jobModal.classList.add('active');
}

// HR Company Session Switcher Logic
sessionSelect.addEventListener('change', (e) => {
  state.currentCompany = e.target.value;
  companySubtitle.textContent = `${state.currentCompany.charAt(0).toUpperCase() + state.currentCompany.slice(1)} Job Board`;
  
  // Clear previous company's data immediately to prevent cross-company leakage
  state.jobs = [];
  state.filteredJobs = [];
  searchJobs.value = '';
  filterDept.value = '';
  filterStatus.value = '';

  // Trigger get_jobs request for new company
  fetchJobs();
  showToast(`Switched active HR session to ${state.currentCompany.toUpperCase()}`);
});

// Helper to escape HTML tags
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Event Listeners
addJobBtn.addEventListener('click', openCreateModal);
closeModal.addEventListener('click', closeJobModal);
cancelModal.addEventListener('click', closeJobModal);

closeViewModal.addEventListener('click', () => viewModal.classList.remove('active'));
closeViewBtn.addEventListener('click', () => viewModal.classList.remove('active'));

// Debounced Search Input (Sends search parameter to backend workflow)
searchJobs.addEventListener('input', () => {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    fetchJobs();
  }, 350);
});

// Filter Change Handlers (Sends department & status parameters to backend workflow)
filterDept.addEventListener('change', () => {
  fetchJobs();
});

filterStatus.addEventListener('change', () => {
  fetchJobs();
});

mockModeToggle.addEventListener('change', (e) => {
  setApiStatus(e.target.checked);
  fetchJobs();
  showToast(e.target.checked ? 'Switched to Demo Mode (Mock)' : 'Switched to Live Webhook API');
});

// Window Global Event Handlers
window.viewJob = viewJob;
window.openEditModal = openEditModal;
window.deleteJob = deleteJob;
window.getCandidatesForJob = getCandidatesForJob;

// Initialize Dashboard
document.addEventListener('DOMContentLoaded', () => {
  state.currentCompany = sessionSelect.value;
  companySubtitle.textContent = `${state.currentCompany.charAt(0).toUpperCase() + state.currentCompany.slice(1)} Job Board`;
  setApiStatus(false); // Default: Live Webhook API (OFF = Real Webhook)
  fetchJobs();
});
