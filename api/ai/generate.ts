import { GoogleGenAI } from "@google/genai";

const genAI = process.env.GEMINI_API_KEY ? new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY }) : null;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (!genAI) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }

    const { model, contents, config } = req.body;
    const response = await genAI.models.generateContent({
      model: model || "gemini-1.5-flash",
      contents: contents,
      config: config
    });
    
    res.status(200).json({ 
      text: response.text,
      candidates: response.candidates
    });
  } catch (error: any) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}
