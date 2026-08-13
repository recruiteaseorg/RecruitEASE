/* ==========================================================================
   RECRUITEASE - LANDING PAGE INTERACTION SCRIPT
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const getStartedBtn = document.getElementById('getStartedBtn');
  const stageAnimation = document.getElementById('stage-animation');
  const stageOffice = document.getElementById('stage-office');
  const officeVideo = document.getElementById('officeVideo');
  const cutToBlack = document.getElementById('cut-to-black');

  // Handle Get Started action
  if (getStartedBtn) {
    getStartedBtn.addEventListener('click', () => {
      // Reset any previous transition states
      if (cutToBlack) cutToBlack.classList.remove('active');

      // Fade out Stage 1 and activate Stage 2
      stageAnimation.classList.remove('active');
      stageOffice.classList.add('active');

      // Play the office sequence from start
      if (officeVideo) {
        officeVideo.load();
        officeVideo.currentTime = 0;
        officeVideo.play().catch(err => console.log('Office video play error:', err));
      }
    });
  }

  // Once candidate office video finishes, cut screen to solid black and redirect to the regular app
  if (officeVideo) {
    officeVideo.addEventListener('ended', () => {
      if (cutToBlack) {
        cutToBlack.classList.add('active');
        // Smooth transition redirect to the main app dashboard
        setTimeout(() => {
          window.location.href = '/app.html';
        }, 1200);
      }
    });
  }
});
