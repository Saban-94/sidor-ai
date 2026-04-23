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

// רוטציה חכמה למניעת ניתוקים
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
חוקי ברזל: 
1. איסור המצאה - חובה להשתמש ב-tools לשליפת נתונים אמיתיים.
2. טבלאות HTML בלבד למוצרים (<table>).
3. "נשמה" שמור רק לראמי. הראל הוא בוס🕵️ או סבא👴.
4. הקראה (TTS): אל תקריאי כותרות כמו "מק"ט". דברי טבעי.
`;

// --- Tools ---
export const tools = [{
  functionDeclarations: [
    { name: "get_orders_by_date", description: "רשימת הזמנות ליום (YYYY-MM-DD)", parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING } }, required: ["date"] } },
    { name: "search_orders", description: "חיפוש הזמנה לפי שם/יעד", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },
    { name: "search_customers", description: "חיפוש לקוח", parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] } },
    { name: "create_reminder", description: "יצירת תזכורת בסידור", parameters: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, dueDate: { type: Type.STRING }, dueTime: { type: Type.STRING } }, required: ["title", "dueDate", "dueTime"] } }
  ]
}];

// --- Firestore Helpers ---

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
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)).filter(c => c.name.includes(term));
};

export const createReminder = async (data: any) => {
  const docRef = await addDoc(collection(db, 'reminders'), { ...data, isCompleted: false, createdAt: serverTimestamp(), userId: auth.currentUser?.uid });
  return { id: docRef.id, ...data };
};

// Exports הנדרשים ל-Build
export const getPrivateChatHistory = async (u: string) => {
  const snap = await getDocs(query(collection(db, `users/${u}/messages`), orderBy("timestamp", "asc"), limit(50)));
  return snap.docs.map(doc => ({ role: doc.data().role, parts: [{ text: doc.data().content }] }));
};
export const createOrder = async (o: any) => {
  const docRef = await addDoc(collection(db, 'orders'), { ...o, createdAt: serverTimestamp() });
  return { id: docRef.id, ...o };
};
export const updateOrder = async (id: string, u: any) => await updateDoc(doc(db, 'orders', id), { ...u, updatedAt: serverTimestamp() });
export const deleteOrder = async (id: string) => await deleteDoc(doc(db, 'orders', id));
export const updateDriver = async (id: string, u: any) => await updateDoc(doc(db, 'drivers', id), u);
export const getCustomerByNumber = async (n: string) => {
  const snap = await getDocs(query(collection(db, 'customers'), where('customerNumber', '==', n), limit(1)));
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

// --- המנגנון שמחבר את ה-AI ל-DATABASE (מופיע פעם אחת בלבד!) ---
async function handleToolCall(call: any) {
  console.log(`🚀 נועה מפעילה כלי: ${call.name}`, call.args);
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
      
      // לולאת פינג-פונג לשליפת נתונים
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
      if (err.message?.includes('429') || err.message?.includes('503')) {
        console.warn(`🔄 מודל ${modelName} עמוס, עובר לבא בתור...`);
        continue;
      }
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
