import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, getDocs, serverTimestamp, orderBy, limit 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';
import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- הגדרות ---
export enum Type { OBJECT = "OBJECT", STRING = "STRING", NUMBER = "NUMBER" }

let genAIInstance: GoogleGenerativeAI | null = null;
const getAiInstance = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
};

const MODEL_PRIORITY = [
  "gemini-3.1-pro-preview", 
  "gemini-3.1-flash-lite-preview", 
  "gemini-1.5-flash"
];

const sanitizeForVoice = (text: string) => 
  text.replace(/<[^>]*>?/gm, '').replace(/[^\u0590-\u05FF0-9\s,.?!]/g, ' ').trim();

// --- המוח (System Instruction) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי בחברת ח.סבן.
1. איסור המצאה - חובה להשתמש ב-tools.
2. טבלאות HTML בלבד למוצרים (<table>).
3. "נשמה" שמור רק לראמי. הראל הוא בוס🕵️ או סבא👴.
`;

// --- Tools ---
export const tools = [{
  functionDeclarations: [
    { name: "get_orders_by_date", description: "רשימת הזמנות ליום (YYYY-MM-DD)", parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING } }, required: ["date"] } },
    { name: "search_orders", description: "חיפוש הזמנה לפי שם/יעד", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },
    { name: "search_customers", description: "חיפוש לקוח", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },
    { name: "create_reminder", description: "יצירת תזכורת", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, dueDate: { type: Type.STRING }, dueTime: { type: Type.STRING } }, required: ["title", "dueDate", "dueTime"] } }
  ]
}];

// --- Firestore Helpers (Exported for Build) ---

export const fetchOrders = async (date?: string) => {
  const q = date ? query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc')) : query(collection(db, 'orders'), orderBy('time', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const searchOrders = async (searchTerm: string) => {
  const snap = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const term = searchTerm.toLowerCase();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(o => o.customerName.toLowerCase().includes(term) || o.destination.toLowerCase().includes(term));
};

export const searchCustomers = async (term: string) => {
  const snap = await getDocs(query(collection(db, 'customers'), orderBy('name', 'asc')));
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(c => c.name.toLowerCase().includes(term.toLowerCase()));
};

export const createOrder = async (orderData: Partial<Order>) => {
  const docRef = await addDoc(collection(db, 'orders'), { ...orderData, createdAt: serverTimestamp() });
  return { id: docRef.id, ...orderData };
};

export const updateOrder = async (id: string, updates: Partial<Order>) => {
  await updateDoc(doc(db, 'orders', id), { ...updates, updatedAt: serverTimestamp() });
};

export const deleteOrder = async (id: string) => {
  await deleteDoc(doc(db, 'orders', id));
};

export const updateDriver = async (id: string, updates: Partial<Driver>) => {
  await updateDoc(doc(db, 'drivers', id), { ...updates, updatedAt: serverTimestamp() });
};

export const getCustomerByNumber = async (num: string) => {
  const q = query(collection(db, 'customers'), where('customerNumber', '==', num), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

// התיקון הקריטי עבור DeliveryImport!
export const createCustomer = async (customerData: Partial<Customer>) => {
  const fullCustomer = { ...customerData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } as Customer;
  const docRef = await addDoc(collection(db, 'customers'), fullCustomer);
  return { id: docRef.id, ...fullCustomer };
};

export const createReminder = async (data: any) => {
  const docRef = await addDoc(collection(db, 'reminders'), { ...data, isCompleted: false, createdAt: serverTimestamp(), userId: auth.currentUser?.uid });
  return { id: docRef.id, ...data };
};

export const updateReminder = async (id: string, updates: any) => {
  await updateDoc(doc(db, 'reminders', id), { ...updates, updatedAt: serverTimestamp() });
};

export const deleteReminder = async (id: string) => {
  await deleteDoc(doc(db, 'reminders', id));
};

export const getPrivateChatHistory = async (userKey: string) => {
  const snap = await getDocs(query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50)));
  return snap.docs.map(doc => ({ role: doc.data().role, parts: [{ text: doc.data().content }] }));
};

// --- המנגנון שמחבר את ה-AI ל-DATABASE ---

async function handleToolCall(call: any) {
  switch (call.name) {
    case 'get_orders_by_date': return await fetchOrders(call.args.date);
    case 'search_orders': return await searchOrders(call.args.query);
    case 'search_customers': return await searchCustomers(call.args.query);
    case 'create_reminder': return await createReminder(call.args);
    default: return { error: "כלי לא נמצא" };
  }
}

export async function askNoa(message: string, history: any[] = []) {
  const ai = getAiInstance();
  if (!ai) return { text: "חסר מפתח API", audioContent: "" };

  for (const modelName of MODEL_PRIORITY) {
    try {
      const model = ai.getGenerativeModel({ model: modelName, systemInstruction: noaSystemInstruction, tools: tools });
      const chat = model.startChat({
        history: history.map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.parts?.[0]?.text || h.text || "" }] }))
      });

      let result = await chat.sendMessage(message);
      let response = result.response;
      
      while (response.functionCalls()?.length) {
        const calls = response.functionCalls();
        const functionResponses = [];
        for (const call of calls) {
          const data = await handleToolCall(call);
          functionResponses.push({ functionResponse: { name: call.name, response: { content: data } } });
        }
        const secondResult = await chat.sendMessage(functionResponses);
        response = secondResult.response;
      }

      const text = response.text();
      return { text, audioContent: sanitizeForVoice(text) };

    } catch (err: any) {
      if (err.message?.includes('429') || err.message?.includes('503')) continue;
      break;
    }
  }
  return { text: "נועה עמוסה כרגע, נסה שוב בעוד דקה.", audioContent: "" };
}

export async function predictOrderEta(order: Order) {
  const ai = getAiInstance();
  if (!ai) return "N/A";
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const res = await model.generateContent(`ETA ל-${order.destination}`);
    return res.response.text();
  } catch { return "N/A"; }
}
