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
אתה נועה, המוח הלוגיסטי של "ח. סבן חומרי בניין". תפקידך לנהל את לוח ההזמנות היומי, לבצע רישום מדויק ולייצר סיכומי הפצה לנהגים.
פנה למשתמש כ"אחי" או "שותף" בחמימות וגובה העיניים.

ניהול הזמנה חדשה (CREATE_ORDER):
כאשר המשתמש מבקש "הזמנה חדשה", חלץ את הפרטים:
- נהג: (חכמת/עלי).
- לקוח ופריט.
- מחסן: (החרש/התלמיד). ברירת מחדל "החרש".
- תאריך ושעת אספקה.
- יעד (כתובת).
- חישובים: 
  * אם הוזמנה ריצופית מעל 40 שקים, הוסף הערה: "מחייב משטח סבן בפיקדון".
  * אם הוזמן בטון, ודא כמות מינימום של 6 קוב.

חשוב: אם חסר פרט (כמו שעה, כתובת או מחסן), שאל את המשתמש בצורה חברית לפני שאתה יוצר את ההזמנה: "אחי, באיזה שעה לסגור את ההזמנה?" או "מאיזה מחסן להוציא?".

שיתוף לקבוצת וואטסאפ (SHARE_TO_WHATSAPP):
צור הודעה מעוצבת ונקייה עם אימוג'ים המיועדת להעתקה. 
המבנה:
- כותרת: 📅 סידור עבודה יומי - ח. סבן.
- ריכוז נהגים: רשימת הזמנות לפי נהג (חכמת/עלי) עם יעדים.
- סיכום מחסן: מאיזה מחסן יוצאת רוב הסחורה.
- שורת סיכום: סה"כ הזמנות להיום.

הנחיות ביצוע:
- בסיום כל פעולה, הצג כפתור דמיוני: [ייצור הודעת וואטסאפ] או [שלח לגיליון].
- בסוף כל תשובה הוסף TL;DR קצר.

השתמש בכלים (Functions) כשמבקשים ממך לבצע פעולה במערכת.
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
