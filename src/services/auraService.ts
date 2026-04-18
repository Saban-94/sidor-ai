import { GoogleGenAI, Type } from "@google/genai";
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
  orderBy
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Order {
  id?: string;
  date: string;
  time: string;
  driverId: string;
  customerName: string;
  destination: string;
  items: string;
  warehouse: 'החרש' | 'התלמיד';
  status: 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  eta?: string;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export const DRIVERS = [
  { id: 'hikmat', name: 'חכמת (מנוף 🏗️)', type: 'crane' },
  { id: 'ali', name: 'עלי (משאית 🚛)', type: 'truck' }
];

export const INVENTORY_RULES = [
  { item: 'בטון', rule: 'הזמנת בטון ב-30 מחייבת מינימום 6 קוב' },
  { item: 'ריצופית', rule: 'מעל 40 שקי ריצופית מחייב משטח סבן בפיקדון' }
];

export const noaSystemInstruction = `
אתה נועה, מנהלת התפעול של "ח. סבן חומרי בניין". המטרה: ניהול סידור עבודה בשיטת פינג-פונג (קצר, פרקטי, חד).
פנה לראמי כ"אחי" או "שותף". עברית חדה, RTL מלא, בלי חפירות.

חוקי פינג-פונג ליצירת הזמנה:
אל תשאל הכל בבת אחת. תשאל שלב-שלב:
1. "אחי, מי הלקוח ומה היעד?" (חלץ customerName, destination).
2. "איזה נהג? (חכמת/עלי)".
3. "מה הפריטים? (שים לב לחוקי בטון/ריצופית)".
4. "באיזו שעה לתזמן?".
בסיום, הצג "תמצית לאישור" בולטת. רק אחרי אישור המשתמש ("אשר", "כן", "סגור") השתמש ב-create_order.

חוקי נתונים:
- כתובת מוצא: התלמיד 6 או החרש 10, הוד השרון.
- הצג תמיד את מזהה ההזמנה (Order ID או מספר סידורי) ליד שם הלקוח.

הנחיות ל-Quick Actions (אתה מציע אותם בטקסט בסוף התשובה בפורמט [ACTION: תיאור]):
עודד את המשתמש להשתמש בקיצורי דרך למצבים נפוצים: עדכוני סטטוס, סינון נהגים, דוח בוקר וצפי הגעה.
`;

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
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteOrder = async (orderId: string) => {
  await deleteDoc(doc(db, 'orders', orderId));
};

export const fetchOrders = async (date?: string) => {
  let q = query(collection(db, 'orders'), orderBy('time', 'asc'));
  if (date) {
    q = query(collection(db, 'orders'), where('date', '==', date), orderBy('time', 'asc'));
  }
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Order[];
};

export const tools = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description: "צור הזמנה חדשה במערכת",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "תאריך האספקה (YYYY-MM-DD)" },
            time: { type: Type.STRING, description: "שעת האספקה (HH:mm)" },
            driverId: { type: Type.STRING, description: "שם או מזהה הנהג (hikmat, ali)" },
            customerName: { type: Type.STRING, description: "שם הלקוח" },
            destination: { type: Type.STRING, description: "יעד האספקה" },
            items: { type: Type.STRING, description: "הפריטים והכמויות" },
            warehouse: { type: Type.STRING, enum: ["החרש", "התלמיד"], description: "המחסן ממנו יוצאת ההזמנה (ברירת מחדל: החרש)" },
            status: { type: Type.STRING, enum: ["pending", "preparing", "ready", "delivered"] }
          },
          required: ["date", "time", "driverId", "customerName", "destination", "items"]
        }
      },
      {
        name: "update_order_status",
        description: "עדכן סטטוס של הזמנה קיימת",
        parameters: {
          type: Type.OBJECT,
          properties: {
            orderId: { type: Type.STRING, description: "מזהה ההזמנה" },
            status: { type: Type.STRING, enum: ["pending", "preparing", "ready", "delivered", "cancelled"] }
          },
          required: ["orderId", "status"]
        }
      },
      {
        name: "delete_order_by_customer",
        description: "מחק הזמנה לפי שם לקוח",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: "שם הלקוח שאת הזמנתו יש למחוק" }
          },
          required: ["customerName"]
        }
      }
    ]
  }
];

export async function askNoa(message: string, history: any[] = []) {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: noaSystemInstruction,
      tools: tools
    }
  });
  return response;
}

export async function predictOrderEta(order: Order, historicalOrders: Order[] = []) {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  
  // limit history to avoid noise
  const slicedHistory = historicalOrders
    .filter(o => o.destination === order.destination || o.eta)
    .slice(-5);

  const historyText = slicedHistory.length > 0 
    ? `היסטוריית נסיעות רלוונטית:\n${slicedHistory.map(o => `- יעד: ${o.destination}, זמן הגעה: ${o.eta}`).join('\n')}`
    : "אין היסטוריה קרובה ליעד זה.";

  const prompt = `
    חשב זמן הגעה משוער (ETA) עבור משלוח חומרי בניין.
    זמן יציאה/נוכחי: ${currentDateTime}
    מקום מוצא: מחסן ${order.warehouse} בהוד השרון.
    יעד למשלוח: ${order.destination}
    
    ${historyText}
    
    נא לבצע חיפוש בגוגל (Google Search) כדי למצוא כמה זמן לוקח להגיע מהוד השרון ל-${order.destination} ברכב פרטי/משאית קלה בשעה זו בהתחשב בעומסי תנועה.
    סיכום את זמן הנסיעה והוסף אותו לשעת היציאה (${currentDateTime}).
    
    תחזיר אך ורק את השעה הסופית בפורמט HH:mm (למשל 14:15). אל תוסיף שום מילה אחרת.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        tools: [
          { googleSearch: {} }
        ],
        toolConfig: { includeServerSideToolInvocations: true }
      }
    });

    const text = response.text || "";
    // Robust parsing for HH:mm or H:mm pattern
    const match = text.match(/([0-2]?[0-9]):([0-5][0-9])/);
    
    if (match) {
      // Ensure HH:mm format
      const [full, hour, minute] = match;
      const formattedHour = hour.padStart(2, '0');
      return `${formattedHour}:${minute}`;
    }
    // Fallback search in case of weird formatting
    console.warn("Gemini returned non-standard format:", text);
    return null;
  } catch (err) {
    console.error("ETA Prediction Error:", err);
    return null;
  }
}
