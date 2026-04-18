// saban-94/sidor-ai/src/services/auraService.ts

import { GoogleGenerativeAI } from "@google/generative-ai";
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
import { db } from '../lib/firebase'; // ודא שהנתיב תואם למבנה הפרויקט שלך

// שימוש במשתנה סביבה של Vercel עבור ה-API Key
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || "");

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

// --- פונקציות בסיס נתונים Firebase ---

export const createOrder = async (orderData: Partial<Order>) => {
  const fullOrder = {
    ...orderData,
    status: orderData.status || 'pending',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
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

// --- הגדרת כלים עבור Gemini ---

export const tools = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description: "צור הזמנה חדשה במערכת ח. סבן",
        parameters: {
          type: "OBJECT",
          properties: {
            date: { type: "STRING", description: "תאריך האספקה (YYYY-MM-DD)" },
            time: { type: "STRING", description: "שעת האספקה (HH:mm)" },
            driverId: { type: "STRING", description: "מזהה הנהג (hikmat, ali)" },
            customerName: { type: "STRING", description: "שם הלקוח" },
            destination: { type: "STRING", description: "יעד האספקה" },
            items: { type: "STRING", description: "הפריטים והכמויות" },
            warehouse: { type: "STRING", description: "המחסן (החרש/התלמיד)" },
            status: { type: "STRING" }
          },
          required: ["date", "time", "driverId", "customerName", "destination", "items"]
        }
      }
    ]
  }
];

// --- פונקציית השיחה המרכזית ---

export const askNoa = async (message: string, history: any[] = []) => {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    systemInstruction: noaSystemInstruction,
    tools: tools as any
  });

  const chat = model.startChat({
    history: history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    })),
  });

  const result = await chat.sendMessage(message);
  return result.response;
};
