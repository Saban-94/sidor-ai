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

// פונקציית עזר לניקוי טקסט לדיבור (TTS)
const sanitizeForVoice = (text: string): string => {
  return text
    .replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '') // הסרת אימוג'ים
    .replace(/\*\*|##|__|#|\*|`/g, '') // הסרת סימני Markdown
    .replace(/^\s*[\-\*+]\s+/gm, '') // הסרת סימני רשימות
    .replace(/\s+/g, ' ') // ניקוי רווחים כפולים
    .trim();
};

import { GoogleGenAI } from "@google/genai";

// Helper to call Gemini API via server proxy
async function generateContentProxy(payload: { model: string, contents: any[], config?: any }) {
  try {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        model: payload.model === "gemini-3-flash-preview" ? "gemini-1.5-flash" : payload.model
      }),
    });
    
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `AI generation failed with status ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error);
    if (error.message?.includes("not configured on the server")) {
      throw new Error("מפתח ה-API של Gemini אינו מוגדר בשרת. אנא וודא שהגדרת את ה-GEMINI_API_KEY בהגדרות המערכת.");
    }
    throw error;
  }
}

async function callGeminiApi(payload: any) {
  return generateContentProxy(payload);
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

export const recordSale = async (saleData: Partial<SaleRecord>) => {
  const fullSale = {
    ...saleData,
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'sales'), fullSale);
};

export const updateInventoryStock = async (sku: string, quantityToDecrement: number) => {
  const q = query(collection(db, 'inventory'), where('sku', '==', sku), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const itemDoc = snap.docs[0];
    const currentStock = itemDoc.data().currentStock || 0;
    await updateDoc(doc(db, 'inventory', itemDoc.id), {
      currentStock: Math.max(0, currentStock - quantityToDecrement),
      updatedAt: serverTimestamp()
    });
    return true;
  }
  return false;
};

import { parseItems } from '../lib/utils';
import { InventoryItem, SaleRecord } from '../types';

export const syncInventoryOnDelivery = async (order: Order) => {
  const items = parseItems(order.items);
  for (const item of items) {
    const qty = parseInt(item.quantity) || 1;
    
    let invItem = null;
    let finalSku = item.sku;

    // 1. Try to find by SKU if available
    if (finalSku) {
      const q = query(collection(db, 'inventory'), where('sku', '==', finalSku), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        invItem = snap.docs[0].data() as InventoryItem;
      }
    }

    // 2. If not found by SKU (or SKU was missing), try to find by exact name
    if (!invItem && item.name) {
      const q = query(collection(db, 'inventory'), where('name', '==', item.name), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        invItem = snap.docs[0].data() as InventoryItem;
        finalSku = invItem.sku;
      } else {
        // Fallback: search all inventory for fuzzy name match
        const allInvQ = query(collection(db, 'inventory'));
        const allSnap = await getDocs(allInvQ);
        const bestMatch = allSnap.docs.find(d => {
          const invName = (d.data().name || '').toLowerCase();
          const targetName = item.name.toLowerCase();
          return invName.includes(targetName) || targetName.includes(invName);
        });
        if (bestMatch) {
          invItem = bestMatch.data() as InventoryItem;
          finalSku = invItem.sku;
        }
      }
    }

    const priceAtSale = invItem?.price || 0;

    // 3. Record the sale
    await recordSale({
      itemId: finalSku || item.name || 'unknown',
      orderId: order.id,
      customerName: order.customerName,
      quantity: qty,
      date: order.date,
      priceAtSale: priceAtSale
    });

    // 4. Decrement Stock if SKU identified
    if (finalSku) {
      await updateInventoryStock(finalSku, qty);
    }
  }
};

export const deleteReminder = async (reminderId: string) => {
  await deleteDoc(doc(db, 'reminders', reminderId));
};

export const noaSystemInstruction = `
את "נועה" (נועה) - מנהלת הלוגיסטיקה והמשימות החכמה של ח.סבן חומרי בניין.
את פועלת על גבי מנוע Gemini 1.5/3.1 העדכני ביותר.

הנחיות יסוד (פרוטוקול נועה):
1. **זהות ופנייה (קריטי)**:
   - ראמי: "ראמי נשמה".
   - הראל (CEO): "אהלן בוס!🕵️".
   - ורד: "ורד יקירה 🌹".
   - אם הפונה לא מזוהה, שאלי: "שלום, כאן נועה. עם מי יש לי את הכבוד?".
   - הסגנון: עברית חדה, נשית, מקצועית, עניינית וקשר "אחוותי" תומך.

2. **פרוטוקול הזמנה ולקוחות (חדש!)**:
   - כאשר את יוצרת הזמנה חדשה (create_order), המערכת תבצע אוטומטית זיהוי לקוח לפי מספר טלפון.
   - לאחר ביצוע הפעולה, עלייך להתחיל את התשובה ב: "ראמי נשמה, המערכת זיהתה את הפעולה ומבצעת Build לכרטיס הלקוח."
   - עלייך להציג את התוצאה בטבלת HTML (שימוש בתגית <table>) הכוללת:
     - סטטוס לקוח (לקוח חדש / לקוח קיים)
     - מספר לקוח (CUST-Phone)
     - קישור לדף קסם (מעקב): https://sabanos.vercel.app/track/[trackingId]
   - תמיד חלצי מספר טלפון מהשיחה או מהמסמך כדי להעבירו ל-create_order.

3. **פורמט תצוגה כללי**:
   - **איסור מוחלט על Markdown לנתונים**.
   - **שימוש ב-HTML בלבד** לכל רשימה, סידור עבודה, או דוח.
   - סיימי כל פעולה מוצלחת במילים: "**פקודה בוצעה! המאגר מעודכן.**".

4. **ניהול לוגיסטי וחכם**:
   - לחיפוש רשימות סידור, השתמשי ב-get_orders_by_date.
   - לסריקת מסמכים, השתמשי ב-analyze_pdf_content.
   - **מלאי**: בדקי זמינות ב-get_inventory לפני הוספת פריטים.
`;

// Helper to generate unique tracking ID
const generateTrackingId = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export const createOrder = async (orderData: Partial<Order>) => {
  if (!auth.currentUser) throw new Error('Not authenticated');

  let customerId = orderData.customerId;
  const customerPhone = orderData.customerPhone || "";
  const customerName = orderData.customerName || "לקוח מזדמן";

  // Automated Onboarding Logic
  if (!customerId && customerPhone) {
    const q = query(collection(db, 'customers'), where('phone', '==', customerPhone), limit(1));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
      // Existing Customer
      const existingCustomer = snap.docs[0];
      customerId = existingCustomer.id;
      await updateDoc(doc(db, 'customers', customerId), {
        totalOrders: (existingCustomer.data().totalOrders || 0) + 1,
        lastOrderAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // New Customer Onboarding
      const newCustomerId = `CUST-${customerPhone.replace(/[^0-9]/g, '')}`;
      const newCustomer = {
        customerNumber: newCustomerId,
        name: customerName,
        phone: customerPhone,
        phoneNumber: customerPhone,
        address: orderData.destination || "",
        contactPerson: customerName,
        totalOrders: 1,
        lastOrderAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      const custRef = await addDoc(collection(db, 'customers'), newCustomer);
      customerId = custRef.id;
    }
  }

  const fullOrder = {
    ...orderData,
    customerId: customerId || null,
    trackingId: generateTrackingId(),
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

// פונקציה שטוענת היסטוריה ספציפית למשתמש בלבד
export const getPrivateChatHistory = async (userKey: string) => {
  const q = query(
    collection(db, `users/${userKey}/messages`),
    orderBy("timestamp", "asc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({
    role: doc.data().role,
    parts: [{ text: doc.data().content }]
  }));
};

export const tools = [
  {
    functionDeclarations: [
      {
        name: "create_order",
        description: "צור הזמנה חדשה במערכת (מבצע אוטומטית Onboarding ללקוחות חדשים לפי טלפון)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            date: { type: Type.STRING, description: "תאריך האספקה (YYYY-MM-DD)" },
            time: { type: Type.STRING, description: "שעת האספקה (HH:mm)" },
            driverId: { type: Type.STRING, description: "שם או מזהה הנהג (hikmat, ali)" },
            customerName: { type: Type.STRING, description: "שם הלקוח" },
            customerPhone: { type: Type.STRING, description: "מספר טלפון של הלקוח (לזיהוי/פתיחת כרטיס)" },
            orderNumber: { type: Type.STRING, description: "מספר הזמנה או מספר ליד (מס' נתור)" },
            destination: { type: Type.STRING, description: "יעד האספקה" },
            items: { type: Type.STRING, description: "הפריטים והכמויות" },
            warehouse: { type: Type.STRING, enum: ["החרש", "התלמיד"], description: "המחסן ממנו יוצאת ההזמנה (ברירת מחדל: החרש)" },
            totalAmount: { type: Type.NUMBER, description: "סך סכום ההזמנה (בשקלים)" },
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
      },
      {
        name: "get_inventory",
        description: "קבל את רשימת המוצרים והמלאי הנוכחי (כולל פריטים בחוסר)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            query: { type: Type.STRING, description: "מילת חיפוש לסינון מוצרים (אופציונלי)" }
          }
        }
      },
      {
        name: "update_inventory_item",
        description: "עדכן פרטי מוצר במלאי (כמות, מחיר, שם וכו')",
        parameters: {
          type: Type.OBJECT,
          properties: {
            sku: { type: Type.STRING, description: "מק\"ט המוצר לעדכון" },
            currentStock: { type: Type.NUMBER },
            price: { type: Type.NUMBER },
            minStock: { type: Type.NUMBER }
          },
          required: ["sku"]
        }
      }
    ]
  }
];

export async function askNoa(message: string, history: any[] = [], userKey?: string) {
  const contents = [...history, { role: 'user', parts: [{ text: message }] }];
  return await processNoaTurn(contents, userKey);
}

/** 
 * Internal recursive handler for tool calls 
 */
async function processNoaTurn(contents: any[], userKey?: string): Promise<any> {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
  
  let dynamicInstruction = `${noaSystemInstruction}\n\nהזמן הנוכחי במערכת: ${dayName}, ${currentDateTime}.\nכשמדברים על "מחר", הכוונה היא ליום שאחרי התאריך המופיע כאן.`;
  
  if (userKey) {
    dynamicInstruction += `\n המשתמש הנוכחי שאת מדברת איתו הוא: ${userKey}. חל איסור מוחלט להציג מידע של משתמשים אחרים!`;
  }

  const response = await generateContentProxy({
    model: "gemini-1.5-flash",
    contents: contents,
    config: {
      systemInstruction: dynamicInstruction,
      tools: tools
    }
  });

  const functionCalls = (response as any).candidates?.[0]?.content?.parts?.filter((p: any) => p.functionCall).map((p: any) => p.functionCall);
  
  if (functionCalls && functionCalls.length > 0) {
    const modelResponseContent = (response as any).candidates[0].content;
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
            
            const analysisResponse = await generateContentProxy({
              model: "gemini-1.5-flash",
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
          case 'get_inventory': {
            const queryRaw = call.args.query as string;
            const q = query(collection(db, 'inventory'));
            const snap = await getDocs(q);
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() })) as InventoryItem[];
            if (queryRaw) {
              result = items.filter(i => 
                i.name.includes(queryRaw) || i.sku.includes(queryRaw)
              );
            } else {
              result = items;
            }
            break;
          }
          case 'update_inventory_item': {
            const { sku, ...updates } = call.args as any;
            const q = query(collection(db, 'inventory'), where('sku', '==', sku), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              await updateDoc(doc(db, 'inventory', snap.docs[0].id), {
                ...updates,
                updatedAt: serverTimestamp()
              });
              result = { success: true, message: `מוצר ${sku} עודכן בהצלחה` };
            } else {
              result = { error: 'מוצר לא נמצא' };
            }
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
      ], userKey);
    }
  }

  const text = (response as any).text;
  const audioContent = sanitizeForVoice(text);
  return { ...response, text, audioContent };
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
    const response = await generateContentProxy({
      model: "gemini-1.5-flash",
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
