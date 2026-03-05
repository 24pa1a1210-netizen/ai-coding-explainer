import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite DB Connect
let db;
(async () => {
    db = await open({
        filename: './database.sqlite',
        driver: sqlite3.Database
    });

    await db.exec(`
    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      title TEXT,
      prompt TEXT,
      result TEXT,
      timestamp TEXT
    )
  `);
    console.log("Connected to SQLite Database.");
})();

// Google Gemini Setup
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSyAoNE3KrdcC_pakIwhO_wQ9Gm81b7Trq5U");

const fetchLiveExplanation = async (problemText) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    if (text.startsWith("\`\`\`json")) text = text.substring(7);
    else if (text.startsWith("\`\`\`")) text = text.substring(3);
    if (text.endsWith("\`\`\`")) text = text.slice(0, -3);
    return JSON.parse(text.trim());
};

// API Endpoints
// 1. Get History
app.get('/api/history', async (req, res) => {
    try {
        const history = await db.all('SELECT * FROM history ORDER BY timestamp DESC');
        const parsedHistory = history.map(row => ({
            ...row,
            result: JSON.parse(row.result)
        }));
        res.json(parsedHistory);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 2. Generate and Save Solution
app.post('/api/ask', async (req, res) => {
    const { prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: "Prompt is required" });

    try {
        let result;
        try {
            result = await fetchLiveExplanation(prompt);
        } catch (apiError) {
            console.error("AI API Error (Fallback Triggered):", apiError);
            result = {
                difficulty: "Unknown",
                striverReference: "Fallback Mode Engaged",
                problemContext: "The Live API encountered an error (e.g. invalid API key, network error, or safety block). Showing fallback data instead so the UI remains active.",
                hint: "Check the backend console for the precise API error.",
                tips: "Ensure your Gemini API key is valid, has billing enabled if necessary, and the prompt complies with safety limits.",
                examples: [
                    { input: prompt.substring(0, 20) + "...", output: "Error", explanation: "Live request blocked or failed." }
                ],
                approaches: [
                    {
                        id: "fallback",
                        name: "1. Fallback Offline Overview",
                        intuition: "Because the API threw an error, we gracefully fell back to this offline template. Your application UI remains active and unaffected.",
                        timeComplexity: "O(1)",
                        spaceComplexity: "O(1)",
                        steps: ["Understand the API error.", "Ensure the Live Key is active and accurate."],
                        implementations: {
                            "Python": "# The API encountered an error.\ndef handle_error():\n    print('Check backend console for API issues.')",
                            "JavaScript": "// The API encountered an error.\nfunction handleError() {\n    console.log('Check backend console for API issues.');\n}"
                        }
                    }
                ]
            };
        }

        const newChat = {
            id: uuidv4(),
            title: prompt.length > 30 ? prompt.substring(0, 30) + '...' : prompt,
            prompt: prompt,
            result: JSON.stringify(result),
            timestamp: new Date().toISOString()
        };

        await db.run(
            'INSERT INTO history (id, title, prompt, result, timestamp) VALUES (?, ?, ?, ?, ?)',
            [newChat.id, newChat.title, newChat.prompt, newChat.result, newChat.timestamp]
        );

        res.json({ ...newChat, result });
    } catch (e) {
        console.error("Database Handling Error:", e);
        res.status(500).json({ error: "Failed to save to database." });
    }
});

// 3. Delete History Item
app.delete('/api/history/:id', async (req, res) => {
    try {
        await db.run('DELETE FROM history WHERE id = ?', [req.params.id]);
        res.json({ success: true, id: req.params.id });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(port, () => {
    console.log(`Backend API Server running on http://localhost:${port}`);
});
