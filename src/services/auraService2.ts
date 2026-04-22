import { GoogleGenerativeAI } from "@google/generative-ai";
import { 
  collection, addDoc, query, getDocs, 
  serverTimestamp, orderBy, limit, where 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../types';

// --- פונקציית עזר לשליפת מפתח בזמן אמת ---
const getGeminiKey = () => {
  // בדיקה של כל המקורות האפשריים למפתח
  const key = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!key) {
    console.warn("⚠️ המפתח VITE_GEMINI_API_KEY לא נמצא ב-env");
  }
  return key;
};

// ❌ אל תכתוב כאן: const genAI = new GoogleGenerativeAI... זה מה שמפיל את הדפדפן בטעינה

const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

// ... כאן נשאר ה-noaSystemInstruction שלך בלי שינוי ...

// --- המוח של נועה (מתוקן למניעת שגיאת API Key בטעינה) ---
export async function askNoaPersonalized(message: string, userKey: string, history: any[]) {
  const key = getGeminiKey();
  
  if (!key) {
    return { 
      text: "ראמי אחי, חסר מפתח API ב-Vercel. נועה לא יכולה לענות עד שתגדיר VITE_GEMINI_API_KEY.", 
      audioContent: "" 
    };
  }

  try {
    // אתחול ה-SDK רק כאן, בתוך הפונקציה אסינכרונית
    const genAI = new GoogleGenerativeAI(key);
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
    return { text: `שגיאת תקשורת מול גוגל: ${err.message}`, audioContent: "" };
  }
}

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
