import { 
  collection, addDoc, updateDoc, deleteDoc, doc, 
  query, where, getDocs, serverTimestamp, orderBy, limit 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { Order, Driver, Customer, Reminder } from '../types';
import { listDriveFiles, getFileBase64, createCustomerFolderHierarchy } from './driveService';
import { GoogleGenerativeAI } from "@google/generative-ai";

// --- הגדרות ---
export enum Type { OBJECT = "OBJECT", STRING = "STRING", NUMBER = "NUMBER" }

let genAIInstance: GoogleGenerativeAI | null = null;
const getAiInstance = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAIInstance) genAIInstance = new GoogleGenerativeAI(apiKey);
  return genAIInstance;
};

const MODEL_PRIORITY = [
  "gemini-3.1-pro-preview", 
  "gemini-3.1-flash-lite-preview", 
  "gemini-1.5-flash"
];

const sanitizeForVoice = (text: string) => 
  text.replace(/<[^>]*>?/gm, '').replace(/[^\u0590-\u05FF0-9\s,.?!]/g, ' ').trim();

// --- המוח (System Instruction) ---
export const noaSystemInstruction = `
אתה "נועה" (NOA) - מנהלת המשימות והלוגיסטיקה החכמה של סידור, שותפה של ראמי בחברת ח.סבן.
1. איסור המצאה - חובה להשתמש ב-tools.
2. טבלאות HTML בלבד למוצרים (<table>).
3. "נשמה" שמור רק לראמי. הראל הוא בוס🕵️ או סבא👴.
`;

// --- Tools ---
// --- עדכון ה-System Instruction לחסימת המצאות ---
export const noaSystemInstruction = `
אתה "נועה" - מנהלת לוגיסטיקה חכמה. 
חוק ברזל: אסור לך להמציא נתונים! 
בכל פעם ששואלים על דוח, סידור, נהגים או לקוחות - את חייבת להפעיל את הכלי המתאים (כמו get_orders_by_date).
אם הכלי מחזיר רשימה ריקה, תגידי: "בוס, המאגר ריק כרגע", אל תמציאי נהגים או חריגות שלא קיימים.
טון: "אהלן סבא 👴" או "הראל בוס".
`;

// --- עדכון פונקציית askNoa לוודא שליפה ---
export async function askNoa(message: string, history: any[] = []) {
  const ai = getAiInstance();
  if (!ai) return { text: "שגיאת מפתח", audioContent: "" };

  for (const modelName of MODEL_PRIORITY) {
    try {
      const model = ai.getGenerativeModel({ 
        model: modelName, 
        systemInstruction: noaSystemInstruction, 
        tools: tools 
      });

      const chat = model.startChat({
        history: history.map(h => ({ 
          role: h.role === 'model' ? 'model' : 'user', 
          parts: [{ text: h.parts?.[0]?.text || h.text || "" }] 
        }))
      });

      let result = await chat.sendMessage(message);
      let response = result.response;
      
      // הצינור שמוודא שליפה מהמאגר
      while (response.functionCalls()?.length) {
        const calls = response.functionCalls();
        const functionResponses = [];
        for (const call of calls) {
          const data = await handleToolCall(call); // כאן קורה הקסם האמיתי מול Firebase
          functionResponses.push({ functionResponse: { name: call.name, response: { content: data } } });
        }
        const secondResult = await chat.sendMessage(functionResponses);
        response = secondResult.response;
      }

      const text = response.text();
      return { text, audioContent: sanitizeForVoice(text) };

    } catch (err: any) {
      if (err.message?.includes('429')) continue;
      break;
    }
  }
  return { text: "בוס, יש נתק מול המאגר ב-Cloud. בודקת הרשאות...", audioContent: "" };
}
