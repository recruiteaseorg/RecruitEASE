/**
 * auth_guard.js — RecruitEase Auth Guard
 * Include as the FIRST script in any protected page's <head>.
 * Immediately redirects unauthenticated users to the login page.
 */
(function () {
  const PROTECTED_CANDIDATE_PAGES = [
    'dashboard.html', 'explore_jobs.html', 'applications.html',
    'self_development.html', 'ai_interview.html', 'behavioral_assessment.html',
    'proctored_assessment.html', 'ats_screening.html'
  ];
  const PROTECTED_HR_PAGES = [
    'recruiter_workspace.html', 'add_job.html', 'job_management.html',
    'interviews.html', 'intelligence.html', 'candidate_evaluation.html'
  ];

  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  let profile = null;
  try { profile = JSON.parse(localStorage.getItem('currentUserProfile') || 'null'); } catch (e) {}

  const isLoggedIn  = profile && profile.email;
  const role        = (profile && profile.role) || 'candidate';

  // Not logged in → redirect to landing login
  if (!isLoggedIn) {
    if (PROTECTED_CANDIDATE_PAGES.includes(currentPage) || PROTECTED_HR_PAGES.includes(currentPage)) {
      sessionStorage.setItem('redirectAfterLogin', window.location.href);
      window.location.replace('/index.html');
      throw new Error('AUTH_REDIRECT'); // stop further JS execution
    }
    return;
  }

  // Wrong role — HR trying to access candidate pages
  if (role === 'hr' && PROTECTED_CANDIDATE_PAGES.includes(currentPage)) {
    window.location.replace('/recruiter_workspace.html');
    throw new Error('AUTH_REDIRECT');
  }
  // Candidate trying to access HR pages
  if (role === 'candidate' && PROTECTED_HR_PAGES.includes(currentPage)) {
    window.location.replace('/dashboard.html');
    throw new Error('AUTH_REDIRECT');
  }
})();
