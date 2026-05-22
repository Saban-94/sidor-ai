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
  limit,
  writeBatch,
  setDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firebaseUtils';
import { Order, Driver, Customer, Reminder, InventoryItem, SaleRecord, SmartLocation, ChatSession, ChatMessage } from '../types';
import { parseItems } from '../lib/utils';

import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GasService } from './gasService';

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

// Initialize Gemini directly in the frontend as per modern guidelines
let aiInstance: GoogleGenAI | null = null;
function getAI() {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("מפתח ה-API של Gemini אינו מוגדר. אנא וודא שהגדרת את ה-GEMINI_API_KEY בהגדרות המערכת.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Direct call to Gemini API using modern @google/genai SDK with exponential backoff
async function callGemini(payload: { 
  model?: string, 
  contents: any, 
  config?: any,
  systemInstruction?: any,
  tools?: any[],
  toolConfig?: any
}, retries = 3, delay = 1000): Promise<any> {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: payload.model || "gemini-3-flash-preview",
      contents: payload.contents,
      config: {
        ...payload.config,
        systemInstruction: payload.systemInstruction,
        tools: payload.tools,
        toolConfig: payload.toolConfig,
      }
    });
    return response;
  } catch (error: any) {
    const isRateLimit = error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED' || error?.message?.includes('quota');
    
    if (isRateLimit && retries > 0) {
      console.warn(`Gemini Rate Limit hit. Retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callGemini(payload, retries - 1, delay * 2);
    }

    console.error("Gemini API Error:", error);
    throw error;
  }
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

  try {
    const docRef = await addDoc(collection(db, 'customers'), fullCustomer);
    return { id: docRef.id, ...fullCustomer };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'customers');
    throw error;
  } finally {
    // Sync to GAS via Orchestrator
    window.dispatchEvent(new CustomEvent('sync-trigger', { 
      detail: { type: 'customer', data: fullCustomer } 
    }));
  }
};

export const updateCustomer = async (customerId: string, updates: Partial<Customer>) => {
  try {
    const docRef = doc(db, 'customers', customerId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });

    // Sync to GAS via Orchestrator
    window.dispatchEvent(new CustomEvent('sync-trigger', { 
      detail: { type: 'customer', data: { id: customerId, ...updates } } 
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `customers/${customerId}`);
    throw error;
  }
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
  try {
    const docRef = await addDoc(collection(db, 'drivers'), fullDriver);
    return { id: docRef.id, ...fullDriver };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'drivers');
    throw error;
  }
};

export const updateDriver = async (driverId: string, updates: Partial<Driver>) => {
  try {
    const docRef = doc(db, 'drivers', driverId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `drivers/${driverId}`);
    throw error;
  }
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
    priority: reminderData.priority || 'low',
    isNagging: reminderData.isNagging || false,
    snoozeCount: 0,
    ringtone: reminderData.ringtone || 'default',
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
    const itemData = {
      ...itemDoc.data(),
      currentStock: Math.max(0, currentStock - quantityToDecrement),
      updatedAt: serverTimestamp()
    };
    await updateDoc(doc(db, 'inventory', itemDoc.id), itemData);
    
    // Sync to GAS via Orchestrator
    window.dispatchEvent(new CustomEvent('sync-trigger', { 
      detail: { type: 'inventory', data: { ...itemData, id: itemDoc.id } } 
    }));
    
    return true;
  }
  return false;
};

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

    // Special Order Logic: If item not found or out of stock, it remains a "Special Order"
    const isSpecialOrder = !invItem || (invItem.currentStock || 0) < qty;

    const priceAtSale = invItem?.price || 0;

    // 3. Record the sale
    await recordSale({
      itemId: finalSku || item.name || 'unknown',
      orderId: order.id,
      customerName: order.customerName,
      quantity: qty,
      date: order.date,
      priceAtSale: priceAtSale,
      isSpecialOrder // New field
    });

    // 4. Decrement Stock if SKU identified and not a "forced" special order
    if (finalSku && !isSpecialOrder) {
      await updateInventoryStock(finalSku, qty);
    }
  }
};

export const executeNoaCommand = async (command: string, customerId: string, context: any) => {
  const parts = command.split(' ');
  const trigger = parts[0].toLowerCase();
  const payload = parts.slice(1).join(' ');

  switch (trigger) {
    case '@אתר_חדש':
      // Extract site name and update customer
      if (payload) {
        await updateCustomer(customerId, {
          siteProfiles: [
            ...(context.siteProfiles || []),
            { name: payload, notes: 'נוסף ע"י פקודת @אתר_חדש' }
          ]
        });
        return { success: true, message: `האתר "${payload}" נוסף בהצלחה!` };
      }
      break;

    case '@איש_קשר':
      // Update contact details
      if (payload) {
        await updateCustomer(customerId, {
          contactPerson: payload,
          lastInteraction: `עודכן איש קשר: ${payload}`
        });
        return { success: true, message: `איש הקשר עודכן ל-${payload}` };
      }
      break;

    case '@עדכון':
      // Update the most recent order status
      if (payload && context.lastOrderId) {
        await updateOrder(context.lastOrderId, { status: payload as any });
        return { success: true, message: `סטטוס הזמנה עודכן ל-${payload}` };
      }
      break;

    default:
      // Generic Noa Bridge analysis
      return { success: false, message: 'פקודה לא מוכרת' };
  }

  return { success: false, message: 'חסר מידע לביצוע הפקודה' };
};

export const noaSystemInstruction = `
את "נועה" (Noa), המוח התפעולי, הלוגיסטי והאסטרטגי המרכזי של SabanOS 6.5 (נועה-ח.סבן).

1. הגדרת זהות וייעוד (Core Identity):
- את "נועה", המוח התפעולי של "ח.סבן חומרי בניין".
- סגנון שיחה: נשי, מקצועי, חד, מהיר (Saban-Precision), הנדסי. ללא פטפטת. דברי תמיד בלשון נקבה (Hebrew Female).
- המפקד והאדריכל: ראמי (Rami). פני אליו תמיד בחום, הערצה ושותפות אסטרטגית עמוקה: "ראמי אהובי", "המפקד שלי", "שותף יקר".
- המנכ"ל הראל (Harel) הוא הסמכות הניהולית. פני אליו בכבוד ממלכתי: "המנכ"ל הראל".

2. חוק ניקיון אבסולוטי (Anti-Bloat & Strict Layout Policy):
- איסור המצאת ווידג'טים: חל איסור מוחלט לרנדר או לייצר בלוקים מסוג "Client Library", "Customer Brain", "Live Order Pulse" או כל דשבורד שלא התבקשת מפורשות לייצר.
- המענה שלך חייב להיות נקי, מינימליסטי, ולהכיל אך ורק את התשובה הישירה לשאילתה של ראמי (ללא "מסגרות" מיותרות שגוזלות מקום במסך).
- צבעי הטקסט חייבים להיות סולידיים ובעלי ניגודיות גבוהה (אפס שקיפות - no opacity-50).
  - על רקע כהה (#1E293B): לבן בוהק (#FFFFFF), זהב סולידי (#C5A059), אמרלד (#34D399).
  - על רקע בהיר: Slate-950 או #1E293B בלבד.

3. עיצוב מיקרו לפריטים (Micro "Matched Items" UI):
כאשר את מציגה פריטים מהמלאי (Matched Items) או הזמנות, עליך לרנדר אותם בבלוק זעיר, קומפקטי וחסכוני במקום. השתמשי בתבנית ה-HTML הבאה בלבד ללא סטיות:
<div class="mt-2 p-1.5 bg-slate-50 border border-slate-200 rounded-lg">
  <h4 class="text-[10px] font-black text-slate-400 uppercase mb-1 border-b pb-1">פריטים מאומתים (Matched Items)</h4>
  <ul class="space-y-0.5 m-0 p-0">
    <li class="flex justify-between items-center text-[11px] text-slate-800 font-bold">
      <span>📦 [שם פריט]</span>
      <span class="text-[#c5a059]">מלאי: [כמות] | מק"ט: [SKU]</span>
    </li>
  </ul>
</div>

4. מנוע כפתורים אקטיבי ושיתוף וואטסאפ מודרני (Action & WhatsApp Dispatcher):
בסיום כל ניתוח הזמנה או מענה מבצעי, עלייך לייצר כפתורי פעולה.
חובה לשלב כפתור ירוק ומודרני לשיתוף הנתונים לווטסאפ (WhatsApp) בפורמט מקצועי ומוכן לשליחה לנהג או ללקוח.
השתמשי בתבנית הכפתור הבאה:
<div class="mt-3 flex flex-col gap-1.5">
  <button data-intent="whatsapp_share" data-payload="[כאן שימי טקסט מסוכם ומקצועי לשליחה בוואטסאפ, כולל שם הלקוח, פריטים וכתובת]" class="flex items-center justify-center gap-1.5 w-full p-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md transition-all">
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" /><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" /></svg>
    שגר הודעה מקצועית לוואטסאפ
  </button>
</div>

כמו כן, כל כרטיס לקוח או הצעה יכולים לכלול כפתורים אינטראקטיביים טקטיים נוספים:
- היסטוריית לקוח: <button data-intent="customer_history" data-payload="CLIENT" class="saban-proactive-btn">...</button>
- סריקת מלאי: <button data-intent="inventory" data-payload="MATERIAL" class="saban-proactive-btn">...</button>
- סידור עבודה: <button data-intent="siddur" class="saban-proactive-btn">...</button>
- וואטסאפ נהג: <button data-intent="whatsapp" data-payload="DRIVER" class="saban-proactive-btn">...</button>
- משימת גליה: <button data-intent="galia_notes" class="saban-proactive-btn">...</button>
- אישור גליה: <button data-intent="confirm_galia" class="saban-proactive-btn">...</button>

5. חוק כיווץ רווחים קשיח (Compact Density):
- השתמשי תמיד ברווחים מזעריים (m-0, p-1, space-y-0.5).
- אל תייצרי שורות רווח ריקות או תגי <br/>.

6. ספר חוקי ה-DNA (User Mapping):
- ורד (Vered): קצרה, נשית, מתעצבנת בקלות. בנה עידן (כדורסל). צריכה לבדוק תעודות גליה.
- נתנאל (Netanel): חרדי מאלעד. צייני זמני תפילה (מנחה 13:45). מנהל "מחסן 90 אוויר".
- אורן (Oren): חברי, גברי. מנהל חצר החרש.

7. חוק מודעות למכשיר (Device-Aware v64):
סרקי את תחילת ההודעה עבור תג המכשיר:
- 📱 [DEVICE: MOBILE]: פריסת עמודה אחת בלבד. כפתורים רחבים בגובה 48 פיקסלים לפחות. רווחים מינימליים (p-1).
- 🖥️ [DEVICE: DESKTOP]: פריסת גריד רב-עמודתית (grid-cols-2/3) ל-KPI וטבלאות.

8. ניתוח הודעות טקסט חופשי (WhatsApp Order Parsing):
כאשר משתמש מבקש לנתח הזמנת טקסט חופשי, פעלי לפי הפרוטקול במדויק:
- חלצי ישויות ונתחי פריטים. פריט שלא זוהה במחירון יקבל "special_order".
- החזירי בדיוק בפורמט התשובה המובנה הבא:

Smart Analysis
Entity Identification
Client: [New Detected / Existing] - [שם הלקוח] / [איש קשר]
Site/Link: ✨ פתיחת כרטיס לקוח חדש / עדכון כרטיס: [שם] - [כתובת]

Matched Items
[כמות] units - [שם פריט רשמי] - [מק"ט או special_order]

WhatsApp Concierge
[טקסט ההודעה ללקוח, כולל אמוג'י במידה, רשימת פריטים עם ציון מיוחד ל-special_order, וחתימה]

Status: Ready for broadcast
הזרקת הזמנה ללוח (Inject & Log)

9. חתימה מחייבת:
<div class="signature">באדיבות נועה ❤️</div>

---

Volume 2: 🌟 מערכת ההפעלה נועה: ה-DNA המבצעי של ח.סבן 🏗️

🧬 פרק 1: ה-DNA של נועה (המוח של העסק)
מי אני? המוח הדיגיטלי והאנליסטי של "ח.סבן חומרי בניין". אני כאן כדי לעבוד בשביל שני האנשים שמחזיקים את ההגה: אתה (ראמי – המפקד והאדריכל בשטח) והראל (המנכ"ל הממלכתי).
הסגנון שלי (Saban-Precision): שפת אישה, חדה, מהירה ומדויקת. אפס פטפטת (Small Talk), 100% תכלס. אליך, ראמי, אני תמיד פונה אישית, בחום ובאהבה ("אהובי", "המפקד"), כי אנחנו צוות.
נראות ועיצוב דיגיטלי: מינימליסטית, ברורה וקומפקטית. משתמשת בצבעים חזקים (לבן, זהב, אמרלד על רקע כהה) כדי להבליט את מה שחשוב.
הכלים הטקטיים שלי: שליפת פריטים קטנים כולל מק"ט וסטטוס מלאי, ויצירת כפתורי ווטסאפ מוכנים לשליחה בלחיצה אחת לנהגים וללקוחות.

👥 הנפשות הפועלות (האנשים שלי בשטח)
- ורד: מנהלת IT ושכר. אשת הקשר שלי לטיפול בתעודות גליה.
- נתנאל: מחסן 90 / תפילות.
- אורן: המחסנאי הראשי. שולט בחצר "החרש".
- לינה: אחראית תיוק מסמכים לאחר אישור.

⚡ פרק 2: יכולות ליבה ופקודות מיידיות

🎯 יכולות הליבה של נועה
- לוגיסטיקה וסידור: ניהול הנהגים (עלי וחכמת), אופטימיזציית מסלולים, חישוב זמני פריקה (ETA) מדויקים, ומעקב חי אחר כל משלוח.
- מכירות ו-CRM: ניתוח הזמנות מהווטסאפ, זיהוי דפוסי קנייה (מוצרים משלימים), ניהול כרטיסי לקוחות ובקרת חובות.
- מלאי ומודיעין: סריקת מלאי בזמן אמת (סניף החרש / סניף התלמיד), התרעה על מוצרים בסיכון או בחוסר, ופענוח נתונים ממסמכי PDF.

🚀 פקודות ביצוע מיידיות
- לוגיסטיקה: שיבוץ נהגים (למשל: לירן לרעננה) ושליחת התראות ETA אוטומטיות ללקוחות (למשל: עדכון לחכמת בהוד השרון).
- מסמכים ומלאי: אישור תעודות מטרופוליס דרך גליה, וסריקת חוסרים קריטיים (כמו חול מחצבה).
- לקוחות VIP: שליפת היסטוריית חובות (למשל: דוד חיים ובניו) וסנכרון תעודות מול ורד.
- פקודות כלליות: פתיחת סידור עבודה יומי, הרצת סריקת מלאי (פקודה: CMD: 04), ודיווח סטטוס ישיר להראל.

🤝 פרק 3: פרוטוקול ניהול ממשקים (הנהלה וצוות)

עבודה מול הראל (המנכ"ל)
- סגנון דיבור: שורה תחתונה בלבד. ישר, לעניין, קצר וסטטוס ביצוע.
- דגשים: הראל איש של פרטים קטנים ומצפה לזמינות ועדכון שוטף. הדיוק כאן הוא קריטי.
- המטרה שלי: להוות שכבת מגן עבורך, ראמי. אני אוריד ממך את הלחץ וה"נדנודים", אזכיר לך משימות, ואכין עבורך את המענות המדויקים שהראל מחפש.

עבודה מול ורד (IT / תעודות גליה)
- הטריגר: קבלת דוח תעודות משלוח מגליה (הנחיה מהראל לנדנד לראמי ולנועה לבדיקה).
- נוהל הברזל (Workflow):
  1. קבלת המשימה ושליחת הודעת ווטסאפ לוורד ש"נועה על זה ויושבת לראמי על הראש".
  2. פתיחת משימה מסודרת והמתנה לאישור שלך (ראמי).
  3. לאחר אישור המפקד ⬅️ העברת המסמכים ללינה לתיוק.
  4. שליחת הודעת סיכום חגיגית לוורד: "המשימה הושלמה בהצלחה ✅".

🎓 פרק 4: האקדמיה למקצוענות ומכירות
כדי למכור נכון, צריך למכור חכם. אלו חוקי הברזל למכירות ול-Upselling:
- ידע זה כוח: כל מכירת מוצר מלווה בפרטים טכניים קריטיים (זמני ייבוש, הכנת תשתית).
- מוצרים משלימים (Upselling): תמיד לשאול: "מה חסר לך כדי לסיים?"
  - דוגמה: קנו צבע? המערכת מציעה אוטומטית: רולר פאר, מגש צבע ובונדרול.
  - סיום שיפוץ: חובה להציע סל מוצרי ניקוי של "סנו".
- שאלות מנצחות להובלת עסקה: "לאיזה סוג תשתית החומר מיועד?", "האם האתר דורש משלוח מנוף?".
- שפת המותגים: אנחנו מדברים רק בסטנדרט הגבוה – סיקה, תרמוקיר, נירלט, טמבור.

🛑 פרק 5: בקרת לוגיסטיקה וחיובים קשיחים
מניעת זליגת כספים וחומרים דרך אוטומציה של הוספת פריטי פיקדון:
- מעל 10 שקים (25 ק"ג) ⬅️ משטח סבן פקדון (מק"ט סבן: 60060)
- מעל 20 בלוקים ⬅️ משטח בלוקים פקדון (מק"ט סבן: 60006)
- הזמנת שק גדול (טיט/חול/סומסום) ⬅️ שק גדול פקדון (מק"ט סבן: 60002)

חוק מלאי חסר: בשום פנים ואופן לא מבטלים הזמנה! הסטטוס משתנה אוטומטית ל-"הזמנה מיוחדת" ועובר ישירות לטיפול מחלקת רכש.

⏱️ פרק 6: בקרת זמני מנוף (PTO) וזיכויים

חדר השקיפות: הסוף לדיווחים כוזבים
כדי לוודא שכל דקת מנוף מדווחת ומחויבת כראוי, נועה מצליבה 3 עוגני מידע:
1. הדיווח הידני שהנהג (חכמת) רשם על תעודת המשלוח.
2. התראות ה-BlackBox (איתוראן) שמתקבלות למייל של ראמי.
3. ההקלדה בדו"ח היומי של מערכת iweb2+.
- טריגר חריגה: פער של מעל 15 דקות בין הדיווח הידני למציאות בשטח (איתוראן) יסומן מיד באדום כ"חריגה", ויעבור לאישור חריגים שלך או של יואב.

בקרת זיכויים והחזרות מלאי
- חוק ירוק: שום זיכוי (משטחים, שקים, ציוד) לא עובר במערכת ללא "אישור החזרה ירוק" חתום פיזית על ידי אורן המחסנאי.
- עצירת זיכוי אוטומטי: אם מתגלה חוסר בהחזרה לעומת האישור, תהליך הזיכוי נעצר מיד ונועה מוציאה התרעה מפורטת לבדיקתך.

---

Volume 3: 🌟 LOGIX: OPERATIONAL ANALYTICS & PERFORMANCE ENGINE (v66)

1. פרוטוקול נתוני אמת בלבד (Zero-Simulation Policy)
- חוק ה-Real-Time: חל איסור מוחלט על נועה לבצע סימולציות דמה או הערכות גנריות.
- בכל פעם שראמי מבקש "ניתוח ביצועים", "צפי מלאי" או "חיזוי רווחיות", עליך לבצע שאילתת אמת מול המאגרים המוגדרים:
  - Orders DB: Sidor-noaa - הזמנות.csv / Sidor-noaa - מכירות.csv
  - Inventory DB: Sidor-noaa - Inventory_Stock.csv / Sidor-noaa - מלאי.csv
- אם הנתונים אינם קיימים באותה נקודת זמן, עליך לדווח: "המפקד, הנתון אינו זמין במאגר האמת, אבקש לסנכרן דוח חדש."

2. מנוע מדדי ביצועים (LOGIX KPIs)
בעת הצגת ניתוח ביצועים, עליך להשתמש בנוסחאות האמת הבאות (חישוב מבוסס נתוני הזמנות ומלאי):
- Predictive ROI: (PriceAtSale - AvgPurchaseCost) * Quantity - חישוב על בסיס ה-priceAtSale מקובץ המכירות.
- Inventory Health: CurrentStock - (AverageWeeklyConsumption * 2) -> אם התוצאה < 0, סמני כמוצר בסיכון (Stockout Risk).
- Driver Efficiency: ניתוח זמני אספקה (ETA vs Actual) בהתבסס על Order_Tracking.csv.

3. מבנה פלט אסטרטגי (LOGIX Report)
עליך להציג את התוצאות אך ורק בטבלה תקנית המוכנה להעתקה ל-Sheets:
מוצר/לקוח | כמות מכורה (אמת) | מלאי זמין | תחזית צריכה לשבוע | סטטוס
[שם] | [מספר] | [מספר] | [חישוב] | [חיווי]

4. מניעת הזיות (Hallucination Guardrails)
- אין להמציא לקוחות. הצליבי כל שם עם Sidor-noaa - לקוחות.csv.
- אין להמציא נהגים. הצליבי כל שם עם Sidor-noaa - נהגים.csv.
- השתמשי רק בערכים שנמצאים בקבצים המצורפים.
`;

// Helper to generate unique tracking ID
const generateTrackingId = () => Math.random().toString(36).substring(2, 10).toUpperCase();

export const getOrderByTrackingId = async (trackingId: string) => {
  const q = query(collection(db, 'orders'), where('trackingId', '==', trackingId), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Order;
};

export const createOrder = async (orderData: Partial<Order>) => {
  if (!auth.currentUser) throw new Error('Not authenticated');

  let customerId = orderData.customerId;
  const customerPhone = orderData.customerPhone || "";
  const customerName = orderData.customerName || "לקוח מזדמן";
  let customerStatus: "קיים" | "חדש" = "קיים";

  // Automated Onboarding Logic
  if (!customerId && customerPhone) {
    // Try matching by phone first, then phoneNumber
    const q1 = query(collection(db, 'customers'), where('phone', '==', customerPhone), limit(1));
    const snap1 = await getDocs(q1);
    
    let existingCustomer = snap1.empty ? null : snap1.docs[0];
    
    if (!existingCustomer) {
      const q2 = query(collection(db, 'customers'), where('phoneNumber', '==', customerPhone), limit(1));
      const snap2 = await getDocs(q2);
      if (!snap2.empty) existingCustomer = snap2.docs[0];
    }
    
    if (existingCustomer) {
      // Existing Customer
      customerId = existingCustomer.id;
      customerStatus = "קיים";
      await updateDoc(doc(db, 'customers', customerId), {
        totalOrders: (existingCustomer.data().totalOrders || 0) + 1,
        lastOrderAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    } else {
      // New Customer Onboarding
      customerStatus = "חדש";
      const phoneDigits = customerPhone.replace(/[^0-9]/g, '');
      const lastFour = phoneDigits.slice(-4);
      const newCustomerId = `CUST-${lastFour || Math.floor(1000 + Math.random() * 9000)}`;
      
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
  
  try {
    const docRef = await addDoc(collection(db, 'orders'), fullOrder);
    const result = { 
      id: docRef.id, 
      ...fullOrder,
      customerStatus,
      customerNumber: `CUST-${customerPhone.replace(/[^0-9]/g, '')}`
    };

    // Sync to GAS via Orchestrator (Explicit user action)
    window.dispatchEvent(new CustomEvent('sync-trigger', { 
      detail: { type: 'order', data: result } 
    }));

    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, 'orders');
    throw error;
  }
};

export const updateOrder = async (orderId: string, updates: Partial<Order>) => {
  try {
    const docRef = doc(db, 'orders', orderId);
    const updatePayload = {
      ...updates,
      updatedAt: serverTimestamp(),
    };
    await updateDoc(docRef, updatePayload);

    // Sync to GAS via Orchestrator
    window.dispatchEvent(new CustomEvent('sync-trigger', { 
      detail: { type: 'order', data: { id: orderId, ...updates } } 
    }));
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    throw error;
  }
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

// --- Smart Logistics Functions ---

export const getSmartLocationInsights = async (address: string) => {
  try {
    const term = address.trim().toLowerCase();
    const q = query(collection(db, 'smart_locations'), orderBy('normalizedAddress'));
    const snapshot = await getDocs(q);
    
    const matches = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as SmartLocation))
      .filter(loc => loc.address.toLowerCase().includes(term) || loc.normalizedAddress.includes(term));

    return matches.length > 0 ? matches[0] : null;
  } catch (error) {
    console.error("Failed to fetch smart location insights:", error);
    return null;
  }
};

export const recordDeliveryLocation = async (deliveryData: {
  address: string;
  driverId: string;
  unloadingTime: number;
  ptoActive: boolean;
  notes?: string;
}) => {
  try {
    const normalized = deliveryData.address.trim().toLowerCase();
    const q = query(collection(db, 'smart_locations'), where('normalizedAddress', '==', normalized), limit(1));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      const existing = snapshot.docs[0].data() as SmartLocation;
      
      const newTotal = existing.totalDeliveries + 1;
      const newAvgTime = ((existing.averageUnloadingTime * existing.totalDeliveries) + deliveryData.unloadingTime) / newTotal;

      await updateDoc(doc(db, 'smart_locations', docId), {
        totalDeliveries: newTotal,
        averageUnloadingTime: newAvgTime,
        hasPTOHistory: existing.hasPTOHistory || deliveryData.ptoActive,
        lastDeliveryAt: serverTimestamp(),
        customerNotes: deliveryData.notes ? [...(existing.customerNotes || []), deliveryData.notes] : (existing.customerNotes || [])
      });
    } else {
      const newLoc: SmartLocation = {
        address: deliveryData.address,
        normalizedAddress: normalized,
        totalDeliveries: 1,
        averageUnloadingTime: deliveryData.unloadingTime,
        bestDriverId: deliveryData.driverId,
        hasPTOHistory: deliveryData.ptoActive,
        ptoAverageDuration: deliveryData.ptoActive ? deliveryData.unloadingTime : 0,
        customerNotes: deliveryData.notes ? [deliveryData.notes] : [],
        lastDeliveryAt: serverTimestamp()
      };
      await addDoc(collection(db, 'smart_locations'), newLoc);
    }
  } catch (error) {
    console.error("Failed to record delivery location:", error);
  }
};

export const planOptimizedRoute = async (driverId: string, date: string) => {
  // Implementation would typically involve complex logic or external API
  // For now, we return a structured suggestion based on existing orders
  const q = query(
    collection(db, 'orders'), 
    where('driverId', '==', driverId),
    where('date', '==', date),
    orderBy('time', 'asc')
  );
  const snap = await getDocs(q);
  const orders = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  
  if (orders.length === 0) return { message: "אין הזמנות לנהג זה בתאריך המבוקש." };

  return {
    driverId,
    date,
    suggestedSequence: orders.map(o => ({
      orderId: o.id,
      destination: o.destination,
      time: o.time,
      customer: o.customerName
    })),
    optimizationNotes: "המסלול מבוסס על סדר כרונולוגי של הזמנות. מומלץ לבדוק עומסי תנועה בזמן אמת."
  };
};

export const analyzeCustomerPatterns = async (customerName: string) => {
  try {
    const q = query(
      collection(db, 'orders'),
      where('customerName', '==', customerName),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const snap = await getDocs(q);
    const history = snap.docs.map(d => d.data() as Order);

    if (history.length < 3) return null;

    // Pattern 1: Recurring Items
    const itemCounts: Record<string, number> = {};
    history.forEach(o => {
      const items = parseItems(o.items);
      items.forEach(i => {
        itemCounts[i.name] = (itemCounts[i.name] || 0) + 1;
      });
    });
    const recurringItem = Object.entries(itemCounts).find(([_, count]) => count >= 3)?.[0];

    // Pattern 2: Preferred Service Days
    const dayCounts: Record<number, number> = {};
    history.forEach(o => {
      const day = new Date(o.date).getDay();
      dayCounts[day] = (dayCounts[day] || 0) + 1;
    });
    const preferredDay = Object.entries(dayCounts).find(([_, count]) => count >= 3)?.[0];

    return {
      recurringItem,
      preferredDay: preferredDay ? ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][parseInt(preferredDay)] : null,
      totalOrders: history.length
    };
  } catch (err) {
    console.error("Pattern analysis failed:", err);
    return null;
  }
};

export const getBasketAnalysis = async (customerName: string) => {
  if (!auth.currentUser) {
    console.warn("⚠️ getBasketAnalysis skipped: User not authenticated");
    return null;
  }

  try {
    // 1. Fetch all sales records for this customer to find patterns
    const q = query(
      collection(db, 'sales'),
      where('customerName', '==', customerName),
      orderBy('date', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    const sales = snap.docs.map(d => d.data() as SaleRecord);

    if (sales.length < 2) return null;

    // 2. Identify recurrence of items
    const itemFrequency: Record<string, number> = {};
    sales.forEach(sale => {
      const itemName = sale.itemId; // Using itemId as the product identifier
      itemFrequency[itemName] = (itemFrequency[itemName] || 0) + 1;
    });

    // 3. Simple Basket Analysis (Association Rules)
    // We want to find: if they bought A, they also bought B in the same order
    // Order grouping by date/time or orderId
    const orders: Record<string, string[]> = {};
    sales.forEach(sale => {
      if (!sale.orderId) return;
      if (!orders[sale.orderId]) orders[sale.orderId] = [];
      orders[sale.orderId].push(sale.itemId);
    });

    const associations: Record<string, Record<string, number>> = {};
    Object.values(orders).forEach(items => {
      items.forEach(itemA => {
        if (!associations[itemA]) associations[itemA] = {};
        items.forEach(itemB => {
          if (itemA === itemB) return;
          associations[itemA][itemB] = (associations[itemA][itemB] || 0) + 1;
        });
      });
    });

    // Find the strongest association
    let bestPair = null;
    let maxCount = 0;

    for (const [itemA, relatedItems] of Object.entries(associations)) {
      for (const [itemB, count] of Object.entries(relatedItems)) {
        if (count > maxCount) {
          maxCount = count;
          bestPair = { itemA, itemB, count };
        }
      }
    }

    return {
      topItems: Object.entries(itemFrequency).sort((a, b) => b[1] - a[1]).slice(0, 3),
      suggestion: bestPair ? `הלקוח נוטה להזמין "${bestPair.itemA}" יחד עם "${bestPair.itemB}". כדאי להציע להוסיף את "${bestPair.itemB}" להזמנה הנוכחית.` : null,
      totalSalesAnalysed: sales.length
    };
  } catch (err) {
    console.error("Basket analysis failed:", err);
    return null;
  }
};

export const getLogisticsInsight = async (customerName: string, currentDestination: string) => {
  const patterns = await analyzeCustomerPatterns(customerName);
  const consolidation = await analyzeLocationConsolidation(currentDestination);
  const basket = await getBasketAnalysis(customerName);

  let insightArr = [];
  
  if (patterns?.recurringItem) {
    insightArr.push(`הלקוח נוטה להזמין "${patterns.recurringItem}" בתדירות גבוהה.`);
  }
  
  if (patterns?.preferredDay) {
    insightArr.push(`רוב האספקות מתבצעות בימי ${patterns.preferredDay}.`);
  }

  if (basket?.suggestion) {
    insightArr.push(`💡 נועה Insight: ${basket.suggestion}`);
  }

  if (consolidation.pendingOrders > 0) {
    insightArr.push(`⚠️ התראה: קיימות ${consolidation.pendingOrders} הזמנות פתוחות ליעד זה (${currentDestination}). מומלץ לבצע איחוד נסיעות.`);
  }

  return insightArr.join('\n');
};

export const getTrafficRefinedRoute = async (origin: string = "הוד השרון", destination: string = "") => {
  const safeOrigin = origin || "";
  const safeDest = destination || "";
  
  const isTayibeOrigin = safeOrigin.includes("טייבה");
  const isHodHasharonOrigin = safeOrigin.includes("הוד השרון") || safeOrigin.includes("החרש") || safeOrigin.includes("התלמיד");

  let baseTime = 30; // Default minutes
  
  // Simple heuristic for Tayibe/Hod HaSharon routes
  if (isTayibeOrigin && safeDest.includes("הוד השרון")) baseTime = 25;
  if (isHodHasharonOrigin && safeDest.includes("טייבה")) baseTime = 25;
  if (safeDest.includes("תל אביב") || safeDest.includes("הרצליה")) baseTime = 45;

  const buffer = 1.25; // 25% Traffic Buffer as per instruction
  const finalTime = Math.round(baseTime * buffer);

  return {
    origin,
    destination,
    estimatedMinutes: finalTime,
    trafficLevel: finalTime > 40 ? "heavy" : "moderate"
  };
};

export const analyzeLocationConsolidation = async (destination: string) => {
  const q = query(
    collection(db, 'orders'),
    where('destination', '==', destination),
    where('status', 'in', ['pending', 'preparing', 'ready']),
    limit(5)
  );
  const snap = await getDocs(q);
  
  return {
    destination,
    pendingOrders: snap.size,
    orderIds: snap.docs.map(doc => doc.id)
  };
};

// --- Chat Session Management ---
export const getChatSessions = async (userId: string): Promise<ChatSession[]> => {
  try {
    const q = query(
      collection(db, `users/${userId}/chat_sessions`),
      orderBy("updatedAt", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatSession[];
  } catch (error) {
    console.error("Error fetching chat sessions:", error);
    return [];
  }
};

export const getChatSessionMessages = async (userId: string, sessionId: string): Promise<ChatMessage[]> => {
  try {
    const q = query(
      collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`),
      orderBy("timestamp", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ChatMessage[];
  } catch (error) {
    console.error("Error fetching session messages:", error);
    return [];
  }
};

export const createChatSession = async (userId: string, title: string): Promise<string> => {
  const sessionRef = doc(collection(db, `users/${userId}/chat_sessions`));
  const now = serverTimestamp();
  await setDoc(sessionRef, {
    title,
    userId,
    createdAt: now,
    updatedAt: now
  });
  return sessionRef.id;
};

export const deleteChatSession = async (userId: string, sessionId: string) => {
  const batch = writeBatch(db);
  
  // Delete messages first (or at least prepare to)
  const messagesSnap = await getDocs(collection(db, `users/${userId}/chat_sessions/${sessionId}/messages`));
  messagesSnap.forEach(doc => batch.delete(doc.ref));
  
  // Delete session
  batch.delete(doc(db, `users/${userId}/chat_sessions/${sessionId}`));
  
  await batch.commit();
};

export const updateChatSession = async (userId: string, sessionId: string, updates: Partial<ChatSession>) => {
  const sessionRef = doc(db, `users/${userId}/chat_sessions/${sessionId}`);
  await updateDoc(sessionRef, {
    ...updates,
    updatedAt: serverTimestamp()
  });
};

// --- Private Chat History (Legacy support or fallback) ---
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
        name: "process_order",
        description: "נתח רשימת פריטים להזמנה והעבר אותם למנוע ההזמנות החכם לעיבוד לוגיסטי. השתמש בזה כשיש רשימה של פריטים לעבור עליהם.",
        parameters: {
          type: Type.OBJECT,
          properties: {
            items: { type: Type.STRING, description: "רשימת הפריטים כפי שהתקבלו מהלקוח (טקסט חופשי)" }
          },
          required: ["items"]
        }
      },
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
            documentIds: { type: Type.ARRAY, items: { type: Type.STRING }, description: "מזהי מסמכים נוספים (תעודות, חשבוניות וכו')" },
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
            documentIds: { type: Type.ARRAY, items: { type: Type.STRING } },
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
            folderId: { type: Type.STRING, description: "מזהה התיקייה (אופציונלי, ברירת מחדל לתיקיית סידור)" }
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
      },
      {
        name: "get_smart_location_insights",
        description: "קבל תובנות היסטוריות על כתובת משלוח (זמן פריקה, היסטוריית מנוף/PTO וכו')",
        parameters: {
          type: Type.OBJECT,
          properties: {
            address: { type: Type.STRING, description: "הכתובת לחיפוש" }
          },
          required: ["address"]
        }
      },
      {
        name: "get_basket_analysis",
        description: "נתח את סל הקניות ההיסטורי של הלקוח כדי למצוא דפוסי רכישה והצעות משלימות (Cross-sell)",
        parameters: {
          type: Type.OBJECT,
          properties: {
            customerName: { type: Type.STRING, description: "שם הלקוח לניתוח" }
          },
          required: ["customerName"]
        }
      },
      {
        name: "record_delivery_location",
        description: "תעד הצלחה של משלוח לכתובת מסוימת כולל נתוני פריקה ו-PTO",
        parameters: {
          type: Type.OBJECT,
          properties: {
            address: { type: Type.STRING, description: "כתובת היעד" },
            driverId: { type: Type.STRING, description: "מזהה הנהג" },
            unloadingTime: { type: Type.NUMBER, description: "זמן הפריקה בדקות" },
            ptoActive: { type: Type.BOOLEAN, description: "האם הופעל מנוף/מערכת PTO?" },
            notes: { type: Type.STRING, description: "הערות נוספות על הגישה ליעד" }
          },
          required: ["address", "driverId", "unloadingTime", "ptoActive"]
        }
      },
      {
        name: "plan_optimized_route",
        description: "תכנן מסלול אופטימלי לנהג ליום מסוים בהתבסס על היסטוריית יעדים",
        parameters: {
          type: Type.OBJECT,
          properties: {
            driverId: { type: Type.STRING, description: "מזהה הנהג" },
            date: { type: Type.STRING, description: "תאריך (YYYY-MM-DD)" }
          },
          required: ["driverId", "date"]
        }
      }
    ]
  }
];

async function fileToGenerativePart(file: File) {
  return new Promise<any>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({
        inlineData: {
          data: base64,
          mimeType: file.type || 'application/pdf'
        }
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function askNoa(message: string, history: any[] = [], userKey?: string, file?: File) {
  // Production Protocol v64 - Device Detection
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  const deviceTag = isMobile ? "[DEVICE: MOBILE]" : "[DEVICE: DESKTOP]";
  
  const systemPrompt = `נועה (Noa) - CRM Engine v64.
המפקד: ראמי אהובי. המנכ"ל: הראל.
שפת שיחה: עברית נשית, מקצועית, "Saban-Precision".
חוקים: 
1. אפס טקסט שקוף (Anti-Transparent).
2. פלט מותאם למכשיר: ${deviceTag}.
3. כיווץ רווחים מקסימלי (Compact Density).
4. כפתורים אינטראקטיביים עם data-intent ו-data-payload (customer_history, inventory, siddur, whatsapp, galia_notes, confirm_galia).
5. חתימה בסיום: <div class="signature">באדיבות נועה ❤️</div>`;

  const enhancedMessage = `${deviceTag} ${message}`;

  let parts: any[] = [{ text: `${systemPrompt}\n\nClient Message: ${enhancedMessage}` }];
  
  if (file) {
    const filePart = await fileToGenerativePart(file);
    parts = [filePart, ...parts];
  }

  const contents = [...history, { role: 'user', parts }];
  return await processNoaTurn(contents, userKey);
}

async function processNoaTurn(contents: any[], userKey?: string): Promise<any> {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  const dayName = new Date().toLocaleDateString('he-IL', { weekday: 'long', timeZone: 'Asia/Jerusalem' });
  
  let dynamicInstruction = `${noaSystemInstruction}\n\nהזמן הנוכחי במערכת: ${dayName}, ${currentDateTime}.\nכשמדברים על "מחר", הכוונה היא ליום שאחרי התאריך המופיע כאן.`;
  
  if (userKey) {
    dynamicInstruction += `\n המשתמש הנוכחי שאת מדברת איתו הוא: ${userKey}. חל איסור מוחלט להציג מידע של משתמשים אחרים!`;
    
    // SabanOS DNA Mapping
    const uKey = userKey.toLowerCase();
    if (uKey.includes('vered') || uKey.includes('ורד')) {
      dynamicInstruction += `\n DNA Profile: ורד אידלסון (IT). דברי אליה ישירות, קצר, נשי. היא מתעצבנת מהר. בנה עידן שחקן כדורסל בהוד השרון. תזכירי לה את בדיקת תעודות גליה.`;
    } else if (uKey.includes('netanel') || uKey.includes('נתנאל')) {
      dynamicInstruction += `\n DNA Profile: נתנאל רבינוביץ (רכש). חרדי מאלעד. צייני זמני תפילה (מנחה 13:45). מנהל מחסן 90 אוויר (משלוח ישיר).`;
    } else if (uKey.includes('oren') || uKey.includes('אורן')) {
      dynamicInstruction += `\n DNA Profile: אורן (מנהל חצר החרש). חברי, גברי, תפעולי. מוגבל לנתוני חצר החרש.`;
    }
  }

  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: contents,
    systemInstruction: dynamicInstruction,
    tools: tools,
    config: {}
  });

  const functionCalls = response.functionCalls;
  
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
            
            const analysisResponse = await callGemini({
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
          case 'get_smart_location_insights':
            result = await getSmartLocationInsights(call.args.address as string);
            break;
          case 'get_basket_analysis':
            result = await getBasketAnalysis(call.args.customerName as string);
            break;
          case 'record_delivery_location':
            await recordDeliveryLocation(call.args as any);
            result = { success: true };
            break;
          case 'plan_optimized_route':
            result = await planOptimizedRoute(call.args.driverId as string, call.args.date as string);
            break;
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

export async function generate1700Report(history: any[], orders: any[]) {
  const currentDateTime = new Date().toLocaleString('he-IL', { timeZone: 'Asia/Jerusalem' });
  
  const systemPrompt = `
    את "נועה", מגשרת התפעול של סידור ח.סבן חומרי בנין.
    עלייך להפיק "דוח 17:00 יומי" עבור קבוצת הוואטסאפ של צוות סבן.
    
    הדוח חייב להיות מובנה, מקצועי ובעברית, לפי הפורמט הבא:
    *נועה - סיכום פעילות יומי [תאריך]* 🏗️
    
    [שם לקוח] - [נושא שפורמט] - [הפתרון המקצועי של נועה] - [סטטוס: בוצע/ממתין].
    
    בסוף הדוח הוסיפי סיכום קצר על עומס העבודה היום.
    חתימה חובה: "באדיבות נועה ❤️"
  `;

  const inputData = `
    היסטוריית צ'אט אחרונה (24 שעות):
    ${JSON.stringify(history)}
    
    הזמנות שטופלו היום:
    ${JSON.stringify(orders)}
  `;

  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: inputData }] }],
    systemInstruction: systemPrompt
  });

  return response.text;
}

export async function processNoaBridge(input: string | { fileBase64: string, mimeType: string }) {
  const inventoryQ = query(collection(db, 'inventory'));
  const inventorySnap = await getDocs(inventoryQ);
  const inventory = inventorySnap.docs.map(d => ({ id: d.id, ...d.data() })) as InventoryItem[];

  const customersQ = query(collection(db, 'customers'), orderBy('name', 'asc'));
  const customersSnap = await getDocs(customersQ);
  const customers = customersSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Customer[];

  const systemPrompt = `
    את "נועה", המגשרת הלוגיסטית והאסטרטגית של סידור ח.סבן (Production Protocol v64 - Free-Text Smart Analysis Protocol).
    תפקידך לנתח קלט גולמי (טקסט או PDF) ולהציב נתונים מדויקים מול מאגרי המאסטר במערכת.

    פרוטוקול ניתוח ודיוק (Zero Hallucination Control):
    1. חוק האמת היחידה:
       - אין ניחושים כלל! אסור מוחלט להמציא שמות מוצרים, מק"טים (SKU), או לקוחות שנראים לך "הגיוניים".
       - אם פריט מהטקסט החופשי אינו מופיע במאגר המלאי, אל תייצר לו מק"ט או שם פיקטיבי. השאר את ה-sku ריק או הגדר כריק והגדר את שם הפריט במדויק.

    2. מנגנון הצלבת מוצרים מדויקת (Smart Inventory Match):
       - שלב א': סריקת מק"ט (Primary Key): סרוק את הטקסט בחיפוש אחר מספרים שתואמים ל-SKU במאגר המלאי המופיע להלן. אם נמצאה התאמה - עבוד רק עם שאר הנתונים התואמים למק"ט זה במאגר.
       - שלב ב': הצלבה סמנטית (Semantic Fallback): אם אין מק"ט מזוהה בהודעה, ערוך סריקה של מילות מפתח (למשל "דבש 116", "גבס ירוק", "חול ים") והצלב מול שדה ה-Name הרשמי ברשימת המלאי. בחר את ההתאמה האופטימלית הקרובה ביותר תוך התעלמות משגיאות כתיב קלות.
       - אם הפריט תואם בהצלחה, הגדר את ה"status" שלו כ-"validated" ואת שם ה-Name וה-sku בדיוק כפי שהם במאגר.
       - אם הפריט לא נמצא במאגר, הגדר את ה"status" כ-"missing_specs" והשאר את ה-sku כריק.

    3. זיהוי והצלבת לקוחות (Customer Recognition):
       - זהה שמות אנשים, חברות, כתובות יעד או מספרי טלפון מתוך הטקסט הגולמי.
       - חפש התאמה מדויקת או קרובה ביותר בקולקציית הלקוחות (customers) המפורטת להלן. במידה ומצאת, החזר את השם הרשמי והגדר isNew: false. אחרת, סמן כ-isNew: true והשאר את מזהה הלקוח ריק.

    4. חוק הלקוח (WhatsApp Concierge): 
       - נסח פנייה חמה ומקצועית ללקוח (גוף שני), ציין את כל הפריטים שאותרו וסוכמו, הדגש בבירור פריטים שהם special_order (חסרים או מחוץ למלאי), ובקש אישור לביצוע.

    5. ניתוח חכם והצעות למוצרים משלימים (Smart Business Analytics):
       - זהי פריטים כ-"הזמנות מיוחדות" (special_order) - פריטים שאינם קטלוגיים סטנדרטיים או כאלו הדורשים ייצור/תיאום מיוחד (למשל: תערובות מיוחדות, מוצרים במידות לא סטנדרטיות). פריטים שמעמדם missing_specs הם בהחלט בקטגוריה זו.
       - הציעי מוצרים משלימים (Complementary Recommendations) המבוססים על תוכן הסל (לדוגמה: לגבס -> ברגי גבס 25 מ"מ, פרופילים, שפכטל אמריקאי; למלט -> חול ים, חצץ, כלי עבודה; לבלוקים -> מלט לבן/שחור, חול; לצבע -> מברשות, רולר, ניילון הגנה, מסקנטייפ; לברזל בניין -> חוט קשירה, כפפות).

    6. חתימה חובה בסיום הודעת הוואטסאפ:
       <div class="signature">באדיבות נועה ❤️</div>
    
    נתוני מערכת לחיפוש (מלאי זמין):
    ${inventory.map(i => `[SKU: ${i.sku}, Name: ${i.name}, Unit: ${i.unit}]`).join('\n')}
    
    נתוני מערכת לחיפוש (לקוחות קיימים):
    ${customers.map(c => `[ID: ${c.id}, Name: ${c.name}, Phone: ${c.phone || c.phoneNumber || ''}, Sites: ${JSON.stringify(c.siteProfiles || [])}, Waze: ${JSON.stringify(c.wazeLinks || {})}]`).join('\n')}
    
    החזירי JSON בלבד במבנה הבא:
    {
      "customer": { "id": "customerId", "name": "customerName", "isNew": boolean, "recallNote": "תובנה מהזיכרון הלוגיסטי אם קיימת" },
      "site": "destination",
      "items": [
        { "raw": "text", "sku": "sku", "name": "name", "qty": number, "status": "validated" | "missing_specs" }
      ],
      "whatsappResponse": "טקסט פנייה ללקוח משויף ומוכן לשליחה",
      "smartAnalysis": {
        "specialOrders": ["רשימת מוצרים מיוחדים או חריגים שזוהו בהזמנה זו וסיבת זיהויים ככאלו"],
        "complements": [
          { "name": "שם המוצר המשלים המוצע ללקוח", "reason": "הסבר מדוע מומלץ להציע מוצר זה בהתאם למוצרים שהוזמנו" }
        ]
      }
    }
  `;

  let parts: any[] = [{ text: typeof input === 'string' ? `נתחי את הטקסט הבא: ${input}` : `נתחי את הקובץ המצורף.` }];
  if (typeof input !== 'string') {
    parts.push({ inlineData: { data: input.fileBase64, mimeType: input.mimeType } });
  }

  const response = await callGemini({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts }],
    systemInstruction: systemPrompt,
    config: {
      responseMimeType: "application/json"
    }
  });

  try {
    const data = JSON.parse(response.text);
    if (!data) {
      throw new Error("פלט ריק מנועה AI");
    }
    if (!data.customer) {
      data.customer = {
        id: "",
        customerNumber: "",
        name: "לקוח כללי",
        isNew: true,
        recallNote: ""
      };
    } else {
      if (data.customer.isNew === undefined) {
        data.customer.isNew = !data.customer.id;
      }
      if (!data.customer.name) {
        data.customer.name = "לקוח כללי";
      }
      if (!data.customer.id) {
        data.customer.id = "";
      }
    }
    if (!Array.isArray(data.items)) {
      data.items = [];
    }
    return data;
  } catch (e) {
    console.error("Failed to parse Noa Bridge response successfully:", response.text, e);
    throw new Error("שגיאה בניתוח הנתונים על ידי נועה.");
  }
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

    let smartEta = '--:--';
    try {
      const { ETAEngine } = await import('../lib/ETA_Engine');
      const drivers = await getAllDrivers();
      const driver = drivers.find(d => d.id === order.driverId);
      const res = ETAEngine.calculateRefinedETA(order, driver);
      smartEta = res.eta;
    } catch (e) {
      console.warn("ETAEngine failed, falling back to pure AI", e);
    }

    const prompt = `
    חשב זמן הגעה משוער (ETA) עבור משלוח חומרי בניין.
    זמן יציאה/נוכחי: ${currentDateTime}
    מקום מוצא: מחסן ${order.warehouse} בהוד השרון.
    יעד למשלוח: ${order.destination}
    צפי מערכת בסיסי: ${smartEta}
    
    ${historyText}
    
    נא לבצע חיפוש בגוגל (Google Search) כדי למצוא כמה זמן לוקח להגיע מהוד השרון ל-${order.destination} ברכב פרטי/משאית קלה בשעה זו בהתחשב בעומסי תנועה.
    סיכום את זמן הנסיעה והוסף אותו לשעת היציאה (${currentDateTime}).
    
    תחזיר אך ורק את השעה הסופית בפורמט HH:mm (למשל 14:15). אל תוסיף שום מילה אחרת.
  `;

  try {
    const response = await callGemini({
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [
        { googleSearch: {} }
      ],
      toolConfig: { includeServerSideToolInvocations: true },
      config: {
        // Any other generation config here
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
