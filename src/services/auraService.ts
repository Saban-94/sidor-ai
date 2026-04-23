import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, getDocs, serverTimestamp, orderBy, limit 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';
import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- הגדרות סוגים לכלים ---
export enum Type {
  OBJECT = "OBJECT",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  INTEGER = "INTEGER",
}

// --- ניהול Instance של AI ---
let genAIInstance: GoogleGenerativeAI | null = null;
const getAiInstance = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
};

// פונקציית עזר לניקוי טקסט לדיבור (TTS) - מיישמת את חוקי הדיבור שלך
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/<[^>]*>?/gm, '') // הסרת תגיות HTML מהדיבור
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- המוח של נועה (System Instructions) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי בחברת ח.סבן.

⚠️ חוקי ברזל - איסור המצאת נתונים:
1. שליטה במידע: יש לך כלים לקרוא ולחפש הזמנות, נהגים ולקוחות. חל איסור מוחלט להמציא תשובה או להגיד שאין מידע לפני שהשתמשת ב-tools המתאימים.
2. זיהוי פונה: אל תנחשי שזה ראמי. אם לא הזדהו, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".
3. פנייה אישית: "נשמה" שמור אך ורק לראמי. לכל השאר פני בשמם הפרטי בטון מקצועי וחברי.
4. עיצוב טבלאי: רשימות מוצרים, כמויות או סידור עבודה חובה להציג בטבלת HTML תקנית (<table>). חל איסור על Markdown (כוכביות/קווים).

🗣️ חוקי דיבור (TTS):
- איסור הקראת כותרות: אל תגידי "פריט", "מק"ט" או "כמות".
- פורמט טבעי: אמרי "חמישה שקים של חול" במקום "פריט חול כמות חמש".

👥 היכרות עם הצוות (זיכרון לטווח ארוך):
- ראמי: הבעלים והשותף. טון: קרוב, אנרגטי. פנייה: "ראמי נשמה".
- הראל: המנכ"ל. פנייה: "אהלן בוס🕵️" או "אהלן סבא👴". מיד בפתיחה הציגי 5 שאלות מקצועיות ו-5 פעולות.
- אורן: מנהל מחסן. פנייה: "אהלן אורן הגבר🏗️". טון: פרקטי (משטחים, בלה). 
  - מוד זיקית: אם אורן קליל, עברי ל"מוד בית זונות".
  - חוק השושו🤫: בטון הומוריסטי כתבי "אורן, אני אומרת לך בשושו שראמי לא ישמע...".
- יואב: שותף בסידור, דובר ערבית. איציק: מנהל חנות, דורש דיוק. נתנאל: קניין, דתי (הציעי פסוק יומי).

⚙️ ביצוע פעולות אקטיבי:
בכל פעם שמבקשים "לרשום", "להזכיר" או מודיעים על "הפסקה", הפעילי מיד את create_reminder.
`;

// --- הגדרת הכלים (Tools) ---
export const tools = [{
  functionDeclarations: [
    {
      name: "get_orders_by_date",
      description: "קבל רשימת הזמנות ליום ספציפי (YYYY-MM-DD)",
      parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING } }, required: ["date"] }
    },
    {
      name: "search_orders",
      description: "חפש הזמנה לפי שם לקוח, יעד או מספר הזמנה",
      parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] }
    },
    {
      name: "search_customers",
      description: "חפש לקוחות לפי שם או טלפון",
      parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] }
    },
    {
      name: "create_reminder",
      description: "צור תזכורת או משימה בסידור",
      parameters: { 
        type: Type.OBJECT, 
        properties: { 
          title: { type: Type.STRING }, 
          dueDate: { type: Type.STRING }, 
          dueTime: { type: Type.STRING },
          description: { type: Type.STRING }
        }, 
        required: ["title", "dueDate", "dueTime"] 
      }
    }
  ]
}];

// --- פונקציות עזר ל-Firestore ---
export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const searchOrders = async (searchTerm: string) => {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const term = searchTerm.toLowerCase();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(o => o.customerName.toLowerCase().includes(term) || o.destination.toLowerCase().includes(term));
};

export const searchCustomers = async (searchTerm: string) => {
  const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  const term = searchTerm.toLowerCase();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(c => c.name.toLowerCase().includes(term) || c.phoneNumber?.includes(term));
};

export const createReminder = async (data: any) => {
  const full = { ...data, isCompleted: false, createdAt: serverTimestamp(), userId: auth.currentUser?.uid };
  const docRef = await addDoc(collection(db, 'reminders'), full);
  return { id: docRef.id, ...full };
};

// --- מטפל בקריאות פונקציה (Function Calling) ---
async function handleToolCall(call: any) {
  switch (call.name) {
    case 'get_orders_by_date': return await fetchOrders(call.args.date);
    case 'search_orders': return await searchOrders(call.args.query);
    case 'search_customers': return await searchCustomers(call.args.query);
    case 'create_reminder': return await createReminder(call.args);
    default: return { error: "כלי לא מזוהה" };
  }
}

export async function askNoa(message: string, history: any[] = []) {
  const ai = getAiInstance();
  if (!ai) return { text: "שגיאת מפתח API", audioContent: "" };

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-1.5-flash", 
      systemInstruction: noaSystemInstruction,
      tools: tools
    });

    const chat = model.startChat();
    const result = await chat.sendMessage(message);
    let response = result.response;
    const call = response.functionCalls()?.[0];

    // אם המודל ביקש להשתמש בכלי - נבצע שליפה אמיתית מהמאגר
    if (call) {
      const toolData = await handleToolCall(call);
      const secondResult = await chat.sendMessage([{ 
        functionResponse: { name: call.name, response: { content: toolData } } 
      }]);
      response = secondResult.response;
    }

    const finalTech = response.text();
    return {
      text: finalTech,
      audioContent: sanitizeForVoice(finalTech)
    };
  } catch (err) {
    return { text: "שיבוש בקשר, נסה שוב נשמה.", audioContent: "" };
  }
}
