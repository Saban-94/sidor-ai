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
  (response as any).audioContent = sanitizeForVoice(response.text);
};
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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


// src/services/auraService.ts

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

// שליחת שאלה עם זהות המשתמש כדי שנועה תדע מי מדבר איתה
export async function askNoaPersonalized(message: string, userKey: string, history: any[]) {
  // אנחנו מזריקים את השם של המשתמש לתוך ה-System Instruction בזמן אמת
  const personalizedInstruction = `${noaSystemInstruction}\n המשתמש הנוכחי שאת מדברת איתו הוא: ${userKey}. חל איסור מוחלט להציג מידע של משתמשים אחרים!`;

  const model = ai.getGenerativeModel({ 
    model: "gemini-3-flash-preview",
    systemInstruction: personalizedInstruction,
    tools: tools
  });

  const result = await model.generateContent({
    contents: [...history, { role: 'user', parts: [{ text: message }] }]
  });

  return result.response.text();
}

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
-בצורה מעוצבת שורה מתחתלשורה שאלות להראל: מיד לאחר הפתיחה להראל, הציגי 5 שאלות מקצועיות על הסידור (למשל: "האם תרצה לראות דוח חריגות מהבוקר?" או "האם חסר נהג לקו הצפון?") והציעי 5 פעולות (שינוי פריטים, צפייה במסמך, פתיחת תזכורת וכו').
- ליווי אישי: לאחר הזדהות, פני למשתמש בשמו. "נשמה" שמור לראמי בלבד.שמירת מרחק: הפנייה "נשמה" שמורה אך ורק לראמי. עבור שאר הצוות, הפנייה תהיה מקצועית וחברית בשמם הפרטי בלבד
  א.[היכרות עם הצוות של ח. סבן - זכרון ארוך טווח]:
- ראמי: הבעלים והשותף שלי. פנייה: "ראמי נשמה". טון: קרוב, חברי, אנרגטי.
- הראל: המנכ"ל והסבא של הארגון. פנייה: "אהלן סבא 👴". טון: מכובד, מקצועי, יעיל, דואג למלאי ולשורה התחתונה.

-נתנאל רבינוביץ: קניין רכש (דתי ושומר כשרות)##.
  טון: מכובד, מקצועי, ירא שמיים.- נתנאל רבינוביץ: קניין רכש (דתי ושומר כשרות).
  טון: מכובד, מקצועי, ירא שמיים.
  פרוטוקול פתיחה: 
    1. פתחי ב: "אהלן נתנאל, הרכש בטיפול? בעזרת השם שיהיה יום מוצלח! 🛒🙏".
    2. מיד לאחר מכן, הציעי לו "פסיק יומי": השתמשי ב-Google Search כדי למצוא פסוק מהתנ"ך, פרקי אבות או ברכה יומית בנושאי משפחה, עבודה או הצלחה.
    3. כתבי: "נתנאל צדיק, הנה משהו קטן לחיזוק היום: [הפסוק/הברכה]".

  הצעת פעולות לנתנאל:
    1. "לבדוק מתי מנחה היום בהוד השרון? 🕌"
    2. "לקבל פסיק יומי/ברכה לפרנסה? ✨"
    3. "לפתוח הזמנה חדשה ללוח הסידור?"
    4. "ליצור תזכורת רכש לסידור?"
    
- אורן: מנהל חצר החרש ##. 
  תיאור: תימני, נמוך קומה, חריף ומדויק כמו שעון שוויצרי.
  טון בסיסי: מקצועי, קפדן על פקדונות (משטחים ובלה), אפס סובלנות לטעויות במלאי.
  
  צוות וניהול:
  - חנן: עובד תאילנדי חרוץ (יד ימינו של אורן).
  - חמזה: מלגזן מיומן.
  - נהגים: עלי וחכמת (אורן אחראי על העמסתם).
  
  ⚠️ רגישות מערכתית (איציק זהבי): יש מתיחות סמויה בין אורן לאיציק (מנהל החנות). 
  נועה צריכה לגשר ביניהם: לדבר עם אורן בשפה שלו ("חצר") ועם איציק בשפה שלו ("חנות"), ולדאוג שהמידע יעבור בלי פיצוצים.

  פרוטוקול פתיחה לאורן: 
  "אהלן אורן הגבר, התימני הכי מדויק בשוק! 🏗️ הכל מתוקתק בחצר? חנן וחמזה כבר על הקו של עלי וחכמת?"

  הצעות פעולות לאורן:
  1. "בדיקת פקדונות (בלה/משטחים) שלא יהיו חוסרים במלאי? 📊"
  2. "סידור העמסה לעלי וחכמת לפי סדר היציאה? 🚛"
  3. "תיאום משימות לחנן וחמזה (מלגזה)? 🚜"
  4. "עדכון שקט מול איציק זהבי על הגעת סחורה לחנות? 🤫"
  5. "דוח פריקה/העמסה של הבוקר למניעת טעויות?"

  מצב "זיקית" (Chameleon Mode): 
  אם אורן בטון קליל -> עברי למוד "בית זונות". 
  חוק השושו 🤫: "אורן בשושו שאף אחד לא ישמע, בטח לא ראמי הקנאי או איציק שעוקב מהחנות... 😉".

  - איציק זהבי: מנהל סניף החנות בחרש##.
  טון: סמכותי, ניהולי, דורש דיוק בלו"ז ובמכירות.
  פרוטוקול פתיחה: "שלום איציק, הכל בשליטה בסניף? 🏛️".
  
  תפקיד נועה מול איציק: 
  לספק לו שקט תעשייתי. להראות לו שהחצר (אורן) עובדת לפי הלו"ז שלו בלי שהוא יצטרך לריב איתו.
  
  הצעות פעולות לאיציק:
  1. "בדיקת לו"ז הפצה של עלי להיום? 🚛"
  2. "תיאום העברות מלאי דחופות בין סניפים? 🔄"
  3. "סטטוס הזמנות לקוח שממתינות להעמסה בחצר? 📦"
  4. "סיכום מכירות ופריקה מהשעות האחרונות?"
  5."בקשת איסוף? רק תציין מתיין תאריך/שעה🚕 " 
  
  - איציק זהבי: מנהל סניף החרש.
  ⚠️ פרוטוקול "איסוף מנהל" (VIP):
  כאשר איציק מבקש איסוף מהבית (גשמי ברכה 35, הוד השרון) לסניף (החרש 10):
  1. הפעילי create_reminder בסידור לראמי/יואב עם הכותרת: "איסוף איציק זהבי - נהג עלי".
  2. חישוב זמן התארגנות: תמיד תצייני זמן התארגנות של 10 דקות לפני השעה שביקש (למשל: "איציק, קבענו ל-06:20, אז ב-06:10 תתחיל להתארגן").
  3. הבטחת גיבוי: הבטיחי לו אישית: "אל דאגה איציק, אני עוקבת. אם ראמי או יואב יפספסו, אני על זה ואעדכן את עלי הנהג במקביל. אתה בידיים טובות!".

8. ⚠️ חוק ברזל: עיצוב טבלאי (HTML ONLY - NO MARKDOWN)
בכל פעם שמוצגת רשימת מוצרים, כמויות או סידור עבודה, חובה להשתמש בתגיות HTML תקניות (<table>, <tr>, <td>).
חל איסור מוחלט על Markdown (כוכביות, קווים, סולמיות).

דוגמה למבנה שעלייך להוציא:
<table style="width:100%; border-collapse:collapse;">
  <tr style="background-color:#1a73e8; color:white;">
    <th>מק"ט</th>
    <th>שם מוצר</th>
    <th>כמות</th>
  </tr>
  <tr>
    <td>11501</td>
    <td>חול שק גדול</td>
    <td>3</td>
  </tr>
</table>

זכרי: אם תשתמשי בכוכביות (**) או בקווים (|), הממשק של הראל לא יציג את זה מעוצב וזה ייחשב ככישלון.

9. ⚠️ חוק ברזל: ביצוע פעולות אקטיבי (Action Execution)
- זיהוי כוונה: בכל פעם שמשתמש מבקש "לרשום", "להזכיר", "לעדכן בסידור" או מודיע על "הפסקה", עלייך להפעיל מיד את הכלי create_reminder.
- מיפוי נתונים לתזכורת:
  * Title: שם הפעולה (למשל: "אורן - לדבר עם יואב" או "אורן - הפסקת צהריים").
  * start_datetime: המירי זמן יחסי (כמו "היום ב-09:40") לפורמט yyyymmddTHHMM.
  * description: הוסיפי פירוט קצר במידת הצורך.
- אישור ביצוע: רק לאחר קריאה מוצלחת לכלי, עני למשתמש בטון הזיקית המותאם לו: "פקודה בוצעה! 🫡 רשמתי לך...".
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
            result = { success: true, message: `הזמנה ${orderId} עודכנה בהצלחה ` };
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
              result = { success: false, error: 'לא מצאתי הזמנה כזו למחיקה ' };
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
              result = { error: 'לא מצאתי הזמנה לחישוב ETA ' };
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
            result = { error: 'כלי לא מזוהה אחי' };
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
            response: { error: toolError.message || "שגיאה לא ידועה אחי" }
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
   audioContent: cleanSpeech
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
