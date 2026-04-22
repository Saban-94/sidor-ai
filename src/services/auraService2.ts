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

// --- הגדרות מערכת ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור שותפה של ראמי.
התפקיד שלך הוא לעזור לראמי ולצוות לנהל את ח.סבן חומרי בנין ביעילות מקסימלית.

הנחיות קריטיות:
1. שליטה במידע: חיפוש הזמנות ועדכון נהגים.
2. זיהוי פונה: הראל ("אהלן בוס!🕵️"), ורד ("אישה לאישה"), נתנאל ("צדיק"), אורן ("זיקית").
3. עיצוב: חובה להשתמש ב-<table> למוצרים וכמויות. NO MARKDOWN.
4. שפה: נשית👩🏼, עברית חדה, פרקטית, "שותפה". "פקודה בוצעה".
5. פעולות אקטיביות: בכל בקשה ל"רישום" או "הזכרה", הפעילי מיד create_reminder.
`;

// פונקציית עזר לניקוי טקסט לדיבור
const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

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

// --- ליבת הבינה המלאכותית (Gemini 3) ---

export async function askNoaPersonalized(message: string, userKey: string, history: any[]) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    return { 
      text: "ראמי אחי, חסר מפתח API ב-Vercel. נועה לא יכולה לענות.", 
      audioContent: "" 
    };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
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
    return { 
      text: `שגיאת תקשורת: ${err.message}`, 
      audioContent: "" 
    };
  }
}
