import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

// Initialize Gemini API
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // Diagnostic: Check for API Key presence at start
  const startupKey = process.env.GEMINI_API_KEY;
  if (!startupKey) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in the environment at startup.");
  } else {
    console.log(`✅ GEMINI_API_KEY is present (Length: ${startupKey.length})`);
    
    // Attempt a test call to verify key validity
    const testGenAI = new GoogleGenAI({ 
      apiKey: startupKey.trim(),
      apiVersion: "v1beta"
    });
    
    testGenAI.models.list()
      .then(() => console.log("✨ Gemini API Key verified successfully (Test list models succeeded)"))
      .catch((err) => {
        console.error("❌ Gemini API Key verification failed at startup:");
        console.error(err.message || err);
      });
  }

  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Explicitly serve public folder assets (manifest.json, icons, etc.)
  app.use(express.static(path.join(process.cwd(), 'public')));

  // AI generation proxy
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
        return res.status(500).json({ 
          error: "Gemini API key is invalid or not provided. Please check the 'Secrets' tab in the app settings.",
          details: `Current state: ${!apiKey ? 'Missing' : 'Present but short/invalid'}`
        });
      }

      // Explicitly using v1beta as it sometimes resolves "invalid key" issues with specific models/regions
      const genAI = new GoogleGenAI({ 
        apiKey,
        apiVersion: "v1beta" 
      });
      const { model, contents, config } = req.body;

      const response = await genAI.models.generateContent({
        model: model || "gemini-1.5-flash",
        contents: contents,
        config: config
      });
      
      res.json(response);
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      res.status(500).json({ 
        error: error.message || "Failed to generate content",
        details: error.status || "Internal Server Error"
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
