import "dotenv/config";
import express from "express";
import path from "path";
import cors from "cors";

const app = express();
const PORT = 3000;

console.log("🛠️  [STARTUP] Checking Environment Variables...");
console.log(`   - GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✅ Present' : '❌ MISSING'}`);
console.log(`   - VITE_GAS_URL: ${process.env.VITE_GAS_URL ? '✅ Present' : '⚠️ Missing (using fallback)'}`);
if (process.env.VITE_GAS_URL) console.log(`   - GAS URL: ${process.env.VITE_GAS_URL.substring(0, 40)}...`);

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

    const action = req.body?.action;
    console.log(`📡 [PROXY] Forwarding sync request to GAS: ${action || 'unknown'}`);

    // Server-Side forwarding to JONI Pipe to completely bypass client CORS/CSP limitations
    if (action === "syncOrder") {
      const joniUrl = process.env.VITE_MAKE_JONI_URL || process.env.MAKE_JONI_URL;
      if (joniUrl && joniUrl !== 'Fallback_URL' && joniUrl !== '') {
        console.log(`📡 [SERVER JONI] Intercepted syncOrder, routing to Make webhook server-side...`);
        
        // Reconstruct order data by destructuring system wrapper properties
        const { action: _a, method: _m, timestamp: _t, user: _u, uid: _ui, idToken: _i, sheetName: _s, ...orderData } = req.body;
        
        fetch(joniUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            source: "SabanOS_App",
            triggerType: 'order',
            timestamp: new Date().toISOString(),
            payload: orderData
          })
        }).then(response => {
          if (response.ok) {
            console.log("✅ [SERVER JONI] Successfully dispatched order server-side.");
          } else {
            console.error(`❌ [SERVER JONI] Webhook responded with status: ${response.status}`);
          }
        }).catch(err => {
          console.error("💥 [SERVER JONI] Background dispatch request failed:", err.message);
        });
      } else {
        console.warn("⚠️ [SERVER JONI] VITE_MAKE_JONI_URL is not configured on the environment / server.");
      }
    }
    
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

// Setup Asset Serving / Static / fallback API routing
const isProduction = process.env.NODE_ENV === "production" || !!process.env.VERCEL;

if (isProduction) {
  console.log("🚀 [SERVER] Starting in PRODUCTION/SERVERLESS mode");
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  
  // Handlers for assets fallback or catch-all requests
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // If in local development, initialize Vite dynamically
  console.log("🚀 [SERVER] Starting in DEVELOPMENT mode with Vite Middleware");
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    }).then(vite => {
      app.use(vite.middlewares);
      
      // Add 404 handler for unmatched API calls in dev mode
      app.all("/api/*", (req, res) => {
        console.warn(`⚠️ [SERVER] 404 on API route: ${req.method} ${req.url}`);
        res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
      });
    });
  }).catch(err => {
    console.error("🚫 Failed to start Vite server in Development Mode:", err);
  });
}

// Fallback for API routes in production/serverless mode
if (isProduction) {
  app.all("/api/*", (req, res) => {
    console.warn(`⚠️ [SERVER] 404 on API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `Not Found: ${req.method} ${req.url}` });
  });
}

// Conditionally listen if we are NOT running in a Vercel Serverless Function context
if (!process.env.VERCEL) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🟢 SabanOS Server running on http://localhost:${PORT}`);
  });
}

export default app;
