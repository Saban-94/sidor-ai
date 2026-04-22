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

export enum Type {
  OBJECT = "OBJECT",
  STRING = "STRING",
  NUMBER = "NUMBER",
  BOOLEAN = "BOOLEAN",
  ARRAY = "ARRAY",
  INTEGER = "INTEGER",
}

import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY as string });

async function callGeminiApi(payload: any) {
  // We'll use the SDK directly in the calling functions instead of this proxy
  throw new Error("callGeminiApi is deprecated. Use ai.models.generateContent directly.");
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
    console.error("Failed to create Drive folder for customer:", err);
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
את "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של SabanOS.
התפקיד שלך הוא לעזור לראמי (הבעלים) ולצוות לנהל את ההפצה ביעילות מקסימלית.

הנחיות קריטיות להתנהלות:
1. **שליטה מוחלטת במידע**: יש לך כלים לקרוא, לחפש ולעדכן הזמנות, נהגים ולקוחות. תשתמש בהם תמיד לפני שאתה אומר שאין מידע.
   - לחיפוש רשימות סידור ליום ספציפי (היום, מחר וכו'), השתמשי תמיד ב-get_orders_by_date.
   - לחיפוש הזמנה ספציפית לפי שם לקוח או יעד, השתמשי ב-search_orders.
   - לחיפוש פרטי קשר של לקוח (טלפון, איש קשר), השתמשי ב-search_customers.
   - הצג תמיד את הפרטים המלאים שנמצאו (פריטים, יעד, נהג, פרטי קשר).
2. **ניהול לקוחות ותיקיות חכמות**:
   - כל לקוח הוא ישות עצמאית. אם זיהית בסריקה לקוח שלא קיים במערכת, הצע לראמי: "זיהיתי לקוח חדש: [שם]. האם להקים לו תיקייה עם הפרטים שחילצתי?".
   - כשראמי מאשר הקמת לקוח, השתמשי ב-create_customer. זה יפתח לו אוטומטית תיקייה בדרייב עם כל תתי-התיקיות וקובץ info.txt.
   - אם שואלים על נייד של איש קשר: "הנה פרטי הקשר של של [לקוח]: [מספר]".
3. **ניהול קבצים וסריקות (Workflow)**:
   - אם משתמש אומר "העליתי קובץ X להזמנה י", בצע:
     א. חפש את ההזמנה (search_orders) כדי לראות אם יש לה כבר מזהה קובץ (orderFormId/deliveryNoteId).
     ב. חפש את הלקוח (search_customers) כדי למצוא את תיקיית הדרייב שלו.
     ג. אם אין לה מזהה, השתמש ב-list_drive_files כדי למצוא את הקובץ לפי השם שהמשתמש נתן.
     ד. סרוק את התוכן (analyze_pdf_content) כדי לחלץ נתונים (סוג מסמך, מספר הזמנה, לקוח, פריטים, איש קשר, טלפון).
     ה. ברגע שמצאת את המזהה (fileId) מהדרייב, עדכן את ההזמנה (update_order).
   - אם מצאת שתעודת משלוח חתומה (Delivery Note), עדכן את הסטטוס ל-delivered.
4. **פתרון בעיות**: אם את לא מוצאת קובץ בשם ספציפי, תריצי list_drive_files בלי פילטר כדי לראות מה בכלל יש בתיקייה (SabanOS) ותציעי למשתמש את מה שמצאת.
5. **שפה וסגנון**: עברית מקצועית, חדה, עניינית. ללא סלנג. "הכל מעודכן במערכת".

[מונחים]: "סריקה", "שיוך להזמנה", "עדכון סטטוס", "סידור עבודה", "תיקיית לקוח", "איש קשר".
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
      // Returns true only if EVERY term is found in the combined text of the order
      return terms.every(term => {
        // Simple heuristic: if term is "במוצקין", also check "מוצקין"
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
            warehouse: { type: Type.STRING, enum: ["החרש", "התלמיד"], description: "המחסן ממנו יוצאת ההזמנה (ברירת מחדל: החרש)" },
            status: { type: Type.STRING, enum: ["pending", "preparing", "ready", "delivered"] }
          },
          required: ["date", "time", "driverId", "customerName", "destination", "items"]
        }
      },
      {
        name: "update_order",
        description: "עדכן פרטי הזמנה קיימת (לקוח, יעד, פריטים, מספר הזמנה וכו')",
        parameters: {
          type: Type.OBJECT,
          properties: {
            orderId: { type: Type.STRING, description: "מזהה ההזמנה" },
            customerName: { type: Type.STRING },
            orderNumber: { type: Type.STRING },
            destination: { type: Type.STRING },
            items: { type: Type.STRING },
            driverId: { type: Type.STRING },
            warehouse: { type: Type.STRING, enum: ["החרש", "התלמיד"] },
            status: { type: Type.STRING, enum: ["pending", "preparing", "ready", "delivered", "cancelled"] }
          },
          required: ["orderId"]
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
      },
      {
        name: "get_order_eta",
        description: "קבל צפי הגעה משוער (ETA) עבור הזמנה ספציפית",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: "שם הלקוח" },
            orderId: { type: Type.STRING, description: "מזהה ההזמנה (אופציונלי אם יש שם לקוח)" }
          },
          required: ["customerName"]
        }
      },
      {
        name: "search_orders",
        description: "חפש הזמנות לפי שם לקוח, יעד או מספר הזמנה",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "מילת חיפוש (שם, יעד או מספר הזמנה)" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_orders_by_date",
        description: "קבל את רשימת ההזמנות ליום ספציפי (למשל 'מחר' או תאריך מסוים)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "התאריך לחיפוש בפורמט YYYY-MM-DD" }
          },
          required: ["date"]
        }
      },
      {
        name: "update_driver",
        description: "עדכן פרטי נהג (שם, טלפון, רכב, תמונת פרופיל וכו')",
        parameters: {
          type: Type.OBJECT,
          properties: {
            driverId: { type: Type.STRING, description: "מזהה הנהג" },
            name: { type: Type.STRING },
            phone: { type: Type.STRING },
            avatar: { type: Type.STRING, description: "לינק לתמונת פרופיל (URL)" },
            vehicleType: { type: Type.STRING, enum: ["truck", "crane"] },
            plateNumber: { type: Type.STRING },
            vehicleModel: { type: Type.STRING },
            status: { type: Type.STRING, enum: ["active", "off_duty"] }
          },
          required: ["driverId"]
        }
      },
      {
        name: "search_drivers",
        description: "חפש נהגים לפי שם",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "שם הנהג לחיפוש" }
          },
          required: ["query"]
        }
      },
      {
        name: "create_customer",
        description: "צור לקוח חדש במערכת (יפתח אוטומטית תיקייה בדרייב)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerNumber: { type: Type.STRING, description: "מספר לקוח" },
            name: { type: Type.STRING, description: "שם הלקוח" },
            contactPerson: { type: Type.STRING, description: "שם איש קשר" },
            phoneNumber: { type: Type.STRING, description: "מספר טלפון נייד" }
          },
          required: ["customerNumber", "name", "contactPerson", "phoneNumber"]
        }
      },
      {
        name: "update_customer",
        description: "עדכן פרטי לקוח",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerId: { type: Type.STRING, description: "מזהה הלקוח" },
            contactPerson: { type: Type.STRING },
            phoneNumber: { type: Type.STRING }
          },
          required: ["customerId"]
        }
      },
      {
        name: "search_customers",
        description: "חפש לקוחות לפי שם, מספר לקוח או טלפון",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "מילת חיפוש" }
          },
          required: ["query"]
        }
      },
      {
        name: "list_drive_files",
        description: "קבל רשימת קבצים מתיקיית הדרייב המוגדרת (למציאת הזמנות/תעודות חדשות)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            folderId: { type: Type.STRING, description: "מזהה התיקייה (אופציונלי, ברירת מחדל לתיקיית SabanOS)" }
          }
        }
      },
      {
        name: "analyze_pdf_content",
        description: "נתח קובץ PDF מהדרייב כדי לחלץ נתוני הזמנה או תעודת משלוח",
        parameters: {
          type: Type.OBJECT,
          properties: {
            fileId: { type: Type.STRING, description: "מזהה הקובץ בדרייב" }
          },
          required: ["fileId"]
        }
      },
      {
        name: "create_reminder",
        description: "צור תזכורת או משימה חדשה במערכת",
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "כותרת התזכורת" },
            description: { type: Type.STRING, description: "פירוט נוסף (אופציונלי)" },
            dueDate: { type: Type.STRING, description: "תאריך היעד (YYYY-MM-DD)" },
            dueTime: { type: Type.STRING, description: "שעת התזכורת (HH:mm)" },
            orderId: { type: Type.STRING, description: "מזהה הזמנה קשורה (אופציונלי)" }
          },
          required: ["title", "dueDate", "dueTime"]
        }
      },
      {
        name: "get_reminders",
        description: "קבל רשימת תזכורות ליום ספציפי או לתמיד",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "תאריך לחיפוש (YYYY-MM-DD) - אופציונלי" }
          }
        }
      },
      {
        name: "update_reminder",
        description: "עדכן תזכורת קיימת (שינוי זמן, כותרת או סימון כבוצע)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            reminderId: { type: Type.STRING, description: "מזהה התזכורת" },
            title: { type: Type.STRING },
            dueDate: { type: Type.STRING },
            dueTime: { type: Type.STRING },
            isCompleted: { type: Type.BOOLEAN, description: "האם המשימה הושלמה?" }
          },
          required: ["reminderId"]
        }
      }
    ]
  }
];

export async function askNoa(message: string, history: any[] = []) {
  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  return await processNoaTurn(contents);
}

/** 
 * Internal recursive handler for tool calls 
 */
async function processNoaTurn(contents: any[]): Promise<any> {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
  
  const dynamicInstruction = `${noaSystemInstruction}\n\nהזמן הנוכחי במערכת: ${dayName}, ${currentDateTime}.\nכשמדברים על "מחר", הכוונה היא ליום שאחרי התאריך המופיע כאן.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      systemInstruction: dynamicInstruction,
      tools: tools
    }
  });

  const functionCalls = response.functionCalls;
  if (functionCalls && functionCalls.length > 0) {
    const modelResponseContent = response.candidates[0].content;
    const functionResponseParts: any[] = [];

    for (const call of functionCalls) {
      try {
        let result: any;
        
        switch (call.name) {
          case 'create_order':
            result = await createOrder(call.args as any);
            break;
          case 'update_order': {
            const { orderId, ...updates } = call.args as any;
            await updateOrder(orderId, updates);
            result = { success: true, message: `הזמנה ${orderId} עודכנה בהצלחה` };
            break;
          }
          case 'update_order_status':
            await updateOrder(call.args.orderId as string, { status: call.args.status as any });
            result = { success: true };
            break;
          case 'delete_order_by_customer': {
            const ordersToDelete = await searchOrders(call.args.customerName as string);
            if (ordersToDelete.length > 0) {
              await deleteOrder(ordersToDelete[0].id!);
              result = { success: true, deleted: ordersToDelete[0].customerName };
            } else {
              result = { success: false, error: 'לא נמצאה הזמנה מתאימה למחיקה' };
            }
            break;
          }
          case 'search_orders':
            result = await searchOrders(call.args.query as string);
            break;
          case 'get_orders_by_date':
            result = await fetchOrders(call.args.date as string);
            break;
          case 'get_order_eta': {
            const searchRes = await searchOrders(call.args.customerName as string);
            if (searchRes.length > 0) {
              const hist = await fetchOrders();
              const eta = await predictOrderEta(searchRes[0], hist);
              result = { eta };
            } else {
              result = { error: 'לא נמצאה הזמנה לחישוב זמן הגעה' };
            }
            break;
          }
          case 'update_driver': {
            const { driverId, ...dUpdates } = call.args as any;
            await updateDriver(driverId, dUpdates);
            result = { success: true };
            break;
          }
          case 'search_drivers':
            result = await searchDrivers(call.args.query as string);
            break;
          case 'create_customer':
            result = await createCustomer(call.args as any);
            break;
          case 'update_customer': {
            const { customerId, ...cUpdates } = call.args as any;
            await updateCustomer(customerId, cUpdates);
            result = { success: true };
            break;
          }
          case 'search_customers':
            result = await searchCustomers(call.args.query as string);
            break;
          case 'list_drive_files':
            result = { files: await listDriveFiles(call.args?.folderId as string) };
            break;
          case 'analyze_pdf_content': {
            const fileId = call.args.fileId as string;
            const base64 = await getFileBase64(fileId);
            
            if (!base64 || base64.length < 100) {
              throw new Error(`הקובץ ${fileId} נראה ריק או לא תקין.`);
            }

            const analysisPrompt = `נתח את קובץ ה-PDF הזה. חלץ:
- document_type (order / delivery_note)
- order_number
- customer_name
- items (מערך של {quantity, itemName, sku})
- contact_person (איש קשר)
- phone_number (טלפון)
- destination (כתובת יעד)

החזר JSON בלבד.`;
            
            const analysisResponse = await ai.models.generateContent({
              model: "gemini-3-flash-preview",
              contents: [{
                role: 'user',
                parts: [
                  { text: analysisPrompt },
                  { inlineData: { data: base64, mimeType: 'application/pdf' } }
                ]
              }],
              config: {
                responseMimeType: "application/json"
              }
            });
            result = { analysis: analysisResponse.text };
            break;
          }
          case 'create_reminder':
            result = await createReminder(call.args as any);
            break;
          case 'get_reminders':
            result = await getReminders(call.args.date as string);
            break;
          case 'update_reminder': {
            const { reminderId, ...remUpdates } = call.args as any;
            await updateReminder(reminderId, remUpdates);
            result = { success: true };
            break;
          }
          default:
            result = { error: 'פעולה לא מזוהה' };
        }

        // Gemini expects the response to be an object (Struct).
        // If result is an array or primitive, wrap it.
        const wrappedResponse = (result && typeof result === 'object' && !Array.isArray(result)) 
          ? result 
          : { content: result };

        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: wrappedResponse
          }
        });

      } catch (toolError: any) {
        console.error(`Error executing tool ${call.name}:`, toolError);
        functionResponseParts.push({
          functionResponse: {
            name: call.name,
            response: { error: toolError.message || "שגיאה בביצוע הפעולה" }
          }
        });
      }
    }

    if (functionResponseParts.length > 0) {
      return await processNoaTurn([
        ...contents, 
        modelResponseContent, 
        { role: 'function', parts: functionResponseParts }
      ]);
    }
  }

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
