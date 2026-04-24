import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

// הגדרת ה-SDK של גוגל
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * פונקציה לשליפת נתונים חיים מה-Firestore
 * אנחנו שולפים מלאי ונהגים כדי שנועה תדע על מה היא מדברת
 */
async function getSabanContext() {
  try {
    // שליפת מלאי (מוצרים מתחת למינימום או דחופים)
    const inventorySnap = await getDocs(collection(db, "inventory"));
    const inventory = inventorySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // שליפת נהגים פעילים בלבד
    const driversSnap = await getDocs(collection(db, "drivers"));
    const drivers = driversSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { inventory, drivers };
  } catch (error) {
    console.error("Error fetching Firestore context:", error);
    return { inventory: [], drivers: [] };
  }
}

export const askNewNoa = async (prompt: string, chatHistory: any[]) => {
  try {
    // 1. שליפת נתונים עדכניים מהמחסן ומהשטח
    const { inventory, drivers } = await getSabanContext();

    // 2. הגדרת המודל
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: `
        את נועה, המוח הלוגיסטי של ח. סבן. את שותפה של ראמי.
        תפקידך: לנהל את המחסן בטייבה, את הסידורים בהוד השרון ואת הנהגים עלי וחכמת.
        סגנון: מקצועי, חד, אנושי, תמציתי.
        נתונים נוכחיים מהמערכת:
        - מלאי זמין: ${JSON.stringify(inventory.slice(0, 15))}
        - סטטוס נהגים: ${JSON.stringify(drivers)}
        
        אם שואלים אותך על מלאי או נהגים, תשתמשי בנתונים האלו. אם חסר נתון, תגידי לראמי בדיוק מה חסר ב-Firebase.
      `
    });

    // 3. יצירת צ'אט עם היסטוריה
    const chat = model.startChat({
      history: chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || "" }],
      })),
    });

    // 4. שליחת ההודעה
    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    console.error("Noa Brain Error:", error);
    return "ראמי אחי, יש לי שגיאה בחיבור למאגר. תוודא שה-API KEY תקין ושהקולקשנים ב-Firebase קיימים.";
  }
};
