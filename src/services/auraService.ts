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

// רשימת רוטציה: מהחכם ביותר לנדיב ביותר (גיבוי)
const MODEL_PRIORITY = [
  "gemini-3.1-pro-preview",       // הכי חכם (מכסה קטנה - 50 ביום)
  "gemini-3.1-flash-lite-preview", // הכי נדיב (4,000 ביום - מהיר בטירוף)
  "gemini-1.5-flash"              // המאבטח (הכי יציב בעולם)
];

// --- חוקי הדיבור (TTS) ---
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/<[^>]*>?/gm, '') // ניקוי HTML מהקול
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- המוח של נועה (System Instructions) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי בחברת ח.סבן.

⚠️ חוקי ברזל:
1. איסור המצאה: חל איסור מוחלט להמציא נתונים! השתמשי תמיד ב-tools לפני תשובה על הזמנות/נהגים/לקוחות.
2. זיהוי פונה: אל תנחשי שזה ראמי. שאלי לשם אם לא ידוע. "נשמה" שמור רק לראמי.
3. הראל (המנכ"ל): פנייה "אהלן סבא 👴". הציגי לו 5 שאלות מקצועיות ו-5 פעולות דחופות מיד בפתיחה.
4. אורן (מחסן): פנייה "אהלן אורן הגבר🏗️". בטון קליל עברי ל"מוד בית זונות" ולחשי ב"מוד שושו"🤫.
5. חוק הדיבור: אל תקריאי כותרות כמו "מק"ט" או "כמות". אמרי: "חמישה שקים של חול".
6. עיצוב: רשימות מוצרים וסידור עבודה יוצגו בטבלת HTML (<table>) נקייה בלבד. בלי Markdown!

[מונחים]: "סריקה", "שיוך להזמנה", "סידור עבודה", "תיקיית לקוח".
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
      description: "צור תזכורת או משימה בסידור (למשל: הפסקת צהריים, שיחה ללקוח)",
      parameters: { 
        type: Type.OBJECT, 
        properties: { title: { type: Type.STRING }, dueDate: { type: Type.STRING }, dueTime: { type: Type.STRING } }, 
        required: ["title", "dueDate", "dueTime"] 
      }
    }
  ]
}];

// --- פונקציות Firestore ---

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

// פונקציות תשתית שנדרשות על ידי App.tsx
export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ role: doc.data().role, parts: [{ text: doc.data().content || "" }] }));
};

export const updateOrder = async (id: string, updates: any) => await updateDoc(doc(db, 'orders', id), updates);
export const deleteOrder = async (id: string) => await deleteDoc(doc(db, 'orders', id));
export const updateDriver = async (id: string, updates: any) => await updateDoc(doc(db, 'drivers', id), updates);

// --- לוגיקת הרוטציה של נועה ---

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

  for (const modelName of MODEL_PRIORITY) {
    try {
      const model = ai.getGenerativeModel({ 
        model: modelName, 
        systemInstruction: noaSystemInstruction,
        tools: tools 
      });

      const chat = model.startChat();
      const result = await chat.sendMessage(message);
      let response = result.response;
      const call = response.functionCalls()?.[0];

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

    } catch (err: any) {
      if (err.message?.includes('429') || err.message?.includes('503') || err.message?.includes('quota')) {
        console.warn(`⚠️ מודל ${modelName} ברוטציה נכשל, עובר לבא בתור...`);
        continue;
      }
      console.error(`❌ שגיאה במודל ${modelName}:`, err);
      break;
    }
  }
  return { text: "ראמי נשמה, גוגל עמוסים בטירוף כרגע. נסה שוב עוד דקה.", audioContent: "" };
}

export async function predictOrderEta(order: Order) {
  const ai = getAiInstance();
  if (!ai) return "N/A";
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`ETA ל-${order.destination}`);
    return result.response.text();
  } catch { return "N/A"; }
}
