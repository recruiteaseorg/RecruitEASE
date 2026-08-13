import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { jsonrepair } from 'jsonrepair';

const API_ENDPOINT = 'https://api.agents.snsihub.ai/webhook/74d45591-6cb2-4c63-92eb-4bd3751a80e8/recruitease';
const MISTRAL_API_KEY = 'DUSbM5kkmYdeT5WiKeY4YOjNC9h9LxjO';

export default function Assessment() {
  const location = useLocation();
  const navigate = useNavigate();
  const [assessmentData, setAssessmentData] = useState(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [debugData, setDebugData] = useState(null);
  
  // Proctoring State
  const [violations, setViolations] = useState([]);
  const [showWarning, setShowWarning] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const lastViolationTime = useRef({});
  const [isProctoringActive, setIsProctoringActive] = useState(false);
  const [stream, setStream] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // Advanced Proctoring State
  const [cocoModel, setCocoModel] = useState(null);
  const [modelLoading, setModelLoading] = useState(false);
  const [spokenTranscripts, setSpokenTranscripts] = useState([]);
  const recognitionRef = useRef(null);
  const hasEnteredFullscreen = useRef(false);
  const earphonesDetectedOnce = useRef(false);
  
  // Verification oral question state
  const [verificationQuestion, setVerificationQuestion] = useState(null);
  const [verificationAnswer, setVerificationAnswer] = useState('');
  const [isGeneratingVerification, setIsGeneratingVerification] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  
  const domain = location.state?.domain || localStorage.getItem('last_test_domain');
  const job_id = location.state?.job_id || localStorage.getItem('last_test_job_id');
  const isPractice = location.state?.isPractice !== undefined 
    ? location.state.isPractice 
    : localStorage.getItem('last_test_isPractice') === 'true';

  useEffect(() => {
    if (location.state?.domain) {
      localStorage.setItem('last_test_domain', location.state.domain);
    }
    if (location.state?.job_id) {
      localStorage.setItem('last_test_job_id', location.state.job_id);
    }
    if (location.state?.isPractice !== undefined) {
      localStorage.setItem('last_test_isPractice', location.state.isPractice ? 'true' : 'false');
    }
  }, [location.state]);

  // Check for page reloads during the test
  useEffect(() => {
    const inProgress = localStorage.getItem('nova_test_in_progress');
    if (inProgress === 'true') {
      localStorage.removeItem('nova_test_in_progress');
      handleFail('Test terminated: Page was refreshed during the active assessment.');
    }
  }, []);

  if (!domain || !job_id) {
    return <Navigate to="/" replace />;
  }

  // Initialize Assessment
  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const payload = {
          action: "generate_test",
          external_job_id: job_id,
          domain: domain
        };

        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Backend Error 404: Webhook not found. Please make sure your workflow is Published/Active in AgentBuilder.');
          }
          throw new Error(`Network response was not ok (Status: ${response.status})`);
        }

        const rawData = await response.json();
        console.log("Raw Webhook Data:", rawData);
        setDebugData(rawData); 
        
        let parsedData = null;

        try {
          let itemsList = [];
          if (Array.isArray(rawData)) {
            itemsList = rawData;
          } else if (rawData && Array.isArray(rawData.items)) {
            itemsList = rawData.items;
          } else {
            itemsList = [rawData];
          }

          let allQuestions = [];
          let totalQuestionsCount = 10;
          let testDuration = 15;

          itemsList.forEach(item => {
            let responseSource = item;
            if (item && item.json) {
              if (item.json._responseData) {
                responseSource = item.json._responseData;
              } else {
                responseSource = item.json;
              }
            }

            let itemParsed = null;
            if (responseSource && Array.isArray(responseSource.questions)) {
              itemParsed = responseSource;
            } else if (responseSource && typeof responseSource.response === 'object' && Array.isArray(responseSource.response.questions)) {
              itemParsed = responseSource.response;
            } else if (responseSource && typeof responseSource.response === 'string') {
              let cleanStr = responseSource.response.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              cleanStr = jsonrepair(cleanStr);
              itemParsed = JSON.parse(cleanStr);
            } else if (responseSource && typeof responseSource.result === 'string') {
              let cleanStr = responseSource.result.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              cleanStr = jsonrepair(cleanStr);
              itemParsed = JSON.parse(cleanStr);
            } else if (responseSource && typeof responseSource.result === 'object' && Array.isArray(responseSource.result.questions)) {
              itemParsed = responseSource.result;
            } else if (responseSource && typeof responseSource.result === 'object' && Array.isArray(responseSource.result.questions)) {
              itemParsed = responseSource.result;
            } else if (responseSource && typeof responseSource.data === 'object' && Array.isArray(responseSource.data.questions)) {
              itemParsed = responseSource.data;
            } else if (responseSource && Array.isArray(responseSource.data)) {
              itemParsed = {
                total_questions: responseSource.data.length,
                duration: 15,
                questions: responseSource.data
              };
            } else if (responseSource && typeof responseSource.data === 'string') {
              let cleanStr = responseSource.data.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              cleanStr = jsonrepair(cleanStr);
              itemParsed = JSON.parse(cleanStr);
              if (Array.isArray(itemParsed)) {
                itemParsed = { total_questions: itemParsed.length, duration: 15, questions: itemParsed };
              }
            }

            if (itemParsed && Array.isArray(itemParsed.questions)) {
              allQuestions = allQuestions.concat(itemParsed.questions);
              if (itemParsed.total_questions) totalQuestionsCount = itemParsed.total_questions;
              if (itemParsed.duration) testDuration = itemParsed.duration;
            }
          });

          parsedData = {
            total_questions: allQuestions.length || totalQuestionsCount,
            duration: testDuration,
            questions: allQuestions
          };
          console.log("Parsed Assessment Data:", parsedData);
          
          if (parsedData && Array.isArray(parsedData.questions)) {
            parsedData.questions = parsedData.questions.filter(q => 
              q && 
              typeof q.question === 'string' && 
              q.question.trim() !== '' && 
              q.options && 
              typeof q.options === 'object' && 
              !Array.isArray(q.options) &&
              typeof q.options.A === 'string' && q.options.A.trim() !== '' &&
              typeof q.options.B === 'string' && q.options.B.trim() !== '' &&
              typeof q.options.C === 'string' && q.options.C.trim() !== '' &&
              typeof q.options.D === 'string' && q.options.D.trim() !== '' &&
              typeof q.correct_answer === 'string' && 
              ['A', 'B', 'C', 'D'].includes(q.correct_answer.trim().toUpperCase())
            );
            parsedData.total_questions = parsedData.questions.length;
          }

        } catch (e) {
          console.error("Failed to parse test JSON string:", e);
        }

        if (!parsedData || 
            !Array.isArray(parsedData.questions) || 
            parsedData.questions.length === 0 ||
            typeof parsedData.duration !== 'number' ||
            typeof parsedData.total_questions !== 'number'
        ) {
           throw new Error('The AI failed to generate valid questions.');
         }

        setAssessmentData(parsedData);
        setTimeLeft(parsedData.duration * 60);
      } catch (err) {
        setError(err.message || 'Failed to generate assessment.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchAssessment();
  }, [domain, job_id]);

  // AI Proctoring Telemetry Tracker (Text based)
  useEffect(() => {
    if (!isProctoringActive || isLoading || error) return;

    const handleVisibilityChange = () => {
      if (document.hidden) logViolation('TAB_SWITCH', 'Candidate switched to another tab.');
    };
    const handleBlur = () => {
      logViolation('WINDOW_BLUR', 'Candidate clicked outside window.');
    };
    const handleCopy = (e) => {
      e.preventDefault();
      logViolation('COPY_ATTEMPT', 'Candidate attempted to copy.');
    };
    const handlePaste = (e) => {
      e.preventDefault();
      logViolation('PASTE_ATTEMPT', 'Candidate attempted to paste.');
    };
    const handleFullscreenChange = () => {
      if (hasEnteredFullscreen.current && !document.fullscreenElement) {
        handleFail('Fullscreen exited (Escape key pressed or window minimized).');
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleFail('Fullscreen exited (Escape key pressed).');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProctoringActive, isLoading, error, violations]);

  const logViolation = async (type, details) => {
    const nowTime = Date.now();
    if (lastViolationTime.current[type] && (nowTime - lastViolationTime.current[type] < 2500)) {
      return;
    }
    lastViolationTime.current[type] = nowTime;

    const violation = { type, details, timestamp: new Date().toISOString() };
    setViolations(prev => [...prev, violation]);

    setWarningCount(prev => {
      const nextCount = prev + 1;
      if (nextCount >= 3) {
        setTimeout(() => {
          handleFail('Proctoring violation limit of 3 warnings exceeded.');
        }, 1500);
      }
      return nextCount;
    });

    setShowWarning(true);
    setTimeout(() => setShowWarning(false), 3000);

    if (MISTRAL_API_KEY) {
      try {
        const prompt = `Analyze this candidate behavior. Action Type: ${type}. Details: ${details}. Format: {"severity": "Low" | "Medium" | "High", "reason": "short explanation"}`;
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
          body: JSON.stringify({
            model: "mistral-small-latest",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          })
        });
        if (response.ok) {
          const data = await response.json();
          const aiAnalysis = JSON.parse(data.choices[0].message.content);
          if (aiAnalysis.severity === 'High') {
            console.warn(`Critical Telemetry Violation: ${aiAnalysis.reason}`);
          }
        }
      } catch (err) { console.error('Failed Mistral text telemetry', err); }
    }
  };

  // Load TensorFlow.js & COCO-SSD from CDN
  useEffect(() => {
    if (!isProctoringActive) return;

    const loadScripts = async () => {
      setModelLoading(true);
      try {
        if (!window.tf) {
          const tfScript = document.createElement('script');
          tfScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs';
          tfScript.async = true;
          document.body.appendChild(tfScript);
          await new Promise(resolve => tfScript.onload = resolve);
        }
        if (!window.cocoSsd) {
          const cocoScript = document.createElement('script');
          cocoScript.src = 'https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd';
          cocoScript.async = true;
          document.body.appendChild(cocoScript);
          await new Promise(resolve => cocoScript.onload = resolve);
        }
        const model = await window.cocoSsd.load();
        setCocoModel(model);
        console.log("Local Object Detection Model Ready.");
      } catch (err) {
        console.error("Failed to initialize client-side TF/COCO model:", err);
      } finally {
        setModelLoading(false);
      }
    };
    loadScripts();
  }, [isProctoringActive]);

  // Local object detection loop (runs every 3 seconds)
  useEffect(() => {
    if (!isProctoringActive || !cocoModel || !stream) return;

    const detectFrame = async () => {
      // Check for plugged-in or bluetooth headphones/earphones
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const headphone = devices.find(device => 
          device.label.toLowerCase().includes('headphone') || 
          device.label.toLowerCase().includes('earphone') || 
          device.label.toLowerCase().includes('headset') ||
          device.label.toLowerCase().includes('earbuds') ||
          device.label.toLowerCase().includes('hands-free')
        );
        if (headphone) {
          if (!earphonesDetectedOnce.current) {
            logViolation('EARPHONES_DETECTED', `Connected audio device detected: ${headphone.label}`);
            earphonesDetectedOnce.current = true;
          }
        } else {
          earphonesDetectedOnce.current = false;
        }
      } catch (err) {
        console.error("Audio device detection failed:", err);
      }

      if (videoRef.current && videoRef.current.readyState >= 2) {
        try {
          const predictions = await cocoModel.detect(videoRef.current);
          console.log("COCO-SSD Live Detections:", predictions);
          let peopleCount = 0;
          let phoneDetected = false;
          let bookDetected = false;

          predictions.forEach(prediction => {
            if (prediction.class === 'person' && prediction.score > 0.6) {
              peopleCount++;
            }
            if (prediction.class === 'cell phone' && prediction.score > 0.3) {
              phoneDetected = true;
            }
            if (prediction.class === 'book' && prediction.score > 0.4) {
              bookDetected = true;
            }
          });

          if (peopleCount > 1) {
            logViolation('MULTIPLE_PEOPLE', `Detected ${peopleCount} people in webcam stream.`);
          }
          if (phoneDetected) {
            logViolation('PHONE_DETECTED', 'Detected candidate looking at or holding a cell phone.');
          }
          if (bookDetected) {
            logViolation('BOOK_DETECTED', 'Detected candidate looking at a book, notebook, or paper.');
          }
        } catch (e) {
          console.error("Local COCO-SSD inference failed:", e);
        }
      }
    };

    const intervalId = setInterval(detectFrame, 3000);
    return () => clearInterval(intervalId);
  }, [isProctoringActive, cocoModel, stream]);

  // Audio Speech Transcription listener (Web Speech API)
  useEffect(() => {
    if (!isProctoringActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onresult = (event) => {
        const resultIndex = event.resultIndex;
        const transcript = event.results[resultIndex][0].transcript.trim();
        if (transcript) {
          const timestamp = new Date().toISOString();
          setSpokenTranscripts(prev => [...prev, { text: transcript, timestamp }]);
          logViolation('SPEECH_DETECTED', `Spoken speech detected: "${transcript}"`);
        }
      };

      rec.onerror = (e) => {
        console.error("Speech Recognition error:", e);
      };

      rec.onend = () => {
        if (isProctoringActive) {
          try { rec.start(); } catch (err) { console.error("Speech restart failed:", err); }
        }
      };

      try {
        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.error("Failed to start Speech Recognition:", err);
      }
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [isProctoringActive]);

  // Attach webcam stream to video element when active
  useEffect(() => {
    if (isProctoringActive && stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [isProctoringActive, stream]);

  // Pixtral Vision Capture Loop
  useEffect(() => {
    if (!isProctoringActive || !stream) return;

    const interval = setInterval(async () => {
      if (videoRef.current && canvasRef.current) {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Pixtral requires standard base64 string
        const base64Data = canvas.toDataURL('image/jpeg', 0.5);
        
        try {
          const prompt = `Analyze this webcam frame from a candidate taking an online test.
          Detect the following violations:
          1. phone_detected: Is the person holding or looking at a smartphone?
          2. looking_away: Is the person clearly looking entirely away from the screen for a prolonged time?
          3. multiple_people: Is there more than one person in the frame?
          4. camera_blocked: Is the camera physically covered, completely dark, obscured, or pointed at the ceiling/wall with no person visible?
          
          Respond with a strict JSON object: {"phone_detected": boolean, "looking_away": boolean, "multiple_people": boolean, "camera_blocked": boolean, "reason": "short explanation"}`;

          const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${MISTRAL_API_KEY}` },
            body: JSON.stringify({
              model: "pixtral-12b-2409",
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: base64Data }
                  ]
                }
              ],
              response_format: { type: "json_object" }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const aiAnalysis = JSON.parse(data.choices[0].message.content);
            console.log("Pixtral Vision Analysis:", aiAnalysis);
            
            if (aiAnalysis.phone_detected || aiAnalysis.multiple_people || aiAnalysis.camera_blocked) {
              console.warn(`Critical Vision Violation Detected: ${aiAnalysis.reason}`);
              // handleFail(`Critical Vision Violation Detected: ${aiAnalysis.reason}`);
            }
          }
        } catch (err) {
          console.error("Pixtral vision fetch failed", err);
        }
      }
    }, 15000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [isProctoringActive, stream]);

  // Assessment Timer
  useEffect(() => {
    if (!isProctoringActive || timeLeft === null || timeLeft <= 0) return;
    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerId);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, isProctoringActive]);

  const startProctoring = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      await document.documentElement.requestFullscreen();
      setTimeout(() => {
        hasEnteredFullscreen.current = true;
      }, 1000);
      localStorage.setItem('nova_test_in_progress', 'true');
      setIsProctoringActive(true);
    } catch (err) {
      alert("You must grant camera and microphone permissions and allow fullscreen to start the assessment.");
      console.error(err);
    }
  };

  function handleFail(reason) {
    hasEnteredFullscreen.current = false;
    localStorage.removeItem('nova_test_in_progress');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    const candidateAnswers = [];
    const timeTaken = (assessmentData.duration || 10) * 60 - timeLeft;
    
    // Post to workbench
    try {
      fetch(API_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_test',
          external_job_id: job_id,
          domain: domain,
          questions_generated: JSON.stringify(assessmentData),
          user_answers: JSON.stringify(candidateAnswers),
          guardrails_check: reason,
          evaluation: "Failed due to violations - Score: 0%"
        })
      });
    } catch(e) { console.error(e); }

    navigate('/dashboard', { 
      state: { 
        assessmentData: assessmentData, 
        candidateAnswers: candidateAnswers,
        timeTaken: timeTaken,
        terminatedReason: reason,
        violations: violations
      },
      replace: true 
    });
  };

  const backendBaseUrl = window.location.origin.includes('localhost:3000') ? 'http://localhost:8000' : window.location.origin;

  const handleSubmit = async () => {
    // If the candidate has 3+ violations or a phone violation, and hasn't done the verification
    const needsVerification = violations.length >= 3 || violations.some(v => v.type === 'PHONE_DETECTED');
    if (needsVerification && !verificationQuestion) {
      setIsGeneratingVerification(true);
      setShowVerificationModal(true);
      try {
        const res = await fetch(backendBaseUrl + '/api/proctor/verify-question', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jobId: job_id,
            answers: Object.keys(answers).map(qId => answers[qId])
          })
        });
        if (res.ok) {
          const data = await res.json();
          setVerificationQuestion(data.question);
        }
      } catch (err) {
        console.error("Verification question error", err);
      } finally {
        setIsGeneratingVerification(false);
      }
      return; // Stop submission until answered
    }

    hasEnteredFullscreen.current = false;
    localStorage.removeItem('nova_test_in_progress');
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => console.log(err));
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }

    const candidateAnswers = Object.keys(answers).map(qId => ({
      question_id: parseInt(qId),
      selected_answer: answers[qId]
    }));

    const timeTaken = (assessmentData.duration || 10) * 60 - timeLeft;
    const candidateEmail = isPractice ? null : localStorage.getItem('candidateEmail');

    let proctoringResult = null;
    try {
      const res = await fetch(backendBaseUrl + '/api/interview/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jobId: job_id,
          questions: assessmentData.questions.map(q => q.question),
          answers: candidateAnswers.map(a => a.selected_answer),
          violations: violations,
          spokenTranscripts: spokenTranscripts,
          candidateEmail: candidateEmail
        })
      });
      if (res.ok) {
        const json = await res.json();
        if (json.evaluation && json.evaluation.proctoring) {
          proctoringResult = json.evaluation.proctoring;
        }
      }
    } catch (e) {
      console.error("Local submit failed", e);
    }

    // Submit to workbench
    if (!isPractice) {
      try {
        fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'submit_test',
            external_job_id: job_id,
            domain: domain,
            questions_generated: JSON.stringify(assessmentData),
            user_answers: JSON.stringify(candidateAnswers),
            guardrails_check: "Passed",
            evaluation: "Submitted"
          })
        });
      } catch(e) { console.error(e); }
    }

    navigate('/dashboard', { 
      state: { 
        assessmentData: assessmentData, 
        candidateAnswers: candidateAnswers,
        timeTaken: timeTaken,
        violations: violations,
        proctoringResult: proctoringResult
      },
      replace: true 
    });
  };

  const handleOptionSelect = (optionKey) => {
    const qId = assessmentData.questions[currentIdx].question_id;
    setAnswers({ ...answers, [qId]: optionKey });
  };

  if (isLoading) {
    return (
      <div className="panel max-w-lg" style={{ textAlign: 'center' }}>
        <h2>Generating Assessment...</h2>
        <p>Please wait while we prepare your specific questions.</p>
      </div>
    );
  }

  if (error) {
    let readableText = "No raw data available.";
    if (debugData) {
      if (typeof debugData === 'object' && (debugData.response || debugData.result)) {
         const extracted = debugData.response || debugData.result;
         readableText = typeof extracted === 'string' ? extracted : JSON.stringify(extracted, null, 2);
      } else {
         readableText = JSON.stringify(debugData, null, 2);
      }
    }

    return (
      <div className="panel max-w-lg">
        <div className="badge danger" style={{display: 'block', marginBottom: '1rem'}}>{error}</div>
        {debugData && (
          <div style={{ marginTop: '1rem', padding: '1rem', background: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'left' }}>
            <h4 style={{marginBottom: '0.5rem', color: 'var(--text-secondary)'}}>AI Raw Output (Readable):</h4>
            <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', maxHeight: '400px', overflowY: 'auto' }}>
              {readableText}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (!assessmentData || !assessmentData.questions) return null;

  if (!isProctoringActive) {
    return (
      <div className="panel max-w-lg" style={{ textAlign: 'center' }}>
        <h2>Assessment Ready</h2>
        <p>This is a proctored assessment. By continuing, you agree to:</p>
        <ul style={{ textAlign: 'left', marginBottom: '2rem', marginTop: '1rem', color: 'var(--text-secondary)' }}>
          <li>Keep the browser in Fullscreen mode.</li>
          <li>Keep your Webcam enabled and face visible.</li>
          <li>Do not use phones or secondary devices.</li>
          <li>Do not switch tabs or copy/paste.</li>
        </ul>
        {modelLoading ? (
          <button className="btn btn-success" disabled>Initializing Proctoring...</button>
        ) : (
          <button className="btn btn-success" onClick={startProctoring}>Grant Permissions & Start Test</button>
        )}
      </div>
    );
  }

  const currentQuestion = assessmentData.questions[currentIdx];
  const qId = currentQuestion.question_id;
  
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="panel max-w-xl" style={{ position: 'relative' }}>
      {showVerificationModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.85)', zIndex: 10000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="panel max-w-md" style={{ background: 'var(--bg-color)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '2rem' }}>
            <h3 style={{ color: 'var(--danger-color)', marginBottom: '1rem' }}>Identity Verification Required</h3>
            <p style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)' }}>
              Due to multiple proctoring flags, please answer this dynamic question to confirm your test integrity:
            </p>
            {isGeneratingVerification ? (
              <div style={{ textAlign: 'center', margin: '2rem 0' }}>
                <p>Generating verification question...</p>
              </div>
            ) : (
              <>
                <p style={{ fontWeight: 'bold', marginBottom: '1rem', padding: '1rem', background: 'var(--surface-color)', borderRadius: '8px' }}>
                  {verificationQuestion || "Briefly explain the design pattern or main architectural approach you used in your answers."}
                </p>
                <textarea
                  style={{ width: '100%', minHeight: '120px', padding: '0.8rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-color)', color: 'var(--text-primary)', marginBottom: '1.5rem' }}
                  placeholder="Type your explanation here..."
                  value={verificationAnswer}
                  onChange={(e) => setVerificationAnswer(e.target.value)}
                />
                <button 
                  className="btn btn-success" 
                  disabled={!verificationAnswer.trim()}
                  onClick={() => {
                    logViolation('ORAL_VERIFICATION', `Answer: "${verificationAnswer}"`);
                    setShowVerificationModal(false);
                    setTimeout(() => handleSubmit(), 200);
                  }}
                >
                  Verify & Submit
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showWarning && (
        <div style={{
          position: 'absolute', top: '-60px', left: '50%', transform: 'translateX(-50%)',
          background: 'var(--danger-color)', color: 'white', padding: '0.8rem 1.5rem',
          borderRadius: '8px', fontWeight: 'bold', boxShadow: '0 4px 12px rgba(255, 0, 0, 0.3)',
          zIndex: 1000, animation: 'fadeInOut 3s forwards'
        }}>
          ⚠️ Warning: Suspicious activity detected. (Warning {warningCount} of 3)
        </div>
      )}
      
      {/* Live Webcam Feed Corner UI */}
      <div style={{ position: 'absolute', top: '10px', right: '10px', width: '120px', borderRadius: '8px', overflow: 'hidden', border: '2px solid var(--border-color)' }}>
        <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', display: 'block' }} />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <div style={{ position: 'absolute', bottom: '0', background: 'rgba(0,0,0,0.6)', width: '100%', textAlign: 'center', fontSize: '0.7rem', padding: '2px 0' }}>Proctoring Active</div>
      </div>

      <div className="assessment-header" style={{ marginRight: '140px' }}>
        <div>
          <h3>Question {currentIdx + 1} of {assessmentData.total_questions}</h3>
          <span className="badge">{currentQuestion.section}</span>
          {currentQuestion.difficulty && <span className="badge">{currentQuestion.difficulty}</span>}
        </div>
        <div className={`timer ${timeLeft < 60 ? 'warning' : ''}`}>
          {formatTime(timeLeft)}
        </div>
      </div>

      <div className="progress-track" style={{ marginBottom: '2rem' }}>
        <div className="progress-fill" style={{ width: `${((currentIdx + 1) / assessmentData.total_questions) * 100}%` }}></div>
      </div>

      <h2 style={{ marginBottom: '2rem' }}>{currentQuestion.question}</h2>

      <div style={{ marginBottom: '2rem' }}>
        {Object.entries(currentQuestion.options).map(([key, value]) => (
          <button
            key={key}
            className={`option-btn ${answers[qId] === key ? 'selected' : ''}`}
            onClick={() => handleOptionSelect(key)}
          >
            <strong>{key}.</strong> {value}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button 
          className="btn btn-secondary" 
          disabled={currentIdx === 0}
          onClick={() => setCurrentIdx(currentIdx - 1)}
        >
          Previous
        </button>

        {currentIdx < assessmentData.total_questions - 1 ? (
          <button className="btn" onClick={() => setCurrentIdx(currentIdx + 1)}>Next</button>
        ) : (
          <button className="btn btn-success" onClick={handleSubmit}>Submit Assessment</button>
        )}
      </div>
    </div>
  );
}
