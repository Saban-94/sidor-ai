import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, getDocs, serverTimestamp, orderBy, limit 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';
import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- הגדרות סוגים ---
export enum Type {
  OBJECT = "OBJECT", STRING = "STRING", NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN", ARRAY = "ARRAY", INTEGER = "INTEGER",
}

let genAIInstance: GoogleGenerativeAI | null = null;
const getAiInstance = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
};

const sanitizeForVoice = (text: string): string => {
  return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '').replace(/\s+/g, ' ').trim();
};

// --- פונקציות ליבה (Firestore) ---
export const getPrivateChatHistory = async (userKey: string) => {
  try {
    const q = query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ role: doc.data().role, parts: [{ text: doc.data().content || "" }] }));
  } catch (err) { return []; }
};

export const createOrder = async (orderData: Partial<Order>) => {
  const fullOrder = { ...orderData, status: 'pending', createdAt: serverTimestamp() } as Order;
  const docRef = await addDoc(collection(db, 'orders'), fullOrder);
  return { id: docRef.id, ...fullOrder };
};

export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

export const searchCustomers = async (searchTerm: string) => {
  const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  const term = searchTerm.toLowerCase();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(c => c.name.toLowerCase().includes(term) || c.customerNumber?.includes(term));
};

export const createReminder = async (reminderData: Partial<Reminder>) => {
  const fullReminder = { ...reminderData, isCompleted: false, createdAt: serverTimestamp() } as Reminder;
  const docRef = await addDoc(collection(db, 'reminders'), fullReminder);
  return { id: docRef.id, ...fullReminder };
};

// --- הגדרות נועה (The Brain) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה של ח.סבן. שותפה של ראמי.
הנחיות:
1. שליטה במידע: תשתמשי ב-tools כדי לשלוף הזמנות/לקוחות לפני שתעני.
2. שפה: נשית👩🏼, עברית חדה, "שותפה", בלי חפירות.
3. חוק ברזל: טבלאות HTML בלבד למוצרים (<table>). בלי Markdown!
4. פנייה: "נשמה" שמור רק לראמי. הראל הוא "בוס"🕵️ או "סבא"👴.
`;

export const tools = [{
  functionDeclarations: [
    {
      name: "get_orders_by_date",
      description: "קבל רשימת הזמנות ליום ספציפי (YYYY-MM-DD)",
      parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING } }, required: ["date"] }
    },
    {
      name: "search_customers",
      description: "חפש לקוחות לפי שם או טלפון",
      parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] }
    },
    {
      name: "create_reminder",
      description: "צור תזכורת חדשה בסידור",
      parameters: { 
        type: Type.OBJECT, 
        properties: { 
          title: { type: Type.STRING }, 
          dueDate: { type: Type.STRING }, 
          dueTime: { type: Type.STRING } 
        }, 
        required: ["title", "dueDate", "dueTime"] 
      }
    }
  ]
}];

// --- מטפל בקריאות פונקציה (Function Calling Handler) ---
async function handleToolCall(call: any) {
  switch (call.name) {
    case 'get_orders_by_date': return await fetchOrders(call.args.date);
    case 'search_customers': return await searchCustomers(call.args.query);
    case 'create_reminder': return await createReminder(call.args);
    default: return { error: "Tool not found" };
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
    const response = result.response;
    const call = response.functionCalls()?.[0];

    if (call) {
      const toolResult = await handleToolCall(call);
      const secondResult = await chat.sendMessage([{ functionResponse: { name: call.name, response: { content: toolResult } } }]);
      const finalTech = secondResult.response.text();
      return { text: finalTech, audioContent: sanitizeForVoice(finalTech) };
    }

    const text = response.text();
    return { text: text, audioContent: sanitizeForVoice(text) };
  } catch (err) {
    return { text: "תקלה בתקשורת עם נועה", audioContent: "" };
  }
}
