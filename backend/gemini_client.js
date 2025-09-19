// gemini_client.js
// Direct REST API call to Gemini (no SDK)

import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`;

export async function callGemini(prompt, options = {}) {
  try {
    const body = {
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: options.temperature ?? 0,
        maxOutputTokens: options.max_tokens ?? 500,
      },
    };

    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error: ${res.status} ${res.statusText} - ${errText}`);
    }

    const data = await res.json();

    // Extract plain text from Gemini’s response
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    return { text, raw: data };
  } catch (err) {
    console.error("❌ Gemini fetch failed:", err);
    throw err;
  }
}
