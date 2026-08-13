const questions = [
  {
    id: 1,
    category: "Teamwork",
    question: "A teammate disagrees with your approach to a project. What would you do?",
    answers: [
      { key: "A", text: "Explain your reasoning and listen to their perspective before deciding together." },
      { key: "B", text: "Ask the team to discuss both approaches and choose the most suitable one." },
      { key: "C", text: "Follow your original approach because you believe it is better." },
      { key: "D", text: "Let the teammate handle the task their way." }
    ]
  },
  {
    id: 2,
    category: "Handling Mistakes",
    question: "You discover a mistake in your work that may affect the team's deadline. What would you do?",
    answers: [
      { key: "A", text: "Inform the relevant team member and work on fixing it immediately." },
      { key: "B", text: "Try to fix the issue yourself before informing anyone." },
      { key: "C", text: "Inform your manager and explain the situation clearly." },
      { key: "D", text: "Ask a teammate for help in resolving it." }
    ]
  },
  {
    id: 3,
    category: "Feedback",
    question: "Your manager gives you feedback that you do not agree with. How would you respond?",
    answers: [
      { key: "A", text: "Ask for specific examples so you can better understand the feedback." },
      { key: "B", text: "Explain your perspective respectfully and discuss possible improvements." },
      { key: "C", text: "Accept the feedback and consider how you can apply it." },
      { key: "D", text: "Discuss the feedback with a colleague before deciding how to respond." }
    ]
  },
  {
    id: 4,
    category: "Changing Priorities",
    question: "Your priorities suddenly change because of an urgent project. What would you do?",
    answers: [
      { key: "A", text: "Reorganize your tasks based on the new priorities." },
      { key: "B", text: "Ask your manager which existing tasks should be delayed." },
      { key: "C", text: "Complete the urgent task first and then return to the original work." },
      { key: "D", text: "Discuss the new expectations with your team and adjust accordingly." }
    ]
  },
  {
    id: 5,
    category: "Workplace Conflict",
    question: "Two teammates are having a disagreement that is affecting the project. What would you do?",
    answers: [
      { key: "A", text: "Encourage both people to discuss the issue calmly." },
      { key: "B", text: "Focus the discussion on the project requirements rather than personal differences." },
      { key: "C", text: "Ask the manager to intervene if the disagreement cannot be resolved." },
      { key: "D", text: "Offer to help both teammates find a practical solution." }
    ]
  },
  {
    id: 6,
    category: "Taking Initiative",
    question: "You notice an inefficient process that is slowing your team down. What would you do?",
    answers: [
      { key: "A", text: "Suggest an improvement to your team." },
      { key: "B", text: "Test a possible improvement and share the results." },
      { key: "C", text: "Discuss the issue with your manager before making changes." },
      { key: "D", text: "Ask teammates for their ideas before proposing a solution." }
    ]
  },
  {
    id: 7,
    category: "Ethical Situation",
    question: "You notice that a colleague has accidentally entered incorrect information into an important report. What would you do?",
    answers: [
      { key: "A", text: "Inform the colleague privately so they can correct it." },
      { key: "B", text: "Raise the issue with the appropriate person if it could significantly affect the report." },
      { key: "C", text: "Help the colleague verify and correct the information." },
      { key: "D", text: "Discuss the issue with the team to determine the best way to resolve it." }
    ]
  },
  {
    id: 8,
    category: "Leadership",
    question: "Your team is struggling to meet an important deadline. What would you do?",
    answers: [
      { key: "A", text: "Help divide the remaining work based on team members' availability and skills." },
      { key: "B", text: "Take responsibility for completing some of the urgent tasks yourself." },
      { key: "C", text: "Identify the main blockers and help the team address them." },
      { key: "D", text: "Coordinate with the team and communicate progress to the relevant stakeholders." }
    ]
  },
  {
    id: 9,
    category: "Communication",
    question: "You receive unclear instructions for an important task. What would you do?",
    answers: [
      { key: "A", text: "Ask clarifying questions before starting." },
      { key: "B", text: "Confirm your understanding with the person who gave the instructions." },
      { key: "C", text: "Start with what you understand and clarify the uncertain parts." },
      { key: "D", text: "Ask a teammate for their interpretation before proceeding." }
    ]
  },
  {
    id: 10,
    category: "Problem-Solving",
    question: "You encounter an unexpected problem shortly before a deadline. What would you do?",
    answers: [
      { key: "A", text: "Identify the cause and evaluate possible solutions." },
      { key: "B", text: "Prioritize the solution that minimizes the impact on the deadline." },
      { key: "C", text: "Ask relevant teammates for input before deciding." },
      { key: "D", text: "Inform the appropriate stakeholder and propose a practical solution." }
    ]
  }
];

let currentQuestionIndex = 0;
let userAnswers = {};
let userName = "Candidate";

// DOM Elements
const welcomeView = document.getElementById("welcome-view");
const quizView = document.getElementById("quiz-view");
const loadingView = document.getElementById("loading-view");
const resultsView = document.getElementById("results-view");

const userNameInput = document.getElementById("user-name");
const startBtn = document.getElementById("start-btn");
const nextBtn = document.getElementById("next-btn");
const restartBtn = document.getElementById("restart-btn");

const progress = document.getElementById("progress");
const questionCategory = document.getElementById("question-category");
const questionNumber = document.getElementById("question-number");
const questionText = document.getElementById("question-text");
const optionsContainer = document.getElementById("options-container");

const resultTitle = document.getElementById("result-title");
const scoreTeamwork = document.getElementById("score-teamwork");
const scoreProblemSolving = document.getElementById("score-problemsolving");
const scoreCommunication = document.getElementById("score-communication");
const scoreLeadership = document.getElementById("score-leadership");

const barTeamwork = document.getElementById("bar-teamwork");
const barProblemSolving = document.getElementById("bar-problemsolving");
const barCommunication = document.getElementById("bar-communication");
const barLeadership = document.getElementById("bar-leadership");

const aiNarrative = document.getElementById("ai-narrative");

let currentQuestionIndex = 0;
let userAnswers = {};
let userName = "Candidate";
let targetRole = "";
let targetCompany = "";

// Event Listeners
startBtn.addEventListener("click", startQuiz);
nextBtn.addEventListener("click", nextQuestion);
restartBtn.addEventListener("click", restartQuiz);

const DEFAULT_API_KEY = "AQ.Ab8RN6LFAhvXowf088WHmRqCFQi91GCFaInAMYdGLU6yTRy4-g";

function startQuiz() {
  userName = userNameInput.value.trim() || "Candidate";
  const roleInput = document.getElementById("target-role");
  const compInput = document.getElementById("target-company");
  if (roleInput) targetRole = roleInput.value.trim();
  if (compInput) targetCompany = compInput.value.trim();

  welcomeView.classList.add("hidden");
  quizView.classList.remove("hidden");
  currentQuestionIndex = 0;
  userAnswers = {};
  showQuestion();
}


function showQuestion() {
  const q = questions[currentQuestionIndex];
  
  // Progress Bar
  const percent = ((currentQuestionIndex) / questions.length) * 100;
  progress.style.width = `${percent}%`;
  
  questionCategory.innerText = q.category;
  questionNumber.innerText = `Question ${currentQuestionIndex + 1} of ${questions.length}`;
  questionText.innerText = q.question;
  
  // Populate options
  optionsContainer.innerHTML = "";
  q.answers.forEach(ans => {
    const card = document.createElement("div");
    card.className = "option-card";
    if (userAnswers[q.id] === ans.key) {
      card.classList.add("selected");
    }
    
    card.innerHTML = `
      <div class="option-letter">${ans.key}</div>
      <div class="option-text">${ans.text}</div>
    `;
    
    card.addEventListener("click", () => {
      // Remove selection from others
      document.querySelectorAll(".option-card").forEach(el => el.classList.remove("selected"));
      card.classList.add("selected");
      userAnswers[q.id] = ans.key;
      nextBtn.removeAttribute("disabled");
      nextBtn.style.opacity = "1";
      nextBtn.style.cursor = "pointer";
    });
    
    optionsContainer.appendChild(card);
  });
  
  // Reset next button state
  if (!userAnswers[q.id]) {
    nextBtn.setAttribute("disabled", "true");
    nextBtn.style.opacity = "0.5";
    nextBtn.style.cursor = "not-allowed";
  } else {
    nextBtn.removeAttribute("disabled");
    nextBtn.style.opacity = "1";
    nextBtn.style.cursor = "pointer";
  }
}

function nextQuestion() {
  if (currentQuestionIndex < questions.length - 1) {
    currentQuestionIndex++;
    showQuestion();
  } else {
    // End of quiz, run evaluation
    progress.style.width = "100%";
    evaluateAssessment();
  }
}

function restartQuiz() {
  resultsView.classList.add("hidden");
  welcomeView.classList.remove("hidden");
}

async function evaluateAssessment() {
  quizView.classList.add("hidden");
  loadingView.classList.remove("hidden");
  
  const apiKey = DEFAULT_API_KEY;
  
  // Compile candidate answers with full context
  const responsesText = questions.map(q => {
    const selectedKey = userAnswers[q.id];
    const selectedAns = q.answers.find(a => a.key === selectedKey);
    return `Scenario: "${q.question}"\nSelected Option: ${selectedKey}. "${selectedAns ? selectedAns.text : ''}"`;
  }).join("\n\n");

  const prompt = `You are an expert HR organizational psychologist. Evaluate the following assessment answers for the candidate "${userName}".
Their target role is "${targetRole || 'Professional'}" at the company "${targetCompany || 'the organization'}". 
Analyze their behavioral responses across four key categories: Collaboration (Teamwork), Problem Solving, Communication, and Leadership, taking their target role into consideration.
For each category, determine a score from 0 to 100.
Also, write a premium, detailed evaluation narrative with developmental advice, structured in clean HTML (using tags like <h3>, <p>, <ul>, <li>).

Respond ONLY with a valid, clean JSON object matching this schema. Do not enclose it in markdown blocks or write any other text.
{
  "collaboration": 85,
  "problemsolving": 90,
  "communication": 75,
  "leadership": 80,
  "narrative": "<h3>Key Strengths</h3><p>...</p><h3>Developmental Areas</h3><p>...</p>"
}

Here are the candidate's answers:
${responsesText}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    
    if (!response.ok) {
      let errMsg = response.statusText;
      try {
        const errJson = await response.json();
        if (errJson && errJson.error && errJson.error.message) {
          errMsg = errJson.error.message;
        }
      } catch (e) {}
      throw new Error(`API error: ${errMsg}`);
    }
    
    const data = await response.json();
    const resultJson = JSON.parse(data.candidates[0].content.parts[0].text);
    
    // Display results
    loadingView.classList.add("hidden");
    resultsView.classList.remove("hidden");
    
    resultTitle.innerText = `${userName}'s Assessment Profile`;
    
    // Populate scores & animate bars
    animateScore("teamwork", resultJson.collaboration || 0);
    animateScore("problemsolving", resultJson.problemsolving || 0);
    animateScore("communication", resultJson.communication || 0);
    animateScore("leadership", resultJson.leadership || 0);
    
    aiNarrative.innerHTML = resultJson.narrative || "<p>No evaluation narrative could be generated.</p>";
    
    // Sync with backend portal so Applications table updates
    try {
      await fetch('/api/start-behavioral', { method: 'POST' });
    } catch(err) {
      console.warn('Backend sync failed:', err);
    }
    
  } catch (error) {
    console.error("Evaluation failed:", error);
    loadingView.classList.add("hidden");
    resultsView.classList.remove("hidden");
    aiNarrative.innerHTML = `<p style="color: #ef4444;">Failed to analyze results using Gemini API. Error: ${error.message}</p>
                             <p>Please check your API key or connection and try again.</p>`;
  }
}

function animateScore(id, targetVal) {
  const scoreElement = document.getElementById(`score-${id}`);
  const barElement = document.getElementById(`bar-${id}`);
  
  let currentVal = 0;
  const duration = 1200; // ms
  const stepTime = 15;
  const step = targetVal / (duration / stepTime);
  
  const timer = setInterval(() => {
    currentVal += step;
    if (currentVal >= targetVal) {
      currentVal = targetVal;
      clearInterval(timer);
    }
    scoreElement.innerText = Math.round(currentVal);
    barElement.style.width = `${currentVal}%`;
  }, stepTime);
}
