let sessionQuestions = [];
let currentIndex = 0;
let userAnswers = [];
let questionTimes = []; // Stores time spent per question in seconds
let timerInterval;
let startTime;

window.addEventListener("load", () => {
  const savedData = sessionStorage.getItem("pebc_data");
  const expiry = sessionStorage.getItem("pebc_expiry");

  if (savedData && expiry) {
    const now = Date.now();
    if (now < parseInt(expiry)) {
      // It's still fresh! Restore it.
      allQuestions = JSON.parse(savedData);

      updateAvailableCount();
    } else {
      // Session expired, clean up memory
      sessionStorage.removeItem("pebc_data");
      sessionStorage.removeItem("pebc_expiry");
    }
  }
});

// NEW: Function to show how many questions match the filters
function updateAvailableCount() {
  const topic = document.getElementById("topicFilterSetup").value;
  const comp = document.getElementById("compFilterSetup").value;

  const count = allQuestions.filter((q) => {
    const topicMatch = topic === "All" || q.topic === topic;
    const compMatch = comp === "All" || q.competency === comp;
    return topicMatch && compMatch;
  }).length;

  document.getElementById("available-text").innerText =
    `(${count} questions available in this category)`;
  document.getElementById("sessionCount").max = count;
}

function startSession() {
  const topic = document.getElementById("topicFilterSetup").value;
  const comp = document.getElementById("compFilterSetup").value;
  const shuffle = document.getElementById("shuffleToggle").checked;
  const useTimer = document.getElementById("timerToggle").checked;
  let limit = parseInt(document.getElementById("sessionCount").value);

  let filtered = allQuestions.filter((q) => {
    const topicMatch = topic === "All" || q.topic === topic;
    const compMatch = comp === "All" || q.competency === comp;
    return topicMatch && compMatch;
  });

  if (limit > filtered.length) limit = filtered.length;

  sessionQuestions = shuffle
    ? filtered.sort(() => 0.5 - Math.random()).slice(0, limit)
    : filtered.slice(0, limit);

  if (sessionQuestions.length === 0)
    return alert("No questions match your criteria.");

  userAnswers = new Array(sessionQuestions.length).fill(null);
  questionTimes = new Array(sessionQuestions.length).fill(0);

  document.getElementById("setup-view").classList.add("hidden");
  document.getElementById("quiz-view").classList.remove("hidden");

  if (useTimer) {
    document.getElementById("timer-display").classList.remove("hidden");
    startTimer();
  }

  renderQuestion();
}

window.onload = updateAvailableCount;

function startTimer() {
  clearInterval(timerInterval);
  startTime = Date.now();
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60)
      .toString()
      .padStart(2, "0");
    const secs = (elapsed % 60).toString().padStart(2, "0");
    document.getElementById("timer-display").innerText = `${mins}:${secs}`;
    // Record time to current question index
    questionTimes[currentIndex] += 1;
  }, 1000);
}

function renderQuestion() {
  const container = document.getElementById("quiz-container");
  const counter = document.getElementById("question-counter");
  const nextBtn = document.getElementById("next-btn");
  const q = sessionQuestions[currentIndex];

  counter.innerText = `${currentIndex + 1} / ${sessionQuestions.length}`;
  nextBtn.innerText =
    currentIndex === sessionQuestions.length - 1 ? "Finish" : "Next";

  let caseHtml = "";
  // If the question has a "patientCase" property, display it at the top
  if (q.patientCase) {
    caseHtml = `
                <div style="background: var(--patient-case-bg); padding: 15px; border-radius: 8px; border-left: 5px solid #3498db; margin-bottom: 20px; font-size: 14px;">
                    <strong style="color: #2c3e50;">PATIENT CASE:</strong><br>
                    ${q.patientCase.replace(/\n/g, "<br>")}
                </div>
            `;
  }

  let optionsHtml = q.options
    .map(
      (opt, i) => `
            <div class="option ${userAnswers[currentIndex] === i ? "selected" : ""}" 
                 onclick="selectOption(${i})" id="opt-${i}">
                ${opt.text}
            </div>
        `,
    )
    .join("");

  container.innerHTML = `
            <div class="question-box">
                ${caseHtml}
                <small style="color:#3498db; font-weight:bold;">${q.topic} | ${q.competency}</small>
                <div class="question-text">${q.text}</div>
                ${optionsHtml}
                <button class="btn" id="check-btn" onclick="checkAnswer()">Check Answer</button>
                <div class="rationale hidden" id="rationale-box"></div>
            </div>
        `;

  if (userAnswers[currentIndex] !== null)
    revealAnswer(userAnswers[currentIndex]);

  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}

function selectOption(i) {
  if (userAnswers[currentIndex] !== null) return;
  document
    .querySelectorAll(".option")
    .forEach((el) => el.classList.remove("selected"));
  document.getElementById(`opt-${i}`).classList.add("selected");
  userAnswers[currentIndex] = i;
}

function checkAnswer() {
  if (userAnswers[currentIndex] === null)
    return alert("Please select an answer!");
  revealAnswer(userAnswers[currentIndex]);
}

function revealAnswer(userIdx) {
  const q = sessionQuestions[currentIndex];
  const rationaleBox = document.getElementById("rationale-box");
  const checkBtn = document.getElementById("check-btn");

  q.options.forEach((opt, idx) => {
    const el = document.getElementById(`opt-${idx}`);
    if (opt.correct) el.classList.add("correct");
    if (idx === userIdx && !opt.correct) el.classList.add("incorrect");
  });

  const correctOpt = q.options.find((o) => o.correct);
  rationaleBox.innerHTML = `<strong>Rationale:</strong> ${correctOpt.rationale}`;
  rationaleBox.classList.remove("hidden");
  if (checkBtn) checkBtn.classList.add("hidden");

  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}

function nextQuestion() {
  if (currentIndex < sessionQuestions.length - 1) {
    currentIndex++;
    renderQuestion();
  } else {
    showSummary();
  }
}

function prevQuestion() {
  if (currentIndex > 0) {
    currentIndex--;
    renderQuestion();
  }
}

function showSummary() {
  clearInterval(timerInterval);
  document.getElementById("quiz-view").classList.add("hidden");
  document.getElementById("summary-view").classList.remove("hidden");

  let correctCount = 0;
  let reviewHtml = "";

  sessionQuestions.forEach((q, i) => {
    const userIdx = userAnswers[i];
    const isCorrect = userIdx !== null && q.options[userIdx].correct;
    if (isCorrect) correctCount++;

    const timeSpent = questionTimes[i];
    const correctText = q.options.find((o) => o.correct).text;
    const userText = userIdx !== null ? q.options[userIdx].text : "Skipped";

    reviewHtml += `
                <div class="review-item ${isCorrect ? "pass" : "fail"}">
                    <div style="display:flex; justify-content:space-between;">
                        <span class="review-q">${i + 1}. ${q.text}</span>
                        <span style="font-size:11px; color:#999;">${timeSpent}s</span>
                    </div>
                    <div class="review-ans"><strong>Your Answer:</strong> ${userText}</div>
                    <div class="review-ans"><strong>Correct Answer:</strong> ${correctText}</div>
                    <div style="font-size:13px; margin-top:5px; color:#555;"><em>${q.options.find((o) => o.correct).rationale}</em></div>
                </div>
            `;
  });

  const score = Math.round((correctCount / sessionQuestions.length) * 100);
  document.getElementById("score-display").innerText = score + "%";
  document.getElementById("stats-text").innerText =
    `You got ${correctCount} out of ${sessionQuestions.length} correct.`;
  document.getElementById("review-list").innerHTML = reviewHtml;

  if (window.MathJax) {
    MathJax.typesetPromise();
  }
}

function downloadReport() {
  let reportText = `PEBC MOCK EXAM - WEAKNESS REPORT\n`;
  reportText += `Date: ${new Date().toLocaleDateString()}\n`;
  reportText += `Score: ${document.getElementById("score-display").innerText}\n`;
  reportText += `-------------------------------------------\n\n`;

  let missedCount = 0;

  sessionQuestions.forEach((q, i) => {
    const userIdx = userAnswers[i];
    const isCorrect = userIdx !== null && q.options[userIdx].correct;

    // We only export the ones you got wrong or skipped
    if (!isCorrect) {
      missedCount++;
      const correctOpt = q.options.find((o) => o.correct);
      const userChoice =
        userIdx !== null ? q.options[userIdx].text : "No Answer";

      reportText += `QUESTION ${i + 1} (${q.topic})\n`;
      reportText += `Prompt: ${q.text}\n`;
      reportText += `Your Answer: ${userChoice}\n`;
      reportText += `Correct Answer: ${correctOpt.text}\n`;
      reportText += `Rationale: ${correctOpt.rationale}\n`;
      reportText += `Time Spent: ${questionTimes[i]} seconds\n`;
      reportText += `-------------------------------------------\n\n`;
    }
  });

  if (missedCount === 0) {
    reportText += "Perfect Score! No weaknesses identified in this session.";
  }

  // Create a link and trigger the download
  const blob = new Blob([reportText], { type: "text/plain" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `PEBC_Review_${new Date().getTime()}.txt`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function toggleTheme() {
  document.body.classList.toggle("dark-theme");
  const btn = document.querySelector(".theme-toggle");
  btn.innerText = document.body.classList.contains("dark-theme")
    ? "☀️ Light Mode"
    : "🌓 Dark Mode";
}

let allQuestions = []; // Start empty

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();

  reader.onload = function (e) {
    const rawContent = e.target.result;

    const jsonPart = rawContent.substring(rawContent.indexOf("["));
    const lastIndex = jsonPart.lastIndexOf("]");
    const finalData = jsonPart.substring(0, lastIndex + 1);

    allQuestions = eval(rawContent.replace("const allQuestions =", ""));

    const expiryTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
    sessionStorage.setItem("pebc_data", JSON.stringify(allQuestions));
    sessionStorage.setItem("pebc_expiry", expiryTime.toString());

    updateAvailableCount();
  };

  reader.readAsText(file);
}
