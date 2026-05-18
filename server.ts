import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";

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

  // Proxy for Google Apps Script (Bypasses CORS and allows server-side logging)
  app.post("/api/sync", async (req, res) => {
    try {
      const fallbackUrl = "https://script.google.com/macros/s/AKfycbzhEuTe-PZpjD0lL5GziypNd-ZOged2XqWvJ4RFu9GvpImk3-YyorpbQGuIGipLTYts_Q/exec";
      const gasUrl = process.env.VITE_GAS_URL || fallbackUrl;
      
      if (!gasUrl) {
        console.error("❌ [PROXY] GAS URL not configured and no fallback available");
        return res.status(500).json({ status: "error", message: "GAS URL not configured" });
      }

      console.log(`📡 [PROXY] Forwarding sync request to GAS: ${req.body?.action || 'unknown'}`);
      
      const response = await fetch(gasUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(req.body)
      });

      console.log(`📡 [PROXY] GAS Response Status: ${response.status}`);
      const responseText = await response.text();
      
      if (!response.ok) {
        console.error(`❌ [PROXY] GAS Error Body: ${responseText.substring(0, 500)}`);
      }
      
      try {
        const json = JSON.parse(responseText);
        res.status(response.status).json(json);
      } catch (e) {
        res.status(response.status).send(responseText);
      }
    } catch (error: any) {
      console.error("💥 [PROXY] Sync failed:", error.message);
      res.status(500).json({ status: "error", message: error.message });
    }
  });

  // Gemini API Proxy (Server-side to keep key secure)
  app.post("/api/chat", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;

      if (!apiKey) {
        console.error("❌ [GEMINI] GEMINI_API_KEY is missing from environment");
        return res.status(500).json({ error: "Gemini API key is not configured on the server." });
      }

      console.log(`🧠 [GEMINI] Generating content with model: ${model || 'gemini-3-flash-preview'}`);

      // Using direct fetch to Gemini API to avoid dependency issues in this specific environment
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-3-flash-preview'}:generateContent?key=${apiKey}`;
      
      const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents,
          generationConfig: config?.generationConfig,
          systemInstruction: config?.systemInstruction,
          tools: config?.tools,
          toolConfig: config?.toolConfig
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.error("❌ [GEMINI] API Error:", JSON.stringify(data));
        return res.status(response.status).json(data);
      }

      res.json(data);
    } catch (error: any) {
      console.error("💥 [GEMINI] Internal Error:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Fallback for API routes
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
