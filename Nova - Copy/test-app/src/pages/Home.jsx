import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <div className="panel max-w-lg" style={{ textAlign: 'center' }}>
      <h1>Welcome to RecruitEase</h1>
      <p>Choose a portal to get started.</p>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '2rem' }}>
        <Link to="/test-setup" className="btn btn-secondary" style={{ textDecoration: 'none', padding: '1rem', fontSize: '1.1rem' }}>
          💻 Take Test Evaluation
        </Link>
      </div>
    </div>
  );
}
