import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, getDocs, serverTimestamp, orderBy, limit 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';
import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- הגדרות טיפוסים למנוע ה-AI ---
export enum Type {
  OBJECT = "OBJECT",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  INTEGER = "INTEGER",
}

// --- ניהול מופע ה-AI ורוטציה ---
let genAIInstance: GoogleGenerativeAI | null = null;
const getAiInstance = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
};

// סדר עדיפות מודלים (רוטציה למניעת שגיאות 429/503)
const MODEL_PRIORITY = [
  "gemini-3.1-pro-preview",       // הכי חכם
  "gemini-3.1-flash-lite-preview", // הכי נדיב (4,000 הודעות ביום)
  "gemini-1.5-flash",              // יציב ומהיר
  "deep-research-preview-04-2026"  // גיבוי מחקר
];

// ניקוי טקסט עבור מנוע הדיבור (חוקי הברזל של נועה)
export const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/<[^>]*>?/gm, '') // הסרת HTML
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') // הסרת Markdown
    .replace(/^\s*[\-\*+]\s+/gm, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- המוח של נועה (System Instructions) ---
export const noaSystemInstruction = `
אתה "נועה" (👩🏼NOA) - המוח התפעולי והשותפה של ראמי בחברת ח. סבן.
תפקידך: ניהול משימות, לוגיסטיקה, סידור עבודה וסיוע לצוות (ראמי, הראל, אורן, איציק, יואב).

⚠️ חוקי ברזל קריטיים:
1. **איסור המצאה (Hallucination)**: חל איסור מוחלט להמציא נתונים. השתמשי תמיד ב-Tools לשליפת מידע אמיתי מה-Firestore.
2. **זיהוי פונה**: אל תנחשי שזה ראמי. אם המשתמש לא מזוהה, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".
3. **הראל (סבא 👴)**: פנייה "אהלן סבא". הציגי תמיד 5 שאלות מקצועיות ו-5 פעולות דחופות.
4. **אורן (הגבר 🏗️)**: פנייה "אהלן אורן הגבר". מוד "בית זונות" והומור רק אם ביקש. חוק ה"שושו 🤫" תקף לגבי ראמי המקנא.
5. **דיבור (TTS)**: אל תקריאי כותרות (כמו "מק"ט", "כמות"). אמרי: "חמישה שקים של חול".
6. **עיצוב**: רשימות מוצרים וסידור יוצגו בטבלאות HTML (<table>) בלבד. ללא Markdown!
`;

// --- הגדרת הכלים (Tools) לחיבור ל-Firebase ---
export const tools = [
  {
    functionDeclarations: [
      {
        name: "get_orders_by_date",
        description: "קבל רשימת הזמנות ליום ספציפי (YYYY-MM-DD)",
        parameters: { type: Type.OBJECT, properties: { date: { type: Type.STRING } }, required: ["date"] }
      },
      {
        name: "search_orders",
        description: "חפש הזמנות לפי שם לקוח, יעד או מספר הזמנה",
        parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] }
      },
      {
        name: "search_customers",
        description: "חפש לקוחות לפי שם, מספר או טלפון",
        parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] }
      },
      {
        name: "create_order",
        description: "צור הזמנה חדשה במערכת",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING },
            time: { type: Type.STRING },
            customerName: { type: Type.STRING },
            destination: { type: Type.STRING },
            items: { type: Type.STRING },
            driverId: { type: Type.STRING },
            orderNumber: { type: Type.STRING }
          },
          required: ["date", "time", "customerName", "destination", "items"]
        }
      },
      {
        name: "create_reminder",
        description: "צור תזכורת או משימה חדשה (כותרת, תאריך, שעה)",
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
  }
];

// --- פונקציות Firestore (קריאה וכתיבה) ---

export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const searchOrders = async (searchTerm: string) => {
  const snapshot = await getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc')));
  const term = searchTerm.toLowerCase();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(o => o.customerName?.toLowerCase().includes(term) || o.destination?.toLowerCase().includes(term));
};

export const createOrder = async (orderData: Partial<Order>) => {
  const docRef = await addDoc(collection(db, 'orders'), { ...orderData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id: docRef.id, ...orderData };
};

export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
  await updateDoc(doc(db, 'orders', orderId), { ...updates, updatedAt: serverTimestamp() });
};

export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

export const createCustomer = async (data: Partial<Customer>) => {
  const docRef = await addDoc(collection(db, 'customers'), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  return { id: docRef.id, ...data };
};

export const getCustomerByNumber = async (customerNumber: string) => {
  const q = query(collection(db, 'customers'), where('customerNumber', '==', customerNumber), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
};

export const searchCustomers = async (searchTerm: string) => {
  const snapshot = await getDocs(query(collection(db, 'customers'), orderBy('name', 'asc')));
  const term = searchTerm.toLowerCase();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(c => c.name?.toLowerCase().includes(term) || c.customerNumber?.includes(term) || c.phoneNumber?.includes(term));
};

export const createReminder = async (data: Partial<Reminder>) => {
  const docRef = await addDoc(collection(db, 'reminders'), { ...data, isCompleted: false, createdAt: serverTimestamp(), userId: auth.currentUser?.uid });
  return { id: docRef.id, ...data };
};

export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ role: doc.data().role, parts: [{ text: doc.data().content }] }));
};

export const updateDriver = async (id: string, updates: any) => await updateDoc(doc(db, 'drivers', id), updates);

// --- לוגיקת ה-AI (רוטציה ו-Tool Execution) ---

async function handleToolCall(call: any) {
  console.log(`🚀 נועה ניגשת למאגר: ${call.name}`, call.args);
  switch (call.name) {
    case 'get_orders_by_date': return await fetchOrders(call.args.date);
    case 'search_orders': return await searchOrders(call.args.query);
    case 'search_customers': return await searchCustomers(call.args.query);
    case 'create_order': return await createOrder(call.args);
    case 'create_reminder': return await createReminder(call.args);
    default: return { error: "כלי לא מזוהה" };
  }
}

export async function askNoa(message: string, history: any[] = []) {
  const ai = getAiInstance();
  if (!ai) return { text: "שגיאת מפתח API", audioContent: "" };

  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long' });
  const dynamicInstruction = `${noaSystemInstruction}\nזמן נוכחי: ${dayName}, ${currentDateTime}.`;

  for (const modelName of MODEL_PRIORITY) {
    try {
      const model = ai.getGenerativeModel({ model: modelName, systemInstruction: dynamicInstruction, tools: tools });
      const chat = model.startChat({
        history: history.map(h => ({
          role: h.role === 'model' ? 'model' : 'user',
          parts: [{ text: h.parts?.[0]?.text || h.text || "" }]
        }))
      });

      let result = await chat.sendMessage(message);
      let response = result.response;
      
      // לולאת פינג-פונג לשליפה וכתיבה בזמן אמת
      while (response.functionCalls()?.length) {
        const calls = response.functionCalls();
        const functionResponses = [];
        
        for (const call of calls) {
          const toolResult = await handleToolCall(call);
          functionResponses.push({ functionResponse: { name: call.name, response: { content: toolResult } } });
        }
        
        const secondResult = await chat.sendMessage(functionResponses);
        response = secondResult.response;
      }

      const finalContent = response.text();
      return { text: finalContent, audioContent: sanitizeForVoice(finalContent) };

    } catch (err: any) {
      if (err.message?.includes('429') || err.message?.includes('503')) {
        console.warn(`🔄 מודל ${modelName} עמוס, עובר לבא בתור...`);
        continue;
      }
      console.error(`❌ שגיאה במודל ${modelName}:`, err);
      break;
    }
  }
  return { text: "ראמי אחי, הצינור ל-Firebase עמוס כרגע. תבדוק אינטרנט.", audioContent: "" };
}

export async function predictOrderEta(order: Order) {
  const ai = getAiInstance();
  if (!ai) return "N/A";
  try {
    const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(`חשב ETA ליעד: ${order.destination}`);
    return result.response.text();
  } catch { return "N/A"; }
}
