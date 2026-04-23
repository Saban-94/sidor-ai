import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Gemini API - DEPRECATED (Call from client directly)
// const genAI = ...

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Helper for AI generation (Redirected to client-side, but keep endpoint for backward compatibility if needed)
  app.post("/api/ai/generate", async (req, res) => {
    return res.status(410).json({ error: "AI proxy is deprecated. Use the client-side GoogleGenAI SDK directly." });
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
