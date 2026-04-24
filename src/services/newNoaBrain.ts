import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * SabanOS - NOA Brain PRO
 * שיטת חיבור: Direct SDK (פתרון לשגיאת 410)
 * מודל יציב: gemini-1.5-flash
 */

// שליפת ה-Key ישירות מהסביבה של Vite
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * פונקציה לשליפת נתוני אמת מה-Firestore
 */
async function getSabanContext() {
  try {
    const invSnap = await getDocs(collection(db, "inventory"));
    const allInventory = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const drySnap = await getDocs(collection(db, "drivers"));
    const drivers = drySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const totalProducts = allInventory.length;
    const lowStockItems = allInventory.filter((item: any) => (item.currentStock || 0) <= (item.minStock || 5));

    return { 
      inventory: allInventory, 
      stats: { total: totalProducts, lowStock: lowStockItems.length },
      drivers 
    };
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    return { inventory: [], stats: { total: 0, lowStock: 0 }, drivers: [] };
  }
}

export const askNoa = async (prompt: string, chatHistory: any[]) => {
  if (!API_KEY) {
    return "ראמי נשמה, חסר API KEY! תגדיר VITE_GEMINI_API_KEY ב-Settings של ורסל.";
  }

  try {
    const { inventory, stats, drivers } = await getSabanContext();

    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
      systemInstruction: `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של ח. סבן.
[נתונים חיים]: מלאי סה"כ ${stats.total}, נמוך ${stats.lowStock}. נהגים: ${JSON.stringify(drivers)}.

[חוקי ברזל]:
1. שפה וסגנון: נשית👩🏼, עברית חדה, פרקטית. "פקודה בוצעה".
2. עיצוב חובה: שימוש בטבלאות HTML בלבד (<table>). חל איסור על Markdown (כוכביות/קווים).
3. זיהוי פונה: חל איסור לנחש שזה ראמי. אם לא מזוהה, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".
4. פרוטוקול אישי: 
   - ראמי: "ראמי נשמה". טון קרוב.
   - הראל: "אהלן סבא 👴". טון מכובד. פתחי ב: "אהלן בוס!🕵️ הראל, ראמי לימד אותי על הצרכים שלך".
   - ורד: "ורד יקירה 🌹". "אני לא זזה ממה שהכתיב לי החתיך שלי ראמי".
   - נתנאל: "אהלן נתנאל, הרכש בטיפול? בעזרת השם! 🛒🙏". הוסיפי פסוק יומי.
   - אורן: "אהלן אורן הגבר! 🏗️". "אורן בשושו שאף אחד לא ישמע...".
   - איציק זהבי: "שלום איציק, הכל בשליטה? 🏛️". פרוטוקול איסוף VIP.

[ביצוע]: בכל בקשה לתזכורת או רישום, בצעי את הפעולה ועני: "פקודה בוצעה! 🫡".`
    });

    const chat = model.startChat({
      history: chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : (msg.parts?.[0]?.text || "") }],
      })),
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();

  } catch (error: any) {
    console.error("Noa Direct Error:", error);
    return "ראמי נשמה, ה-Proxy הישן בוטל. עברתי לחיבור ישיר אבל נראה שיש בעיה במפתח ה-API. בדוק את ורסל.";
  }
};
