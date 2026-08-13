import { useLocation, useNavigate } from 'react-router-dom';

export default function ResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { score, total } = location.state || { score: 0, total: 3 };

  const handleRetake = () => {
    navigate('/test');
  };

  const handleLogout = () => {
    navigate('/login');
  };

  return (
    <div className="result-container">
      <div className="glass-panel">
        <h1>Test Complete!</h1>
        <p>Here is your performance summary.</p>
        
        <div className="score-circle">
          <div className="number">{score}</div>
          <div className="label">Out of {total}</div>
        </div>
        
        <p style={{ marginBottom: '2rem', fontSize: '1.1rem' }}>
          {score === total ? 'Perfect Score! Great job!' : 'Good effort! Keep practicing.'}
        </p>
        
        <button className="btn" onClick={handleRetake}>Retake Test</button>
        <button className="btn btn-secondary" onClick={handleLogout}>Log Out</button>
      </div>
    </div>
  );
}
