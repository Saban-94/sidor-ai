import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import multer from "multer";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({ storage: multer.memoryStorage() });

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Routes
  app.post("/api/drive/upload", upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      const folderId = req.body.folderId || process.env.NEXT_PUBLIC_DRIVE_FOLDER_ID;
      const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

      if (!file) {
        return res.status(400).json({ error: "No file provided" });
      }

      if (!serviceAccountJson) {
        console.error("GOOGLE_SERVICE_ACCOUNT_JSON is missing in environment");
        return res.status(500).json({ error: "Server configuration error: Service Account missing" });
      }

      // Initialize Google Auth with Service Account
      let credentials;
      try {
        credentials = JSON.parse(serviceAccountJson);
      } catch (e) {
        console.error("Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON");
        return res.status(500).json({ error: "Server configuration error: Invalid Service Account format" });
      }

      const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ["https://www.googleapis.com/auth/drive.file"],
      });

      const drive = google.drive({ version: "v3", auth });

      // Create stream from buffer
      const { Readable } = await import("stream");
      const stream = new Readable();
      stream.push(file.buffer);
      stream.push(null);

      const response = await drive.files.create({
        requestBody: {
          name: file.originalname,
          parents: folderId ? [folderId] : [],
        },
        media: {
          mimeType: file.mimetype,
          body: stream,
        },
        fields: "id",
      } as any);

      res.json({ id: response.data.id });
    } catch (error: any) {
      console.error("Drive upload error:", error);
      res.status(500).json({ error: error.message || "Failed to upload to Drive" });
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
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
