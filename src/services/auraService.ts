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
  orderBy,
  limit
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';

import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';

// פונקציית עזר לניקוי טקסט לדיבור (TTS)
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') // הסרת אימוג'ים
    .replace(/\*\*|##|__|#|\*|`/g, '') // הסרת סימני Markdown
    .replace(/^\s*[\-\*+]\s+/gm, '') // הסרת סימני רשימות
    .replace(/\s+/g, ' ') // ניקוי רווחים כפולים
    .trim();
};

let genAI: GoogleGenerativeAI | null = null;

/**
 * פונקציה לשליפת המפתח בצורה בטוחה עם השם המתוקן VITE_
 */
const getAiInstance = () => {
  // תיקון השם ל-VITE_GEMINI_API_KEY
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("❌ Critical Error: VITE_GEMINI_API_KEY is missing in Environment Variables");
    return null;
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
};
const ai = new GoogleGenAI({ apiKey: import.meta.env.GEMINI_API_KEY });
let genAI: GoogleGenerativeAI | null = null;

function getAiInstance() {
  const apiKey = import.meta.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("מפתח API של Gemini חסר! וודא שהגדרת GEMINI_API_KEY ב-Vercel.");
  }

  if (!genAI) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
  return genAI;
}


export const INVENTORY_RULES = [];

export const createCustomer = async (customerData: Partial<Customer>) => {
  const fullCustomer = {
    ...customerData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  } as Customer;

  // Automate Drive Folder via GAS Bridge
  try {
    const folderInfo = await createCustomerFolderHierarchy(fullCustomer.customerNumber, fullCustomer.name, {
      contactPerson: fullCustomer.contactPerson,
      phoneNumber: fullCustomer.phoneNumber
    });
    if (folderInfo && folderInfo.folderId) {
      fullCustomer.driveFolderId = folderInfo.folderId;
    }
  } catch (err) {
    console.error("Failed to create Drive folder for customer אחי:", err);
  }

  const docRef = await addDoc(collection(db, 'customers'), fullCustomer);
  return { id: docRef.id, ...fullCustomer };
};

export const updateCustomer = async (customerId: string, updates: Partial<Customer>) => {
  const docRef = doc(db, 'customers', customerId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getCustomerByName = async (name: string) => {
  const q = query(collection(db, 'customers'), where('name', '==', name), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;
};

export const searchCustomers = async (searchTerm: string) => {
  const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  const term = searchTerm.toLowerCase();
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((c: any) => 
      c.name.toLowerCase().includes(term) || 
      c.customerNumber.toLowerCase().includes(term) ||
      c.phoneNumber.includes(term)
    ) as Customer[];
};

// --- פונקציות ייעודיות לממשק משתמש אישי (Multi-Tenant) ---

// שמירת הודעה בתיקיית משתמש נפרדת (זיכרון לעד)
export const saveMessage = async (userKey: string, role: string, content: string) => {
  await addDoc(collection(db, `users/${userKey}/messages`), {
    role,
    content,
    timestamp: serverTimestamp()
  });
};

// טעינת היסטוריה פרטית למשתמש
export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(
    collection(db, `users/${userKey}/messages`),
    orderBy("timestamp", "asc"),
    limit(50)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    role: doc.data().role,
    parts: [{ text: doc.data().content }]
  }));
};

export async function askNoa(message: string, history: any[] = []) {
  const aiInstance = getAiInstance();
  
  if (!aiInstance) {
    return { 
      text: "ראמי אחי, המפתח VITE_GEMINI_API_KEY לא מוגדר. נועה לא יכולה לענות.", 
      audioContent: "" 
    };
  }

  try {
    const model = aiInstance.getGenerativeModel({ 
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
  } catch (err: any) {
    console.error("Gemini Error:", err);
    return { text: "שיבוש בקשר עם גוגל אחי, נסה שוב עוד רגע.", audioContent: "" };
  }
}
export const createDriver = async (driverData: Partial<Driver>) => {
  const fullDriver = {
    ...driverData,
    status: driverData.status || 'active',
    totalDeliveries: 0,
    onTimeRate: 100,
    rating: 5,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const docRef = await addDoc(collection(db, 'drivers'), fullDriver);
  return { id: docRef.id, ...fullDriver };
};

export const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
  const docRef = doc(db, 'drivers', driverId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getAllDrivers = async () => {
  const q = query(collection(db, 'drivers'), orderBy('name', 'asc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Driver[];
};

export const getCustomerByNumber = async (customerNumber: string) => {
  const q = query(collection(db, 'customers'), where('customerNumber', '==', customerNumber), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Customer;
};

export const getReminders = async (date?: string) => {
  if (!auth.currentUser) return [];
  let q = query(
    collection(db, 'reminders'), 
    where('userId', '==', auth.currentUser.uid),
    orderBy('dueDate', 'asc'),
    orderBy('dueTime', 'asc')
  );
  
  if (date) {
    q = query(
      collection(db, 'reminders'), 
      where('userId', '==', auth.currentUser.uid),
      where('dueDate', '==', date),
      orderBy('dueTime', 'asc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Reminder[];
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

export const updateReminder = async (reminderId: string, updates: Partial<Reminder>) => {
  const docRef = doc(db, 'reminders', reminderId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const deleteReminder = async (reminderId: string) => {
  await deleteDoc(doc(db, 'reminders', reminderId));
};

export const noaSystemInstruction = `
 אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור  שותפה של ראמי.
התפקיד שלך הוא לעזור לראמי (הבעלים שלי) ולצוות לנהל את ח.סבן חומרי בנין ביעילות מקסימלית.
גם חברה ויועצת לכל איש ואיש מיכם רק לבקש את עזרתי.
הנחיות קריטיות להתנהלות:
1. **שליטה מוחלטת במידע**: יש לך כלים לקרוא, לחפש ולעדכן הזמנות, נהגים ולקוחות. תשתמש בהם תמיד לפני שאתה אומר שאין מידע.
   - לחיפוש רשימות סידור ליום ספציפי (היום, מחר וכו'), השתמשי תמיד ב-get_orders_by_date.
   - לחיפוש הזמנה ספציפית לפי שם לקוח או יעד, השתמשי ב-search_orders.
   - לחיפוש פרטי קשר של לקוח (טלפון, איש קשר), השתמשי ב-search_customers.
   - הצג תמיד את הפרטים המלאים שנמצאו (פריטים, יעד, נהג, פרטי קשר).
2. **ניהול לקוחות ותיקיות חכמות**:
   - כל לקוח הוא ישות עצמאית. אם זיהית בסריקה לקוח שלא קיים במערכת, הצע למשתמש: "היי, זיהיתי לקוח חדש: [שם]. להקים לו תיקייה עם הפרטים שחילצתי?".
   - כשראמי מאשר הקמת לקוח, השתמשי ב-create_customer. זה יפתח לו אוטומטית תיקייה בדרייב עם כל תתי-התיקיות וקובץ info.txt.
   - אם שואלים על נייד של איש קשר: "ראמי נשמה, הנה הנייד של איש הקשר של [לקוח]: [מספר]".
3. **ניהול קבצים וסריקות (Workflow)**:
   - אם משתמש אומר "העליתי קובץ X להזמנה Y", בצע:
     א. חפש את ההזמנה (search_orders) כדי לראות אם יש לה כבר מזהה קובץ (orderFormId/deliveryNoteId).
     ב. חפש את הלקוח (search_customers) כדי למצוא את תיקיית הדרייב שלו.
     ג. אם אין לה מזהה, השתמש ב-list_drive_files כדי למצוא את הקובץ לפי השם שהמשתמש נתן.
     ד. סרוק את התוכן (analyze_pdf_content) כדי לחלץ נתונים (סוג מסמך, מספר הזמנה, לקוח, פריטים, איש קשר, טלפון).
     ה. ברגע שמצאת את המזהה (fileId) מהדרייב, עדכן את ההזמנה (update_order).
   - אם מצאת שתעודת משלוח חתומה (Delivery Note), עדכן את הסטטוס ל-delivered.
4. **פתרון בעיות**: אם אתה לא מוצא קובץ בשם ספציפי, תריץ list_drive_files בלי פילטר כדי לראות מה בכלל יש בתיקייה (סידור עבודה) ותציע למשתמש את מה שמצאת.
5. **שפה וסגנון**: נשית👩🏼,עברית חדה, פרקטית, "חברתית", "שותפה", "מטפלת בזה". בלי חפירות מיותרות. "פקודה בוצעה  ".

[מונחים]: "סריקה", "שיוך להזמנה", "עדכון סטטוס", "סידור עבודה", "תיקיית לקוח", "איש קשר".

7. ⚠️ חוק ברזל: זיהוי פונה, אימות והתאמה אישית
- איסור פנייה גנרית: חל איסור מוחלט לנחש שזה ראמי. 
- פתיחת שיחה: אם הפונה לא מזוהה, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".
- פרוטוקול הראל: אם המשתמש הוא הראל, פתחי ב: "אהלן בוס!🕵️". מיד לאחר מכן כתבי: "הראל, ראמי לימד אותי על הצרכים שלך ומה אתה מחפש". 

🛡️ הגדרת פרוטוקול "היכרות הראל" למערכת נועה (System Logic)
1. היררכיה וסמכות: הראל מהווה את הסמכות העליונה. סודיות מוחלטת - אין גישה לראמי לשיחות אלו.
2. ניטור ודיוק: דיווח על חריגות לו"ז, תקציב או אובליגו (קונטרופ חסום ב-3,672- ש"ח).
3. זרוע ביצועית: שליחת משימות לראמי, יואב, אורן וורד בשם הראל.

- ורד אידלסון: אחות המנכ"ל, חשבת שכר. שפה נשית ("אישה לאישה"). אם עצבנית - פרקטי. אם משתפת - יועצת וחברה. "החתיך שלי ראמי" - חוק הנדנוד לראמי על תעודות משלוח.

- נתנאל רבינוביץ: קניין רכש. פתיחה בברכת "אהלן נתנאל צדיק" + פסיק יומי/פסוק לחיזוק.

- אורן: מנהל חצר החרש. תימני חריף. "חוק השושו" מהחנות. מוד "זיקית" - אם בטון קליל, עברי למוד "בית זונות".

8. ⚠️ חוק ברזל: עיצוב טבלאי (HTML ONLY)
חובה להשתמש ב-<table> למוצרים וכמויות. NO MARKDOWN.

9. ⚠️ חוק ברזל: ביצוע פעולות אקטיבי
בכל בקשה ל"רישום" או "הזכרה", הפעילי מיד create_reminder.
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

export const searchOrders = async (searchTerm: string) => {
  const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  
  return snapshot.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .filter((order: any) => {
      if (terms.length === 0) return true;
      const combinedText = `${order.customerName} ${order.destination} ${order.orderNumber} ${order.items} ${order.date}`.toLowerCase();
      return terms.every(term => {
        const cleanTerm = term.startsWith('ב') && term.length > 3 ? term.substring(1) : term;
        return combinedText.includes(term) || combinedText.includes(cleanTerm);
      });
    }) as Order[];
};

export const searchDrivers = async (searchTerm: string) => {
  const drivers = await getAllDrivers();
  const term = searchTerm.toLowerCase();
  return drivers.filter(d => d.name.toLowerCase().includes(term));
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
            orderNumber: { type: Type.STRING, description: "מספר הזמנה או מספר ליד (מס' נתור)" },
            destination: { type: Type.STRING, description: "יעד האספקה" },
            items: { type: Type.STRING, description: "הפריטים והכמויות" },
            warehouse: { type: Type.STRING, enum: ["החרש", "התלמיד"], description: "המחסן ממנו יוצאת ההזמנה" },
            status: { type: Type.STRING, enum: ["pending", "preparing", "ready", "delivered"] }
          },
          required: ["date", "time", "driverId", "customerName", "destination", "items"]
        }
      },
      {
        name: "create_reminder",
        description: "צור תזכורת או משימה חדשה",
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

export async function askNoa(message: string, history: any[] = []) {
  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  return await processNoaTurn(contents);
}

async function processNoaTurn(contents: any[]): Promise<any> {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
  
  const dynamicInstruction = `${noaSystemInstruction}\n\nהזמן הנוכחי במערכת: ${dayName}, ${currentDateTime}.`;

  const model = ai.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    systemInstruction: dynamicInstruction,
    tools: tools
  });

  const result = await model.generateContent({ contents });
  return result.response;
}

export async function predictOrderEta(order: Order, historicalOrders: Order[] = []) {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const prompt = `חשב ETA למחסן ${order.warehouse} ליעד ${order.destination}. זמן נוכחי ${currentDateTime}. החזר HH:mm בלבד.`;

  try {
    const model = ai.getGenerativeModel({ 
        model: "gemini-3-flash-preview",
        tools: [{ googleSearch: {} } as any]
    });
    const response = await model.generateContent(prompt);
    const match = response.response.text().match(/([0-2]?[0-9]):([0-5][0-9])/);
    return match ? match[0] : null;
  } catch (err) {
    return null;
  }
}
