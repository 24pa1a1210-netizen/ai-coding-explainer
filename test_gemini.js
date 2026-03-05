import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI("AIzaSyAoNE3KrdcC_pakIwhO_wQ9Gm81b7Trq5U");

async function run() {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = "What is an array?";
        const result = await model.generateContent(prompt);
        console.log(result.response.text());
    } catch (e) {
        console.error("GEMINI ERR:", e);
    }
}
run();
