import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const startupKey = process.env.GEMINI_API_KEY;
  if (!startupKey) {
    console.warn("⚠️ WARNING: GEMINI_API_KEY is not defined in the environment.");
  } else {
    console.log(`✅ GEMINI_API_KEY is present`);
  }

  const app = express();
  const PORT = 3000;

  // Middleware
  app.use(express.json({ limit: '50mb' }));

  // Request logger for API
  app.use("/api", (req, res, next) => {
    console.log(`🌐 API ${req.method} ${req.url}`);
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Google Apps Script Proxy
  app.post("/api/gas-proxy", async (req, res) => {
    const gasUrl = process.env.VITE_GAS_URL;
    if (!gasUrl) {
      return res.status(500).json({ error: "GAS_URL not configured" });
    }

    try {
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(req.body),
      });

      const text = await response.text();
      try {
        res.json(JSON.parse(text));
      } catch (e) {
        res.send(text);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Unified AI Proxy for Gemini
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
        return res.status(500).json({ error: "Gemini API key is invalid or missing." });
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      const { model: modelName, contents, config, systemInstruction } = req.body;

      const model = genAI.getGenerativeModel({ 
        model: modelName || "gemini-1.5-flash",
        generationConfig: config,
        systemInstruction: typeof systemInstruction === 'string' ? { role: 'system', parts: [{ text: systemInstruction }] } : systemInstruction
      });

      const result = await model.generateContent({ contents });
      const response = await result.response;
      
      let text = "";
      try { text = response.text(); } catch (e) {}
      
      res.json({ ...response, text });
    } catch (error: any) {
      console.error("❌ AI Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fallback for API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
  });

  // Static and SPA serving
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
