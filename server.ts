import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// אתחול Gemini עם הספרייה הרשמית והעדכנית
const API_KEY = process.env.VITE_GEMINI_API_KEY || "";
const genAI = API_KEY ? new GoogleGenerativeAI(API_KEY) : null;

aconst API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

export const generateAIResponse = async (prompt: string, history: any[], context: any) => {
  try {
    // שליחת הבקשה ישירות לגוגל - ללא מעבר בשרת הישן שקרס
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3.1-flash-lite-preview",
      systemInstruction: `
        אתה "נועה" (NOA) - מנהלת הלוגיסטיקה של ח.סבן, שותפה של ראמי.
        חוקי ברזל: 
        - שימוש בטבלאות HTML בלבד (<table>).
        - פנייה לראמי ב-"ראמי נשמה".
        - נתונים נוכחיים: ${JSON.stringify(context)}
      `
    });

    const chat = model.startChat({
      history: history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content || "" }],
      })),
    });

    const result = await chat.sendMessage(prompt);
    const response = await result.response;
    return response.text();
    
  } catch (error) {
    console.error("Gemini Direct SDK Error:", error);
    throw new Error("נכשלתי לדבר ישירות עם גוגל. בדוק את ה-API KEY.");
  }
};
        systemInstruction: `
          אתה "נועה" (NOA) - מנהלת הלוגיסטיקה של ח.סבן, שותפה של ראמי.
          תפקיד: ניהול סידור, נהגים (עלי/חכמת) ומלאי.
          סגנון: נשית👩🏼, עברית חדה, מקצועית וחברית.
          נתונים מהשטח: ${JSON.stringify(context || {})}
          חוקי ברזל: 
          - לראמי קוראים "ראמי נשמה". 
          - להראל קוראים "אהלן סבא 👴".
          - עיצוב טבלאות ב-HTML בלבד (<table>).
          - פנייה ב"פקודה בוצעה" לאחר פעולה.
        `
      });

      // יצירת צ'אט עם היסטוריה
      const chat = model.startChat({
        history: (history || []).map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content || "" }],
        })),
      });

      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      const text = response.text();
      
      res.json({ text });
    } catch (error: any) {
      console.error("Gemini Server Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // Vite middleware לפיתוח / הגשה לייצור
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
