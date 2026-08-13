import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import ResumeScreening from './pages/ResumeScreening';
import TestSetup from './pages/TestSetup';
import AtsResult from './pages/AtsResult';
import Assessment from './pages/Assessment';
import ResultDashboard from './pages/ResultDashboard';

function App() {
  return (
    <Router basename="/nova">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/resume-screening" element={<ResumeScreening />} />
        <Route path="/test-setup" element={<TestSetup />} />
        <Route path="/ats-result" element={<AtsResult />} />
        <Route path="/assessment" element={<Assessment />} />
        <Route path="/dashboard" element={<ResultDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
