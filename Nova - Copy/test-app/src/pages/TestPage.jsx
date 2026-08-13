import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const dummyFallbackQuestions = [
  {
    id: 1,
    question: "What does UI stand for?",
    options: ["User Interface", "User Integration", "Unified Interface", "Utility Interface"],
    answer: "User Interface"
  },
  {
    id: 2,
    question: "Which of these is a JavaScript framework?",
    options: ["Django", "Flask", "React", "Laravel"],
    answer: "React"
  },
  {
    id: 3,
    question: "What is the primary purpose of CSS?",
    options: ["Database querying", "Structuring web pages", "Styling web pages", "Server-side logic"],
    answer: "Styling web pages"
  }
];

export default function TestPage() {
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [score, setScore] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuestions = async () => {
      setIsLoading(true);
      try {
        // Replace with your actual backend webhook/API endpoint
        const API_ENDPOINT = 'https://api.agents.snsihub.ai/webhook/74d45591-6cb2-4c63-92eb-4bd3751a80e8/recruitease';
        
        // We are passing a dummy job_id here based on the workflow definition expectations
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 'Authorization': 'Bearer YOUR_TOKEN_IF_NEEDED'
          },
          body: JSON.stringify({
            data: {
              job_id: "stripe_7954688"
            }
          })
        });

        if (!response.ok) {
          throw new Error('Network response was not ok');
        }

        const data = await response.json();
        console.log('Webhook Response:', data);
        
        // Handle the webhook response format
        // The webhook might return { success: true, result: [...] }
        let extractedQuestions = null;
        
        if (data && data.questions && Array.isArray(data.questions)) {
          extractedQuestions = data.questions;
        } else if (data && data.result) {
           // Maybe the questions are inside result
           if (Array.isArray(data.result)) {
             extractedQuestions = data.result;
           } else if (data.result.questions && Array.isArray(data.result.questions)) {
             extractedQuestions = data.result.questions;
           } else if (typeof data.result === 'string') {
             try {
               const parsed = JSON.parse(data.result);
               if (Array.isArray(parsed)) extractedQuestions = parsed;
               else if (parsed.questions) extractedQuestions = parsed.questions;
             } catch(e) {}
           }
        }
        
        if (extractedQuestions) {
          setQuestions(extractedQuestions);
        } else {
          // If structure is different or job_id doesn't exist, fallback to dummy
          throw new Error('Unexpected response format or empty result from webhook: ' + JSON.stringify(data));
        }
      } catch (err) {
        console.error('Failed to fetch from backend, using fallback questions.', err);
        setError(`Backend Error: ${err.message}. Using practice questions instead.`);
        setQuestions(dummyFallbackQuestions);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuestions();
  }, []);

  if (isLoading) {
    return (
      <div className="test-container">
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1rem' }}>Generating Interview Questions...</h2>
          <p>Please wait while our AI analyzes the job description.</p>
          <div className="progress-container" style={{ marginTop: '2rem' }}>
             <div className="progress-bar" style={{ width: '100%', animation: 'pulse 1.5s infinite alternate' }}></div>
          </div>
        </div>
      </div>
    );
  }

  if (questions.length === 0) return null;

  const currentQuestion = questions[currentQuestionIdx];
  const progress = ((currentQuestionIdx) / questions.length) * 100;

  const handleNext = () => {
    let newScore = score;
    // Basic checking: some APIs might return 'correct_answer' instead of 'answer'
    const correctAns = currentQuestion.answer || currentQuestion.correct_answer;
    if (selectedOption === correctAns) {
      newScore += 1;
    }
    setScore(newScore);

    if (currentQuestionIdx < questions.length - 1) {
      setCurrentQuestionIdx(currentQuestionIdx + 1);
      setSelectedOption(null);
    } else {
      navigate('/result', { state: { score: newScore, total: questions.length } });
    }
  };

  return (
    <div className="test-container">
      <div className="glass-panel">
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5', padding: '0.75rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}
        
        <div className="progress-container">
          <div className="progress-bar" style={{ width: `${progress}%` }}></div>
        </div>
        
        <p style={{ textAlign: 'left', marginBottom: '0.5rem', fontWeight: 600 }}>
          Question {currentQuestionIdx + 1} of {questions.length}
        </p>
        <h2 style={{ textAlign: 'left', marginBottom: '2rem' }}>{currentQuestion.question}</h2>
        
        <div>
          {currentQuestion.options && currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              className={`option-btn ${selectedOption === option ? 'selected' : ''}`}
              onClick={() => setSelectedOption(option)}
            >
              {option}
            </button>
          ))}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2rem' }}>
          <button 
            className="btn" 
            style={{ width: 'auto' }} 
            onClick={handleNext}
            disabled={!selectedOption}
          >
            {currentQuestionIdx === questions.length - 1 ? 'Finish Test' : 'Next Question'}
          </button>
        </div>
      </div>
    </div>
  );
}
