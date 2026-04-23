export default async function handler(req: any, res: any) {
  return res.status(410).json({ error: "AI proxy is deprecated. Use the client-side GoogleGenAI SDK directly." });
}
