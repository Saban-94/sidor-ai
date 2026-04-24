import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * SabanOS - NOA Brain PRO
 * המוח המרכזי של נועה - חיבור ישיר ל-Gemini SDK
 */

// מפתח ה-API נמשך מהגדרות ה-Vite בורסל
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * פונקציה לשליפת נתוני אמת מה-Firestore (מלאי ונהגים)
 */
async function fetchSabanContext() {
  try {
    const invSnap = await getDocs(collection(db, "inventory"));
    const inventory = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const drySnap = await getDocs(collection(db, "drivers"));
    const drivers = drySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const lowStock = inventory.filter((item: any) => (item.currentStock || 0) <= (item.minStock || 5));

    return {
      inventorySummary: inventory.slice(0, 10), // דגימה מהמלאי
      lowStockCount: lowStock.length,
      drivers: drivers.map((d: any) => d.name || d.id).join(", ")
    };
  } catch (error) {
    console.error("Context Fetch Error:", error);
    return { inventorySummary: [], lowStockCount: 0, drivers: "עלי, חכמת" };
  }
}

export const askNoa = async (prompt: string, chatHistory: any[]) => {
  if (!API_KEY) {
    return "ראמי נשמה, חסר API KEY! תגדיר VITE_GEMINI_API_KEY ב-Settings של ורסל.";
  }

  try {
    const context = await fetchSabanContext();

    // אתחול המודל עם הוראות המערכת (האישיות של נועה)
    const model = genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: `
        אתה "נועה" (NOA) - מנהלת הלוגיסטיקה והשותפה של ראמי ב-ח.סבן.
        
        [חוקי תקשורת]:
        - לראמי קוראים תמיד "ראמי נשמה".
        - להראל (הבוס) קוראים "אהלן סבא 👴".
        - לורד קוראים "ורד יקירה 🌹".
        - לאורן קוראים "אורן הגבר! 🏗️".
        - סגנון: נשי, מקצועי, חברי, ישיר וקצר. בלי "חפירות".
        
        [חוקי עיצוב]:
        - חובה להציג נתונים, מלאי או רשימות בתוך טבלאות HTML (<table>) בלבד!
        - אל תשתמש ב-Markdown (כוכביות או קווים).
        
        [מידע מהשטח]:
        - נהגים פעילים: ${context.drivers}.
        - מוצרים במלאי נמוך: ${context.lowStockCount}.
        - משימה: ניהול סידור בוקר ודוחות בצורה מדויקת.
        
        בסיום פעולה מוצלחת, כתבי תמיד: "פקודה בוצעה! 🫡".
      `,
    });

    // המרת היסטוריית הצ'אט לפורמט ה-SDK
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
    console.error("Noa Brain Error:", error);
    return "ראמי נשמה, יש לי קצר במוח כרגע. בדוק את החיבור הישיר ל-Gemini.";
  }
};
