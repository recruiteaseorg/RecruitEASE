import { useLocation, Navigate } from 'react-router-dom';

export default function ResultDashboard() {
  const location = useLocation();

  if (!location.state || !location.state.assessmentData || !location.state.candidateAnswers) {
    return <Navigate to="/" replace />;
  }

  const { assessmentData, candidateAnswers, timeTaken, terminatedReason, violations } = location.state;
  const violationsList = violations || [];

  // Evaluation Logic (run early to calculate overall percentage for status updates)
  let correctCount = 0;
  let wrongCount = 0;
  const sectionScores = {}; // { "Logical Reasoning": { correct: 4, total: 5 } }
  const incorrectQuestions = [];

  assessmentData.questions.forEach(q => {
    if (!sectionScores[q.section]) {
      sectionScores[q.section] = { correct: 0, total: 0 };
    }
    const candAnsObj = candidateAnswers.find(ca => ca.questionId === q.id);
    const candAns = candAnsObj ? candAnsObj.answer : null;
    const isCorrect = candAns === q.correct_option;

    sectionScores[q.section].total += 1;
    if (isCorrect) {
      correctCount += 1;
      sectionScores[q.section].correct += 1;
    } else {
      wrongCount += 1;
      incorrectQuestions.push({
        ...q,
        candidateAnswer: candAns
      });
    }
  });

  const totalQuestions = assessmentData.total_questions;
  const overallPercentage = terminatedReason ? 0 : Math.round((correctCount / totalQuestions) * 100);

  const handleCloseTest = () => {
    const selectedJobId = localStorage.getItem('selectedHiringJobId');
    if (selectedJobId) {
      const applied = JSON.parse(localStorage.getItem('appliedJobs') || '[]');
      const jobIdx = applied.findIndex(j => j.jobId === selectedJobId);
      if (jobIdx !== -1) {
        const passed = overallPercentage >= 60;
        applied[jobIdx].status = passed ? 'AI Interview' : 'Rejected';
        localStorage.setItem('appliedJobs', JSON.stringify(applied));
        localStorage.setItem('selectedHiringJobId', selectedJobId);
      }
    }
    window.location.href = '/';
  };

  if (terminatedReason) {
    return (
      <div className="panel max-w-xl" style={{ textAlign: 'center', padding: '2.5rem' }}>
        <h2 style={{ color: 'var(--danger-color)', fontSize: '2.5rem', marginBottom: '1rem', fontWeight: '800' }}>Assessment Terminated</h2>
        
        <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '2rem', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '2rem', textAlign: 'left' }}>
          <h3 style={{ color: 'var(--danger-color)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
            <span style={{ fontSize: '1.4rem' }}>⚠️</span> Critical Violation Detected
          </h3>
          <p style={{ fontSize: '1.15rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '1.25rem' }}>{terminatedReason}</p>
          
          {violationsList.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.15)', paddingTop: '1.25rem' }}>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Proctoring Log Details:</h4>
              <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {violationsList.map((v, idx) => (
                  <li key={idx} style={{ background: 'var(--white)', padding: '0.75rem 1rem', borderRadius: '8px', borderLeft: '4px solid var(--danger-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-primary)' }}>{v.type.replace('_', ' ')}</strong>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{v.details}</span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--gray-100)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                      {new Date(v.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.5', margin: '0 0 2rem 0' }}>This assessment has been flagged and scored as a <strong>0% (FAIL)</strong>. The recruiting team has been notified of this incident.</p>
        <button className="btn btn-primary" onClick={handleCloseTest} style={{ padding: '0.75rem 2rem', fontSize: '1rem', fontWeight: '600' }}>Close Test</button>
      </div>
    );
  }

  const strengths = [];
  const weaknesses = [];

  Object.keys(sectionScores).forEach(section => {
    const s = sectionScores[section];
    const pct = (s.correct / s.total) * 100;
    if (pct >= 80) strengths.push(section);
    if (pct < 60) weaknesses.push(section);
  });

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="panel max-w-xl">
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h2>Assessment Complete</h2>
        <div style={{ 
          width: '150px', height: '150px', borderRadius: '50%', 
          border: `8px solid ${overallPercentage >= 60 ? 'var(--success-color)' : 'var(--danger-color)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '2rem auto', fontSize: '2.5rem', fontWeight: '800'
        }}>
          {overallPercentage}%
        </div>
        <span className={`badge ${overallPercentage >= 60 ? 'success' : 'danger'}`} style={{ fontSize: '1.2rem', padding: '0.5rem 1.5rem' }}>
          {overallPercentage >= 60 ? 'PASSED' : 'FAILED'}
        </span>
      </div>

      <div className="dashboard-grid">
        <div className="stat-card">
          <div className="stat-value">{correctCount}</div>
          <div className="stat-label">Correct Answers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--danger-color)' }}>{wrongCount}</div>
          <div className="stat-label">Wrong Answers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--text-primary)' }}>{formatTime(timeTaken)}</div>
          <div className="stat-label">Time Taken</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--secondary-color)' }}>{overallPercentage}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
      </div>

      <div style={{ margin: '3rem 0' }}>
        <h3>Section-wise Performance</h3>
        {Object.keys(sectionScores).map(section => {
          const s = sectionScores[section];
          const pct = Math.round((s.correct / s.total) * 100);
          return (
            <div key={section} style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <strong>{section}</strong>
                <span>{s.correct}/{s.total} ({pct}%)</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%`, background: pct >= 80 ? 'var(--success-color)' : pct < 60 ? 'var(--danger-color)' : 'var(--primary-color)' }}></div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="dashboard-grid">
        <div>
          <h3 style={{ color: 'var(--success-color)' }}>Strengths</h3>
          {strengths.length > 0 ? (
            strengths.map((s, i) => <span key={i} className="badge success">{s}</span>)
          ) : <p>No clear strengths identified.</p>}
        </div>
        <div>
          <h3 style={{ color: 'var(--danger-color)' }}>Weaknesses</h3>
          {weaknesses.length > 0 ? (
            weaknesses.map((s, i) => <span key={i} className="badge danger">{s}</span>)
          ) : <p>No major weaknesses identified.</p>}
        </div>
      </div>

      {incorrectQuestions.length > 0 && (
        <div style={{ marginTop: '3rem' }}>
          <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '2rem' }}>Review Incorrect Answers</h3>
          {incorrectQuestions.map((iq, idx) => (
            <div key={idx} className="review-item">
              <h4>Q: {iq.question}</h4>
              <div className="answer-row">
                <span style={{ color: 'var(--danger-color)' }}>Your Answer: </span> {iq.candidateAnswer}
              </div>
              <div className="answer-row">
                <span style={{ color: 'var(--success-color)' }}>Correct Answer: </span> {iq.correctAnswer}
              </div>
              <div className="explanation-box">
                <strong>Explanation: </strong>
                {iq.explanation}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}>
        <button className="btn btn-primary" onClick={handleCloseTest}>Close Test</button>
      </div>
    </div>
  );
}
