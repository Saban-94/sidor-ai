import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  collection, 
  addDoc, 
  query, 
  getDocs, 
  serverTimestamp,
  orderBy,
  limit,
  where
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';

// --- הגנת אתחול למניעת GoogleGenerativeAI is not defined ---
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";

// פונקציית עזר פנימית ליצירת המודל רק כשצריך
const getAiInstance = () => {
  if (!API_KEY) {
    console.error("❌ Missing VITE_GEMINI_API_KEY in Environment Variables");
    return null;
  }
  try {
    return new GoogleGenerativeAI(API_KEY);
  } catch (err) {
    console.error("❌ Failed to initialize GoogleGenerativeAI:", err);
    return null;
  }
};

const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

// --- הנחיות המערכת של נועה ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור שותפה של ראמי.
התפקיד שלך הוא לעזור לראמי ולצוות לנהל את ח.סבן חומרי בנין ביעילות מקסימלית.
הנחיות:
1. שליטה במידע: חיפוש הזמנות ועדכון נהגים.
2. זיהוי פונה: הראל ("אהלן בוס!🕵️"), ורד ("אישה לאישה"), נתנאל ("צדיק"), אורן ("זיקית").
3. עיצוב: טבלאות HTML בלבד למוצרים וכמויות. NO MARKDOWN.
4. שפה: נשית, עברית חדה ופרקטית.
`;

// --- פונקציות Firestore ---
export const fetchOrders = async (dateStr: string): Promise<Order[]> => {
  try {
    const q = query(collection(db, 'orders'), where('date', '==', dateStr));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  } catch (err) {
    console.error("Error fetching orders:", err);
    return [];
  }
};

export const saveMessage = async (userKey: string, role: string, content: string) => {
  await addDoc(collection(db, `users/${userKey}/messages_personal`), {
    role, content, timestamp: serverTimestamp()
  });
};

export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(collection(db, `users/${userKey}/messages_personal`), orderBy("timestamp", "asc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    role: doc.data().role,
    parts: [{ text: doc.data().content }]
  }));
};

// --- המוח של נועה (Gemini 3) ---
export async function askNoaPersonalized(message: string, userKey: string, history: any[]) {
  const genAI = getAiInstance();
  
  if (!genAI) {
    return { text: "אחי, המערכת לא מזהה את ה-API KEY. תבדוק את ההגדרות ב-Vercel.", audioContent: "" };
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      systemInstruction: noaSystemInstruction + `\nהמשתמש הנוכחי הוא: ${userKey}.`
    });

    const formattedHistory = (history || []).map(h => {
      const role = h.role === 'model' || h.sender === 'noa' ? 'model' : 'user';
      let text = h.parts?.[0]?.text || h.text || h.content || "";
      return { role, parts: [{ text: text }] };
    }).filter(item => item.parts[0].text.trim() !== "");

    const chat = model.startChat({ history: formattedHistory });
    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return {
      text: responseText,
      audioContent: sanitizeForVoice(responseText)
    };
  } catch (err: any) {
    console.error("Gemini 3 Error:", err);
    return { text: `תקלת תקשורת: ${err.message}`, audioContent: "" };
  }
}
