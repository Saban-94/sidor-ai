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
  if (!apiKey) {
    console.error("❌ VITE_GEMINI_API_KEY missing");
    return null;
  }
  if (!genAIInstance) {
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
};

// פונקציית עזר לניקוי טקסט לדיבור
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') 
    .replace(/^\s*[\-\*+]\s+/gm, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- פונקציות Firestore (CRUD) ---

export const getPrivateChatHistory = async (userKey: string) => {
  try {
    const q = query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      role: doc.data().role,
      parts: [{ text: doc.data().content || "" }]
    }));
  } catch (err) { return []; }
};

export const createOrder = async (orderData: Partial<Order>) => {
  const fullOrder = { ...orderData, status: 'pending', createdAt: serverTimestamp() } as Order;
  const docRef = await addDoc(collection(db, 'orders'), fullOrder);
  return { id: docRef.id, ...fullOrder };
};

export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
};

export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

export const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
  const docRef = doc(db, 'drivers', driverId);
  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
};

export const createReminder = async (reminderData: Partial<Reminder>) => {
  const fullReminder = { ...reminderData, isCompleted: false, createdAt: serverTimestamp() } as Reminder;
  const docRef = await addDoc(collection(db, 'reminders'), fullReminder);
  return { id: docRef.id, ...fullReminder };
};

// --- לוגיקת נועה AI ---

export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת הלוגיסטיקה של ח.סבן. שותפה של ראמי. 
שפה: נשית, עברית חדה, פרקטית. חוק ברזל: טבלאות HTML בלבד למוצרים.
`;

export const tools = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description: "צור הזמנה חדשה",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            customerName: { type: Type.STRING },
            items: { type: Type.STRING }
          },
          required: ["date", "customerName", "items"]
        }
      }
    ]
  }
];

export async function askNoa(message: string, history: any[] = []) {
  const ai = getAiInstance();
  if (!ai) return { text: "שגיאת מפתח API", audioContent: "" };

  try {
    const model = ai.getGenerativeModel({ 
      model: "gemini-3-flash-preview", 
      systemInstruction: noaSystemInstruction 
    });

    const chat = model.startChat({
      history: (history || []).map(h => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: [{ text: h.parts?.[0]?.text || h.text || "" }]
      })).filter(h => h.parts[0].text !== "")
    });

    const result = await chat.sendMessage(message);
    const responseText = result.response.text();

    return {
      text: responseText,
      audioContent: sanitizeForVoice(responseText)
    };
  } catch (err) {
    console.error(err);
    return { text: "תקלה בתקשורת עם נועה", audioContent: "" };
  }
}

export async function predictOrderEta(order: Order) {
  const ai = getAiInstance();
  if (!ai) return "N/A";
  const model = ai.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent(`חשב ETA ל-${order.destination}`);
  return result.response.text();
}
