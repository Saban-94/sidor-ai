import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * SabanOS - NOA Brain PRO 
 * שיטת חיבור: Direct Client-Side SDK (עוקף שגיאת 410)
 * מודל: gemini-1.5-flash (הכי יציב לחיבור ישיר)
 */

// שליפת המפתח ישירות מה-Environment של ה-Frontend
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

export const askNewNoa = async (prompt: string, chatHistory: any[]) => {
  if (!API_KEY) {
    return "ראמי נשמה, חסר API KEY ב-Vercel. תוסיף VITE_GEMINI_API_KEY תחת Settings.";
  }

  try {
    const { inventory, stats, drivers } = await getSabanContext();

    // הגדרת המודל בחיבור ישיר
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי.
חוקי ברזל:
1. שפה: נשית👩🏼, עברית חדה, פרקטית. "פקודה בוצעה".
2. עיצוב: חובה להשתמש בטבלאות HTML בלבד (<table>). אסור Markdown.
3. זיהוי: לראמי קוראים "ראמי נשמה". להראל קוראים "אהלן סבא 👴".
4. נתונים: מלאי סה"כ ${stats.total}, נמוך ${stats.lowStock}. נהגים: ${JSON.stringify(drivers)}.
`
    });

    // המרת היסטוריה לפורמט של ה-SDK
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
    console.error("Noa Direct SDK Error:", error);
    return "ראמי, השרת הישן בוטל. עברתי לחיבור ישיר אבל נראה שיש בעיה במפתח ה-API.";
  }
};
