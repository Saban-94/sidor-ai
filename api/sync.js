export default async function handler(req, res) {
  // Set permissive CORS headers for Vercel Serverless Function
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method Not Allowed. Use POST.' });
  }

  try {
    const fallbackUrl = "https://script.google.com/macros/s/AKfycbzhEuTe-PZpjD0lL5GziypNd-ZOged2XqWvJ4RFu9GvpImk3-YyorpbQGuIGipLTYts_Q/exec";
    const gasUrl = process.env.VITE_GAS_URL || process.env.GAS_URL || fallbackUrl;

    if (!gasUrl) {
      console.error("❌ [VERCEL API /api/sync] GAS URL not configured");
      return res.status(500).json({ status: "error", message: "GAS URL not configured" });
    }

    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    console.log(`📡 [VERCEL API /api/sync] Forwarding to GAS:`, payload?.action || 'unknown');

    const response = await fetch(gasUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let json;
    try {
      json = JSON.parse(responseText);
      return res.status(response.status).json(json);
    } catch {
      return res.status(response.status).send(responseText);
    }
  } catch (error) {
    console.error("💥 [VERCEL API /api/sync] Sync failed:", error.message);
    return res.status(500).json({ status: "error", message: error.message || 'Internal Server Error' });
  }
}
