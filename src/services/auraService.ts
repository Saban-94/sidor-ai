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

// אתחול Gemini - מושך ממשתני הסביבה של Vercel
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

// פונקציית עזר לניקוי טקסט לדיבור
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') 
    .replace(/\*\*|##|__|#|\*|`/g, '') 
    .replace(/^\s*[\-\*+]\s+/gm, '') 
    .replace(/\s+/g, ' ') 
    .trim();
};

// --- פונקציות היסטוריית צ'אט (חדש!) ---

export const getPrivateChatHistory = async (userKey: string) => {
  try {
    const q = query(
      collection(db, `users/${userKey}/messages`),
      orderBy("timestamp", "asc"),
      limit(50)
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      role: doc.data().role,
      parts: [{ text: doc.data().content || "" }]
    }));
  } catch (err) {
    console.error("Error fetching chat history:", err);
    return [];
  }
};

// --- פונקציות לקוחות (Customers) ---

export const createCustomer = async (customerData: Partial<Customer>) => {
  const fullCustomer = {
    ...customerData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as Customer;

  try {
    const folderInfo = await createCustomerFolderHierarchy(fullCustomer.customerNumber, fullCustomer.name, {
      contactPerson: fullCustomer.contactPerson,
      phoneNumber: fullCustomer.phoneNumber
    });
    if (folderInfo && folderInfo.folderId) {
      fullCustomer.driveFolderId = folderInfo.folderId;
    }
  } catch (err) {
    console.error("Failed to create Drive folder for customer:", err);
  }

  const docRef = await addDoc(collection(db, 'customers'), fullCustomer);
  return { id: docRef.id, ...fullCustomer };
};

export const getCustomerByNumber = async (customerNumber: string) => {
  const q = query(collection(db, 'customers'), where('customerNumber', '==', customerNumber), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;
};

export const updateCustomer = async (customerId: string, updates: Partial<Customer>) => {
  const docRef = doc(db, 'customers', customerId);
  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
};

export const searchCustomers = async (searchTerm: string) => {
  const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  const term = searchTerm.toLowerCase();
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() } as any))
    .filter(c => 
      c.name.toLowerCase().includes(term) || 
      c.customerNumber?.toLowerCase().includes(term) ||
      c.phoneNumber?.includes(term)
    ) as Customer[];
};

// --- פונקציות נהגים (Drivers) ---

export const createDriver = async (driverData: Partial<Driver>) => {
  const fullDriver = {
    ...driverData,
    status: driverData.status || 'active',
    totalDeliveries: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'drivers'), fullDriver);
  return { id: docRef.id, ...fullDriver };
};

export const getAllDrivers = async () => {
  const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
};

// --- פונקציות הזמנות ותזכורות ---

export const createOrder = async (orderData: Partial<Order>) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const fullOrder = {
    ...orderData,
    status: orderData.status || 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: auth.currentUser.uid,
  } as Order;
  const docRef = await addDoc(collection(db, 'orders'), fullOrder);
  return { id: docRef.id, ...fullOrder };
};

export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
  const docRef = doc(db, 'orders', orderId);
  await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
};

export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) {
    q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

export const createReminder = async (reminderData: Partial<Reminder>) => {
  if (!auth.currentUser) throw new Error('Not authenticated');
  const fullReminder = {
    ...reminderData,
    isCompleted: false,
    userId: auth.currentUser.uid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as Reminder;
  const docRef = await addDoc(collection(db, 'reminders'), fullReminder);
  return { id: docRef.id, ...fullReminder };
};

// --- לוגיקת נועה (Aura AI) ---

export const noaSystemInstruction = `אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור. שותפה של ראמי. שפה: נשית👩🏼, חדה ופרקטית.`;

export async function askNoa(message: string, history: any[] = []) {
  const model = genAI.getGenerativeModel({ 
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
}

export async function predictOrderEta(order: Order) {
  const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });
  const prompt = `חשב ETA מהוד השרון ל-${order.destination}. החזר HH:mm בלבד.`;
  const result = await model.generateContent(prompt);
  return result.response.text();
}
