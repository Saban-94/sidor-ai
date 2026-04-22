import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy,
  limit,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

// --- פונקציות עזר ---
const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

// --- זיכרון משוכפל (הפרדת נתיבים) ---
export const saveMessage = async (userKey: string, role: string, content: string, isPersonal = false) => {
  const path = isPersonal ? `users/${userKey}/messages_personal` : `users/${userKey}/messages`;
  await addDoc(collection(db, path), { role, content, timestamp: serverTimestamp() });
};

export const getPrivateChatHistory = async (userKey: string, isPersonal = false) => {
  const path = isPersonal ? `users/${userKey}/messages_personal` : `users/${userKey}/messages`;
  const q = query(collection(db, path), orderBy("timestamp", "asc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    role: doc.data().role,
    parts: [{ text: doc.data().content }]
  }));
};

// --- המוח המשוכפל (יכולות נועה X2) ---
export async function askNoaPersonalized(message: string, userKey: string, history: any[], isPersonal = false) {
  try {
    // הגדרת זהות לפי סוג הנועה
    const roleInstruction = isPersonal 
      ? `את "נועה ניהול" - העוזרת האישית של ${userKey}. תפקידך לנהל משימות, תזכורות ופרויקטים. את נפרדת מהסידור אבל חכמה באותה מידה.`
      : `את "נועה סידור" - מנהלת הלוגיסטיקה של ח. סבן עבור ${userKey}.`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `${roleInstruction} תעני בעברית חדה, מקצועית וקצרה.`
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts
      })),
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return {
      text: responseText,
      audioContent: sanitizeForVoice(responseText)
    };
  } catch (err) {
    console.error("Gemini Error:", err);
    return { text: "אחי, יש עומס על המוח, תנסה שוב.", audioContent: "" };
  }
}

// --- פונקציות מערכת משותפות ---
export const updateOrder = async (id: string, updates: any) => {
  await updateDoc(doc(db, 'orders', id), { ...updates, updatedAt: serverTimestamp() });
};
