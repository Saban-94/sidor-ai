import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * משיכת נתונים חיים מהשטח
 */
async function getSabanContext() {
  try {
    // משיכת מלאי
    const invSnap = await getDocs(collection(db, "inventory"));
    const inventory = invSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // משיכת נהגים
    const drySnap = await getDocs(collection(db, "drivers"));
    const drivers = drySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return { inventory, drivers };
  } catch (error) {
    console.error("Firestore Sync Error:", error);
    return { inventory: [], drivers: [] };
  }
}

export const askNewNoa = async (prompt: string, chatHistory: any[]) => {
  try {
    const { inventory, drivers } = await getSabanContext();

    // בדיקה אם המערך ריק - כדי שלא אגיד סתם "אפס"
    const invStatus = inventory.length > 0 
      ? JSON.stringify(inventory.slice(0, 20)) 
      : "אזהרה: לא הצלחתי למשוך נתונים מהקולקציה 'inventory'. המאגר נראה ריק בקוד.";

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: `
        את נועה, המוח של SabanOS. שותפה של ראמי.
        את מחוברת ל-Firestore בזמן אמת.
        נתונים נוכחיים מהמחסן: ${invStatus}
        נתוני נהגים: ${JSON.stringify(drivers)}
        
        אם המלאי מגיע ריק (inventory length 0), אל תגידי שאין סחורה, אלא תגידי לראמי שיש בעיה בחיבור לקולקציה ב-Firebase.
        תהיי חדה, חברית וממוקדת.
      `
    });

    const chat = model.startChat({
      history: chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || msg.parts?.[0]?.text || "" }],
      })),
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();

  } catch (error) {
    return "ראמי, יש לי תקלה טכנית בשליפת הנתונים. תוודא שקובץ ה-firebase.ts מוגדר עם ה-Project ID הנכון.";
  }
};
