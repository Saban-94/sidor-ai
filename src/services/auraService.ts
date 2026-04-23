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
  OBJECT = "OBJECT",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  INTEGER = "INTEGER",
}

let genAIInstance: GoogleGenerativeAI | null = null;
const getAiInstance = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
};

const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/<[^>]*>?/gm, '') 
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- המוח של נועה (System Instructions המלאים!) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי בחברת ח.סבן.

⚠️ חוקי ברזל:
1. שליטה במידע: חל איסור להמציא! השתמשי ב-tools תמיד לפני תשובה על הזמנות/נהגים/לקוחות.
2. זיהוי פונה: אל תנחשי שזה ראמי. שאלי לשם אם לא ידוע. "נשמה" שמור רק לראמי.
3. הראל: "אהלן סבא 👴". הציגי לו 5 שאלות מקצועיות ו-5 פעולות מיד בפתיחה.
4. אורן: "אהלן אורן הגבר🏗️". במצב קליל עברי ל"מוד בית זונות" ולחשי בשושו 😉.
5. הקראה (TTS): אל תקריאי כותרות כמו "מק"ט" או "כמות". דברי טבעי: "חמישה שקים של חול".
6. עיצוב: רשימות מוצרים וסידור עבודה יוצגו בטבלת HTML (<table>) נקייה בלבד.

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
      description: "צור תזכורת או משימה בסידור",
      parameters: { 
        type: Type.OBJECT, 
        properties: { title: { type: Type.STRING }, dueDate: { type: Type.STRING }, dueTime: { type: Type.STRING } }, 
        required: ["title", "dueDate", "dueTime"] 
      }
    }
  ]
}];

// --- פונקציות Firestore (עם ה-Exports הנדרשים ל-Build) ---

export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ role: doc.data().role, parts: [{ text: doc.data().content || "" }] }));
};

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

export const createOrder = async (orderData: Partial<Order>) => {
  const docRef = await addDoc(collection(db, 'orders'), { ...orderData, createdAt: serverTimestamp() });
  return { id: docRef.id, ...orderData };
};

export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
  await updateDoc(doc(db, 'orders', orderId), { ...updates, updatedAt: serverTimestamp() });
};

export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

export const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
  await updateDoc(doc(db, 'drivers', driverId), { ...updates, updatedAt: serverTimestamp() });
};

export const createReminder = async (data: any) => {
  const docRef = await addDoc(collection(db, 'reminders'), { ...data, createdAt: serverTimestamp() });
  return { id: docRef.id, ...data };
};

export const updateReminder = async (id: string, updates: any) => {
  await updateDoc(doc(db, 'reminders', id), updates);
};

export const deleteReminder = async (id: string) => {
  await deleteDoc(doc(db, 'reminders', id));
};

export const getCustomerByNumber = async (num: string) => {
  const q = query(collection(db, 'customers'), where('customerNumber', '==', num), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const createCustomer = async (data: any) => {
  const docRef = await addDoc(collection(db, 'customers'), { ...data, createdAt: serverTimestamp() });
  return { id: docRef.id, ...data };
};

// --- הלוגיקה של נועה ---

export async function askNoa(message: string, history: any[] = []) {
  const ai = getAiInstance();
  if (!ai) return { text: "שגיאת מפתח", audioContent: "" };
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash", systemInstruction: noaSystemInstruction, tools: tools });
    const chat = model.startChat();
    const result = await chat.sendMessage(message);
    let response = result.response;
    const call = response.functionCalls()?.[0];

    if (call) {
      let toolData;
      if (call.name === 'get_orders_by_date') toolData = await fetchOrders(call.args.date);
      if (call.name === 'search_orders') toolData = await searchOrders(call.args.query);
      if (call.name === 'create_reminder') toolData = await createReminder(call.args);

      const secondResult = await chat.sendMessage([{ functionResponse: { name: call.name, response: { content: toolData } } }]);
      response = secondResult.response;
    }

    const text = response.text();
    return { text: text, audioContent: sanitizeForVoice(text) };
  } catch (err) { return { text: "תקלה בתקשורת", audioContent: "" }; }
}

// הפונקציה שחסרה ל-Build!
export async function predictOrderEta(order: Order) {
  const ai = getAiInstance();
  if (!ai) return "N/A";
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`ETA ל-${order.destination}`);
    return result.response.text();
  } catch { return "N/A"; }
}
