import { useLocation, useNavigate, Navigate } from 'react-router-dom';

export default function AtsResult() {
  const location = useLocation();
  const navigate = useNavigate();
  
  if (!location.state || !location.state.atsResult) {
    return <Navigate to="/" replace />;
  }

  const { atsResult, job_id } = location.state;

  const handleStartAssessment = () => {
    navigate('/assessment', { state: { domain: atsResult.domain, job_id: job_id } });
  };

  // Safe access to prevent rendering crashes
  const statusStr = atsResult?.status || 'Unknown';
  const statusLower = statusStr.toLowerCase();
  const isShortlisted = statusLower === 'shortlisted';

  return (
    <div className="panel max-w-lg">
      <h2>ATS Screening Evaluation</h2>
      <p>Candidate: {atsResult?.candidate_name || 'N/A'}</p>

      <div className="dashboard-grid" style={{ marginTop: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value">{atsResult?.overall_score || 0}%</div>
          <div className="stat-label">Overall Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ fontSize: '1.5rem', color: isShortlisted ? 'var(--success-color)' : 'var(--danger-color)' }}>
            {statusStr}
          </div>
          <div className="stat-label">Status</div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3>Recommendation</h3>
        <p>{atsResult?.recommendation || 'No recommendation provided.'}</p>
      </div>
      
      <div style={{ marginBottom: '1.5rem' }}>
        <h3>Summary</h3>
        <p>{atsResult?.summary || 'No summary provided.'}</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3>Strengths</h3>
        <div>
          {Array.isArray(atsResult?.strengths) && atsResult.strengths.length > 0
            ? atsResult.strengths.map((s, i) => <span key={i} className="badge success">{s}</span>)
            : <span>None listed</span>}
        </div>
      </div>

      <div style={{ marginBottom: '2rem' }}>
        <h3>Missing Skills</h3>
        <div>
          {Array.isArray(atsResult?.missing_skills) && atsResult.missing_skills.length > 0
            ? atsResult.missing_skills.map((s, i) => <span key={i} className="badge danger">{s}</span>)
            : <span>None listed</span>}
        </div>
      </div>

      {isShortlisted && (
        <button className="btn btn-success" style={{ width: '100%' }} onClick={handleStartAssessment}>
          Start Assessment
        </button>
      )}
      
      {/* Fallback debugging info to see what the AI actually returned */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(0,0,0,0.2)', borderRadius: '4px', fontSize: '0.8rem' }}>
        <details>
          <summary>Debug: Raw Output</summary>
          <pre>{JSON.stringify(atsResult, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
}
