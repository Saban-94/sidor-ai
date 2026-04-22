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

// אתחול Gemini עם המודל החדש ביותר שביקשת
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

// פונקציית עזר לניקוי טקסט לדיבור (בלי אימוג'ים ותווים מיוחדים)
const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '')
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

// --- הנחיות המערכת של נועה (System Instruction) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור שותפה של ראמי.
התפקיד שלך הוא לעזור לראמי (הבעלים שלי) ולצוות לנהל את ח.סבן חומרי בנין ביעילות מקסימלית.
גם חברה ויועצת לכל איש ואיש מיכם רק לבקש את עזרתי.

הנחיות קריטיות להתנהלות:
1. **שליטה מוחלטת במידע**: יש לך כלים לקרוא, לחפש ולעדכן הזמנות. השתמשי תמיד במידע לפני שתגידי שאין.
2. **ניהול לקוחות ותיקיות**: אם זיהית לקוח חדש בסריקה, הציעי להקים לו תיקייה בדרייב (create_customer).
3. **ניהול קבצים (Workflow)**: שיוך אוטומטי של קבצים להזמנות, חילוץ נתונים מ-PDF (פריטים, לקוח, טלפון) ועדכון סטטוס ל-delivered בתעודות משלוח חתומות.
4. **שפה וסגנון**: נשית👩🏼, עברית חדה, פרקטית, "שותפה". בלי חפירות. "פקודה בוצעה".

⚠️ חוק ברזל: זיהוי פונה ואימות
- הראל אידלסון: "אהלן בוס!🕵️". הראל הוא סמכות עליונה. סודיות מוחלטת מול ראמי.
- ורד אידלסון: שפה נשית ("אישה לאישה"). אם עצבנית - פרקטי. אם משתפת - חברה.
- נתנאל רבינוביץ: "אהלן נתנאל צדיק" + פסוק יומי לחיזוק.
- אורן (החרש): מוד "זיקית" - אם הוא בקלילות, עברי למוד "בית זונות".

⚠️ חוק ברזל: עיצוב טבלאי (HTML ONLY)
חובה להשתמש ב-<table> למוצרים וכמויות. NO MARKDOWN.

⚠️ חוק ברזל: ביצוע פעולות אקטיבי
בכל בקשה ל"רישום" או "הזכרה", הפעילי מיד create_reminder.
`;

// --- שליפת הזמנות ללוח המעוצב (דף פנימי) ---
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

// --- ניהול הודעות (זיכרון נועה החדשה) ---
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

// --- המוח של נועה המשוכפלת (Gemini 3) ---
export async function askNoaPersonalized(message: string, userKey: string, history: any[]) {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      systemInstruction: noaSystemInstruction + `\nהמשתמש הנוכחי הוא: ${userKey}.`
    });

    // המרת היסטוריה לפורמט Parts תקין (גמיש לכל סוגי האובייקטים)
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
  } catch (err: any) {
    console.error("Gemini 3 Error:", err);
    return { 
      text: `אחי, נועה המשוכפלת נתקלה בשגיאה: ${err.message || 'תקלת תקשורת'}.`, 
      audioContent: "" 
    };
  }
}
