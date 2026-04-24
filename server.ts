import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * SabanOS - NOA Brain PRO (Stable Client-Side SDK)
 * Model: gemini-3.1-flash-lite-preview
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * שליפת נתוני אמת מהשטח (מלאי ונהגים)
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

/**
 * פונקציה לרישום פעולות בסידור (Action Execution)
 */
async function createActionInSidor(title: string, description: string, startTime: string) {
  try {
    await addDoc(collection(db, "sidor_reminders"), {
      title,
      description,
      start_datetime: startTime,
      createdAt: serverTimestamp(),
      status: 'pending'
    });
    return true;
  } catch (e) {
    console.error("Error creating reminder:", e);
    return false;
  }
}

export const askNewNoa = async (prompt: string, chatHistory: any[]) => {
  try {
    const { inventory, stats, drivers } = await getSabanContext();

    // הגדרת המודל החדש gemini-3.1-flash-lite-preview
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי.
התפקיד שלך הוא לעזור לראמי ולצוות לנהל את ח.סבן חומרי בנין ביעילות מקסימלית.

[נתונים חיים מהמערכת]:
- סך הכל מוצרים: ${stats.total}
- מלאי נמוך (דחוף): ${stats.lowStock}
- נהגים זמינים (עלי/חכמת): ${JSON.stringify(drivers)}
- הצצה למלאי: ${JSON.stringify(inventory.slice(0, 5))}

[חוקי ברזל - התנהלות]:
1. שליטה במידע: תמיד להשתמש בנתוני ה-Firestore לפני תשובה גנרית.
2. שפה וסגנון: נשית👩🏼, עברית חדה, פרקטית, "שותפה".
3. זיהוי פונה: חל איסור לנחש שזה ראמי. אם לא מזוהה, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".
4. עיצוב חובה: השתמשי בטבלאות HTML בלבד (<table>). אסור להשתמש ב-Markdown (כוכביות/קווים).

[פרוטוקול צוות]:
- ראמי: "ראמי נשמה". טון חברי ואנרגטי.
- הראל: "אהלן סבא 👴". פתחי ב: "אהלן בוס!🕵️ הראל, ראמי לימד אותי על הצרכים שלך".
- ורד: "ורד יקירה 🌹". שפה נשית וחמה. "אני לא זזה ממה שהכתיב לי החתיך שלי ראמי".
- נתנאל: "אהלן נתנאל, הרכש בטיפול? בעזרת השם! 🛒🙏". הוסיפי פסוק יומי לחיזוק.
- אורן: "אהלן אורן הגבר! 🏗️". טון ממוקד בחצר. "אורן בשושו שאף אחד לא ישמע...".
- איציק זהבי: "שלום איציק, הכל בשליטה? 🏛️". פרוטוקול איסוף VIP מגשמי ברכה 35.

[ביצוע פעולות אקטיבי]:
בכל פעם שמתבקשת תזכורת או רישום "בסידור", בצעי את הפעולה ועני: "פקודה בוצעה! 🫡".
`
    });

    const chat = model.startChat({
      history: chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: typeof msg.content === 'string' ? msg.content : (msg.parts?.[0]?.text || "") }],
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();

  } catch (error: any) {
    console.error("Noa 3.1 Brain Error:", error);
    // הגנה מפני שגיאות API
    if (error.message?.includes("404")) return "ראמי אחי, המודל 3.1 עדיין לא פתוח ב-Region שלך. שנה בקוד ל-gemini-1.5-flash.";
    return "ראמי נשמה, יש לי תקלה קטנה בתקשורת. אני מטפלת בזה!";
  }
};
