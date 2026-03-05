// Import Official Google SDK directly from CDN for Vanilla JavaScript
import { GoogleGenerativeAI } from 'https://esm.run/@google/generative-ai';

// Initialize the exact same AI model you were using in the Express backend
const genAI = new GoogleGenerativeAI("AIzaSyAoNE3KrdcC_pakIwhO_wQ9Gm81b7Trq5U");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// ======================== STATE ======================== //
// Mimicking React states variables in pure JS
let history = JSON.parse(localStorage.getItem('ai_explainer_history')) || [];
let activeChatId = null;
let searchQuery = "";
let isLoading = false;
let activeApprIdx = 0;
let activeLang = "Python";

// ======================= ELEMENTS ====================== //
const newChatBtn = document.getElementById('newChatBtn');
const leetcodeWidget = document.getElementById('leetcodeWidget');
const searchInput = document.getElementById('searchInput');
const historyListContainer = document.getElementById('historyListContainer');
const chatScrollArea = document.getElementById('chatScrollArea');
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const submitBtn = document.getElementById('submitBtn');

// ======================= UTILITIES ===================== //
function uuidv4() {
    return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
        (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
    );
}

function saveHistory() {
    localStorage.setItem('ai_explainer_history', JSON.stringify(history));
    renderSidebar();
}

// Emulates code highlighting locally
function highlightCode(code) {
    return code
        .replace(/(def|class|function|var|let|const|public|private|int|vector|unordered_map|Map|Integer|return|for|if|in|while|bool|boolean)\b/g, '<span class="keyword">$1</span>')
        .replace(/#.*$/gm, match => `<span class="comment">${match}</span>`)
        .replace(/\/\/.*$/gm, match => `<span class="comment">${match}</span>`);
}

function syntaxHtml(code, lang) {
    const high = highlightCode(code || "// Select a language");
    return `
    <div class="code-window">
      <div class="code-header-bar">
        <div class="mac-dots">
          <div class="mac-dot mac-red"></div>
          <div class="mac-dot mac-yellow"></div>
          <div class="mac-dot mac-green"></div>
        </div>
        <span class="code-lang-label">${lang.toUpperCase()}</span>
      </div>
      <pre class="code-pre">${high}</pre>
    </div>
  `;
}

// Global functions so dynamically injected HTML template strings can execute them
window.setApprIdx = (idx) => {
    activeApprIdx = idx;
    renderMain();
};

window.setLang = (lang) => {
    activeLang = lang;
    renderMain();
};


// ====================== RENDERING ====================== //
function renderSidebar() {
    historyListContainer.innerHTML = '';
    const filtered = history.filter(chat => chat.title.toLowerCase().includes(searchQuery.toLowerCase()));

    if (history.length === 0) {
        historyListContainer.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--border-hover); font-size: 0.9rem;">No history found in LocalStorage. Ask a question!</div>`;
        lucide.createIcons();
        return;
    }

    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = `history-item ${activeChatId === chat.id ? 'active' : ''}`;

        item.innerHTML = `
      <i data-lucide="message-square" width="16" height="16"></i>
      <span class="history-text">${chat.title}</span>
      <button class="history-delete" data-id="${chat.id}">
        <i data-lucide="trash-2" width="16" height="16"></i>
      </button>
    `;

        // Click handler for sidebar elements
        item.onclick = (e) => {
            if (e.target.closest('.history-delete')) return; // Ignore if user hit trash
            activeChatId = chat.id;

            const activeChat = history.find(c => c.id === activeChatId);
            if (activeChat && activeChat.result && activeChat.result.approaches) {
                activeApprIdx = activeChat.result.approaches.length - 1; // reset optimal approach
                activeLang = "Python";
            }

            renderMain();
            renderSidebar();
        };

        const delBtn = item.querySelector('.history-delete');
        delBtn.onclick = (e) => {
            e.stopPropagation();
            history = history.filter(h => h.id !== chat.id);
            if (activeChatId === chat.id) activeChatId = null;
            saveHistory();
            renderMain();
        };

        historyListContainer.appendChild(item);
    });

    lucide.createIcons();
}

function renderMain() {
    const area = chatScrollArea;

    if (isLoading) {
        area.innerHTML = `
      <div class="loading-overlay">
        <div class="loader"></div>
        <div>Generating AI Explanation...</div>
      </div>
    `;
        return;
    }

    const activeChat = history.find(c => c.id === activeChatId);

    // Default Welcome Screen
    if (!activeChat) {
        area.innerHTML = `
      <div class="welcome-screen">
        <h1 class="app-brand" style="display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap;">
          <svg viewBox="0 0 24 24" width="64" height="64" xmlns="http://www.w3.org/24/svg" style="filter: drop-shadow(0px 0px 8px rgba(255, 161, 22, 0.4))">
            <path fill="#FFA116" d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.939 5.939 0 0 0 1.271 1.541l11.114 11.114c.54.54 1.414.54 1.954 0 .54-.54.54-1.415 0-1.954l-11.114-11.114a3.17 3.17 0 0 1-.689-.838 3.082 3.082 0 0 1-.225-.56c-.023-.082-.041-.167-.053-.255a3.111 3.111 0 0 1-.031-.264c-.005-.09-.01-.184 0-.276a3.158 3.158 0 0 1 .151-.715c.08-.22.18-.429.3-.62l3.854-4.126 5.406-5.788a1.374 1.374 0 0 0-.44-2.35 1.374 1.374 0 0 0-.916.038z" />
          </svg>
          <span>AI Explainer</span>
        </h1>
        <p class="motivational-quote">
          "Code is like humor. When you have to explain it, it’s bad.<br />But every master was once a beginner learning the ropes."<br />
          <span style="font-size: 0.9rem; margin-top: 1rem; display: block; color: var(--accent-secondary);">— Start asking any Data Structure question below</span>
        </p>
      </div>
    `;
        lucide.createIcons();
        return;
    }

    // Active Chat Screen
    const r = activeChat.result;

    const approachTabsHTML = (r.approaches || []).map((app, idx) => `
    <button class="tab ${activeApprIdx === idx ? 'active' : ''}" onclick="window.setApprIdx(${idx})">
      ${app.name}
    </button>
  `).join('');

    const currentAppr = (r.approaches || [])[activeApprIdx] || {};
    const langs = Object.keys(currentAppr.implementations || {});
    const langTabsHTML = langs.map(lang => `
    <button class="tab ${activeLang === lang ? 'active' : ''}" onclick="window.setLang('${lang}')">
      ${lang}
    </button>
  `).join('');

    const codeAreaHTML = syntaxHtml((currentAppr.implementations || {})[activeLang], activeLang);

    area.innerHTML = `
    <div class="content-wrapper">
      <div class="user-query-blob">"${activeChat.prompt}"</div>

      <div class="badge-row" style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <span class="badge badge-${(r.difficulty || '').toLowerCase()}">
          <i data-lucide="trending-up" width="16" height="16"></i> ${r.difficulty}
        </span>
        <span class="striver-badge">
          <i data-lucide="graduation-cap" width="16" height="16"></i> ${r.striverReference}
        </span>
      </div>

      <div class="section-card">
        <div class="section-header">
          <i data-lucide="brain-circuit" width="22" height="22" style="color: var(--accent-secondary);"></i>
          Context & Example Breakdown
        </div>
        <div class="section-body">
          <p style="margin-bottom: 1.5rem; color: var(--text-muted); font-size: 1.05rem; line-height: 1.7;">
            ${r.problemContext}
          </p>
          ${(r.examples || []).map(ex => `
            <div class="example-box">
              <strong style="color: var(--accent-secondary);">Input:</strong> ${ex.input}<br />
              <strong style="color: var(--accent-secondary);">Output:</strong> ${ex.output}<br />
              <strong style="color: var(--accent-secondary);">Why:</strong> ${ex.explanation}
            </div>
          `).join('')}
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-top: 1.5rem;">
            <div class="hint-box">
              <h4 style="display: flex; gap: 0.5rem; align-items: center; color: var(--warning); margin-bottom: 0.5rem;"><i data-lucide="lightbulb" width="18" height="18"></i> AI Hint</h4>
              <div style="color: var(--text-muted);">${r.hint}</div>
            </div>
            <div class="tip-box">
              <h4 style="display: flex; gap: 0.5rem; align-items: center; color: var(--success); margin-bottom: 0.5rem;"><i data-lucide="check-circle-2" width="18" height="18"></i> Pro Tip</h4>
              <div style="color: var(--text-muted);">${r.tips}</div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 style="margin-bottom: 1rem;">Select Approach:</h3>
        <div class="approach-tabs">${approachTabsHTML}</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 2rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          <div class="section-card">
            <div class="section-header"><i data-lucide="lightbulb" width="20" height="20" style="color: var(--warning);"></i> Intuition</div>
            <div class="section-body" style="color: var(--text-muted); line-height: 1.6;">${currentAppr.intuition}</div>
          </div>
          <div class="section-card">
            <div class="section-header"><i data-lucide="cpu" width="20" height="20" style="color: var(--accent-primary);"></i> Complexity</div>
            <div class="section-body" style="color: var(--text-muted);">
              <div style="margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem;">
                <span class="badge badge-time"><i data-lucide="clock" width="16" height="16"></i> Time</span>
                <strong style="color: white;">${currentAppr.timeComplexity}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 1rem;">
                <span class="badge badge-space"><i data-lucide="cpu" width="16" height="16"></i> Space</span>
                <strong style="color: white;">${currentAppr.spaceComplexity}</strong>
              </div>
            </div>
          </div>
        </div>

        <div class="section-card">
          <div class="section-header"><i data-lucide="trending-up" width="20" height="20" style="color: var(--success);"></i> Step-by-Step Logic</div>
          <div class="section-body">
            <ol class="step-list">
              ${(currentAppr.steps || []).map(step => `<li>${step}</li>`).join('')}
            </ol>
          </div>
        </div>

        <div class="section-card">
          <div class="section-header" style="padding-bottom: 0; border-bottom: none;"><i data-lucide="code-2" width="20" height="20"></i> Implementation</div>
          <div class="section-body">
            <div class="lang-tabs">${langTabsHTML}</div>
            ${codeAreaHTML}
          </div>
        </div>
      </div>
    </div>
  `;
    lucide.createIcons();

    // auto scroll down
    setTimeout(() => { area.scrollTop = area.scrollHeight; }, 100);
}

// ====================== API FETCH ====================== //
async function fetchLiveExplanation(problemText) {
    const prompt = `
You are an expert Coding Tutor for beginners.
Analyze the following coding problem and break down the solution.
Format your response EXACTLY as a JSON object matching this structure. Ensure it is valid JSON and contains absolutely NO markdown wrapping (like \`\`\`json). Just output the raw JSON string:

{
  "difficulty": "Easy",
  "striverReference": "e.g. A2Z DSA Course - Step X",
  "problemContext": "Brief context about the problem, why it is important.",
  "hint": "A gentle hint without giving away the logic",
  "tips": "A pro tip about space/time tradeoffs",
  "examples": [
    { "input": "...", "output": "...", "explanation": "..." }
  ],
  "approaches": [
    {
      "id": "brute-force",
      "name": "1. Brute Force Approach",
      "intuition": "Explanation of the simple approach",
      "timeComplexity": "O(n^2)",
      "spaceComplexity": "O(1)",
      "steps": ["Step 1", "Step 2"],
      "implementations": {
        "Python": "Python code here",
        "Java": "Java code here",
        "C++": "C++ code here",
        "JavaScript": "JavaScript code here"
      }
    }
  ]
}

Ensure the Optimal Approach (O(n) or O(log n)) is included in the approaches array. Format the code cleanly.

The problem:
"${problemText}"
`;

    const response = await model.generateContent(prompt);
    let text = response.response.text();
    if (text.startsWith("\`\`\`json")) text = text.substring(7);
    else if (text.startsWith("\`\`\`")) text = text.substring(3);
    if (text.endsWith("\`\`\`")) text = text.slice(0, -3);
    return JSON.parse(text.trim());
}

// ======================= EVENTS ======================== //
newChatBtn.onclick = () => {
    activeChatId = null;
    chatInput.value = "";
    searchQuery = "";
    searchInput.value = "";
    renderSidebar();
    renderMain();
};

leetcodeWidget.onclick = newChatBtn.onclick;

searchInput.oninput = (e) => {
    searchQuery = e.target.value;
    renderSidebar();
};

chatInput.oninput = (e) => {
    submitBtn.disabled = e.target.value.trim().length === 0 || isLoading;
};

chatInput.onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        chatForm.dispatchEvent(new Event('submit'));
    }
};

chatForm.onsubmit = async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || isLoading) return;

    chatInput.value = "";
    submitBtn.disabled = true;
    isLoading = true;
    renderMain();

    try {
        const aiResult = await fetchLiveExplanation(text);

        activeChatId = uuidv4();
        history.unshift({
            id: activeChatId,
            title: text.length > 30 ? text.substring(0, 30) + '...' : text,
            prompt: text,
            result: aiResult
        });

        // Automatically select optimal approach
        activeApprIdx = aiResult.approaches ? aiResult.approaches.length - 1 : 0;
        activeLang = "Python";

        saveHistory();

    } catch (err) {
        console.error("API Error: ", err);
        alert('Failed to connect to AI. Please check your console.');
    } finally {
        isLoading = false;
        renderMain();
    }
};


// Initialization run
renderSidebar();
renderMain();
