import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("🛠️  [STARTUP] Checking Environment Variables...");
  console.log(`   - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Present' : '❌ MISSING'}`);
  console.log(`   - VITE_GAS_URL: ${process.env.VITE_GAS_URL ? '✅ Present' : '⚠️ Missing (using fallback)'}`);
  if (process.env.VITE_GAS_URL) console.log(`   - GAS URL: ${process.env.VITE_GAS_URL.substring(0, 40)}...`);

  const app = express();
  const PORT = 3000;

  // Basic Middleware
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Request logger for API
  app.use("/api", (req, res, next) => {
    console.log(`🌐 [SERVER] ${req.method} ${req.url} - ${new Date().toISOString()}`);
    next();
  });

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Google Apps Script Proxy
  app.post("/api/gas-proxy", async (req, res) => {
    const gasUrl = process.env.VITE_GAS_URL || "https://script.google.com/macros/s/AKfycbzhEuTe-PZpjD0lL5GziypNd-ZOged2XqWvJ4RFu9GvpImk3-YyorpbQGuIGipLTYts_Q/exec";
    
    try {
      console.log(`📡 [GAS PROXY] Sending request to GAS for action: ${req.body?.action || 'unknown'}`);
      
      const response = await fetch(gasUrl, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SabanOS-Proxy/1.0"
        },
        body: JSON.stringify(req.body),
      });

      console.log(`📥 [GAS PROXY] Received status: ${response.status} ${response.statusText}`);
      
      const text = await response.text();
      
      // Try to parse as JSON, but return as object either way
      try {
        const json = JSON.parse(text);
        res.json(json);
      } catch (e) {
        console.log("⚠️ [GAS PROXY] Response was not JSON, sending as raw text");
        res.json({ status: "raw", data: text });
      }
    } catch (error: any) {
      console.error("❌ [GAS PROXY] Error caught in server side:", error);
      res.status(502).json({ 
        error: "Proxy failed to reach GAS", 
        message: error.message,
        timestamp: new Date().toISOString()
      });
    }
  });

  // Unified AI Proxy for Gemini
  app.post("/api/ai/generate", async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY?.trim();
      if (!apiKey || apiKey === "undefined" || apiKey.length < 10) {
        console.error("❌ [AI PROXY] Missing or invalid GEMINI_API_KEY");
        return res.status(500).json({ error: "Gemini API key is invalid or missing." });
      }

      console.log(`🤖 [AI PROXY] Generating content for model: ${req.body.model || "gemini-1.5-flash"}`);
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
      console.log("✅ [AI PROXY] Generation successful");
    } catch (error: any) {
      console.error("❌ [AI PROXY] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Fallback for API routes to prevent Vite SPA takeover
  app.all("/api/*", (req, res) => {
    console.warn(`⚠️ [SERVER] 404 on API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
  });

  // Static and SPA serving
  if (process.env.NODE_ENV !== "production") {
    console.log("🚀 [SERVER] Starting in DEVELOPMENT mode with Vite Middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("🚀 [SERVER] Starting in PRODUCTION mode");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🟢 SabanOS Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("💥 CRITICAL: Server failed to start:", err);
});
