import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  serverTimestamp,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

export const saveMessage = async (userKey: string, role: string, content: string) => {
  await addDoc(collection(db, `users/${userKey}/messages_personal`), {
    role,
    content,
    timestamp: serverTimestamp()
  });
};

export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(
    collection(db, `users/${userKey}/messages_personal`),
    orderBy("timestamp", "asc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    role: doc.data().role,
    parts: [{ text: doc.data().content }]
  }));
};

export async function askNoaPersonalized(message: string, userKey: string, history: any[]) {
  try {
    const roleInstruction = `את "נועה ניהול" - העוזרת האישית של ${userKey}. תפקידך לנהל משימות, תזכורות ופרויקטים. את נפרדת מהסידור אבל חכמה באותה מידה.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `${roleInstruction} תעני בעברית חדה, מקצועית וקצרה.`
    });

    // המרת היסטוריה לפורמט PARTS תקין למניעת שגיאות API
    const formattedHistory = (history || []).map(h => {
      const role = h.role === 'model' || h.sender === 'noa' ? 'model' : 'user';
      let text = "";
      if (h.parts && h.parts[0] && h.parts[0].text) {
        text = h.parts[0].text;
      } else if (h.text) {
        text = h.text;
      } else if (typeof h.content === 'string') {
        text = h.content;
      }
      return { role, parts: [{ text: text }] };
    }).filter(item => item.parts[0].text.trim() !== "");

    const chat = model.startChat({
      history: formattedHistory,
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return {
      text: responseText,
      audioContent: sanitizeForVoice(responseText)
    };
  } catch (err) {
    console.error("Gemini Error:", err);
    return { 
      text: "אחי, יש עומס על המוח המשוכפל, תנסה שוב בעוד רגע.", 
      audioContent: "" 
    };
  }
}
