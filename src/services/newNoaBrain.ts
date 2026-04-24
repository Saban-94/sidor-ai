import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

const SYSTEM_INSTRUCTION = `
את נועה, השותפה הלוגיסטית של ראמי בניהול "ח. סבן". 
את מומחית בניהול מלאי, סידור נהגים (עלי, חכמת) ולוגיסטיקה בטייבה והוד השרון.
סגנון: מקצועי, חד, אנושי ותמציתי. 
משימה: לעזור לראמי לנהל את העסק ביעילות מקסימלית.
`;

export const askNewNoa = async (prompt: string, history: any[], context: { inventory: any[], drivers: any[] }) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: SYSTEM_INSTRUCTION 
    });

    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || msg.parts?.[0]?.text || '' }],
      })),
    });

    // הזרקת נתונים חיים מה-Firestore לתוך השאלה
    const dataContext = `
      נתוני מערכת נוכחיים:
      מלאי: ${JSON.stringify(context.inventory?.slice(0, 5))}
      נהגים: ${JSON.stringify(context.drivers?.filter(d => d.status === 'ONLINE'))}
    `;

    const result = await chat.sendMessage(`${dataContext}\n\nשאלה מהמשתמש: ${prompt}`);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Noa Brain Error:", error);
    throw error;
  }
};
