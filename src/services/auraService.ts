import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  orderBy,
  limit 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';
import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GoogleGenerativeAI } from "@google/generative-ai";

// אתחול Gemini
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(API_KEY);

export enum Type {
  OBJECT = "OBJECT",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  INTEGER = "INTEGER",
}

const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') 
    .replace(/^\s*[\-\*+]\s+/gm, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- היסטוריית צ'אט ---
export const getPrivateChatHistory = async (userKey: string) => {
  try {
    const q = query(collection(db, `users/${userKey}/messages`), orderBy("timestamp", "asc"), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      role: doc.data().role,
      parts: [{ text: doc.data().content || "" }]
    }));
  } catch (err) {
    return [];
  }
};

// --- לקוחות ---
export const createCustomer = async (customerData: Partial<Customer>) => {
  const fullCustomer = { ...customerData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() } as Customer;
  const docRef = await addDoc(collection(db, 'customers'), fullCustomer);
  return { id: docRef.id, ...fullCustomer };
};

export const getCustomerByNumber = async (customerNumber: string) => {
  const q = query(collection(db, 'customers'), where('customerNumber', '==', customerNumber), limit(1));
  const snap = await getDocs(q);
  return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;
};

// --- נהגים ---
export const createDriver = async (driverData: Partial<Driver>) => {
  const fullDriver = { ...driverData, status: driverData.status || 'active', createdAt: serverTimestamp() };
  const docRef = await addDoc(collection(db, 'drivers'), fullDriver);
  return { id: docRef.id, ...fullDriver };
};

// הפונקציה שהייתה חסרה ל-Build!
export const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
  const docRef = doc(db, 'drivers', driverId);
  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
};

export const getAllDrivers = async () => {
  const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
};

// --- הזמנות ---
export const createOrder = async (orderData: Partial<Order>) => {
  const fullOrder = { ...orderData, status: 'pending', createdAt: serverTimestamp() } as Order;
  const docRef = await addDoc(collection(db, 'orders'), fullOrder);
  return { id: docRef.id, ...fullOrder };
};

export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
};

// הפונקציה שהייתה חסרה ל-Build!
export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

// --- תזכורות ---
export const createReminder = async (reminderData: Partial<Reminder>) => {
  const fullReminder = { ...reminderData, isCompleted: false, createdAt: serverTimestamp() } as Reminder;
  const docRef = await addDoc(collection(db, 'reminders'), fullReminder);
  return { id: docRef.id, ...fullReminder };
};

// --- נועה AI ---
export const noaSystemInstruction = `אתה נועה, עוזרת לוגיסטית חכמה. שפה נשית, עברית חדה.`;

export async function askNoa(message: string, history: any[] = []) {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview", systemInstruction: noaSystemInstruction });
  const chat = model.startChat({
    history: (history || []).map(h => ({ role: h.role === 'model' ? 'model' : 'user', parts: [{ text: h.parts?.[0]?.text || h.text || "" }] })).filter(h => h.parts[0].text !== "")
  });
  const result = await chat.sendMessage(message);
  const responseText = result.response.text();
  return { text: responseText, audioContent: sanitizeForVoice(responseText) };
}

export async function predictOrderEta(order: Order) {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const result = await model.generateContent(`ETA ל-${order.destination}`);
  return result.response.text();
}
