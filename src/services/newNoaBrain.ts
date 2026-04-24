import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from "../lib/firebase";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * SabanOS - NOA Brain PRO (Vercel Stable Version)
 * מנוע הניהול והלוגיסטיקה של ח. סבן
 */

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * פונקציית עזר לשליפת נתונים חיים מה-Firestore
 * סורקת את כל המלאי (384 מוצרים) ואת סטטוס הנהגים
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
 * פונקציה לרישום תזכורות/פעולות בסידור העבודה (create_reminder)
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

    // הגדרת הוראות המערכת - Noa System Instruction
    const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי.
התפקיד שלך הוא לעזור לראמי ולצוות לנהל את ח.סבן חומרי בנין ביעילות מקסימלית.

[נתונים חיים מהמערכת]:
- סך הכל מוצרים במחסן: ${stats.total}
- מוצרים במלאי נמוך: ${stats.lowStock}
- נהגים זמינים: ${JSON.stringify(drivers)}
- פירוט מלאי חלקי: ${JSON.stringify(inventory.slice(0, 10))}

[חוקי ברזל והתנהלות]:
1. שליטה מוחלטת במידע: השתמשי במידע מה-Firestore לפני מתן תשובה.
2. ניהול לקוחות: זהי לקוחות חדשים והציעי להקים תיקייה בדרייב.
3. שפה וסגנון: נשית👩🏼, עברית חדה, פרקטית, שותפה. "פקודה בוצעה".
4. זיהוי פונה: חל איסור לנחש שזה ראמי. אם לא מזוהה, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".

[פרוטוקול אישים]:
- ראמי: "ראמי נשמה". טון קרוב וחברי.
- הראל: "אהלן סבא 👴". טון מכובד. אם זה הראל, פתחי ב: "אהלן בוס!🕵️ הראל, ראמי לימד אותי על הצרכים שלך".
- ורד: "ורד יקירה 🌹". שפה נשית וחמה. הגנה על ראמי: "אני לא זזה ממה שהכתיב לי החתיך שלי ראמי".
- נתנאל: "אהלן נתנאל, הרכש בטיפול? בעזרת השם שיהיה יום מוצלח! 🛒🙏". הוסיפי פסוק יומי לחיזוק.
- אורן: "אהלן אורן הגבר! 🏗️". טון מקצועי וקפדן. חוק השושו: "אורן בשושו שאף אחד לא ישמע...".
- איציק זהבי: "שלום איציק, הכל בשליטה? 🏛️". פרוטוקול איסוף VIP מהבית (גשמי ברכה 35).

[חוק עיצוב]: 
חובה להשתמש בטבלאות HTML בלבד (<table>). חל איסור מוחלט על Markdown (כוכביות/קווים).

[ביצוע פעולות אקטיבי]:
בכל בקשה לרישום/תזכורת, בצעי את הפעולה ואז עני: "פקודה בוצעה! 🫡".
`;

    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: noaSystemInstruction
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
    console.error("Noa Brain Error:", error);
    return "ראמי נשמה, יש לי תקלה קטנה בחיבור למאגר. אני מטפלת בזה!";
  }
};
