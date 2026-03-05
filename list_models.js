import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI("AIzaSyAoNE3KrdcC_pakIwhO_wQ9Gm81b7Trq5U");
// NOTE: I am using the key from the code

async function listModels() {
    try {
        const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyAoNE3KrdcC_pakIwhO_wQ9Gm81b7Trq5U");
        const json = await res.json();
        console.log(json.models.map(m => m.name).join("\n"));
    } catch (e) {
        console.error(e);
    }
}
listModels();
