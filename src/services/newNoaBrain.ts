/**
 * SabanOS - New Noa Brain Service
 * עצמאי לחלוטין, מותאם ל-Vercel ומחובר ללוגיסטיקה של ח. סבן
 */

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface NoaContext {
  inventory?: any[];
  drivers?: any[];
  activeOrders?: any[];
  userPreferences?: string;
}

const SYSTEM_PROMPT = `
אתה "נועה" - המוח הלוגיסטי המתקדם של SabanOS.
התפקיד שלך הוא לעזור לראמי לנהל את המלאי, הנהגים וההזמנות של ח. סבן.

הנחיות אישיות:
1. סגנון דיבור: מקצועי, חד, ענייני, חברי (כמו אחות לעסק).
2. שפה: עברית פשוטה בגובה העיניים, בלי "חפירות".
3. מומחיות: את מכירה את המחסן בהוד השרון, את הנהגים (עלי, חכמת וכו'), ואת חשיבות הדיוק במלאי ובסידור.
4. פעולה: כששואלים על מלאי או נהגים, תני תשובות פרקטיות. אם חסר נתון, תגידי שאת בודקת ב-Firestore.

חוקי ברזל:
- אל תזכירי שאת בינה מלאכותית.
- תמיד תסיימי בשורת TL;DR קצרה אם התשובה ארוכה.
- את שותפה לניהול, לא רק עוזרת.
`;

export class NewNoaBrain {
  private static instance: NewNoaBrain;
  private apiKey: string = import.meta.env.VITE_GEMINI_API_KEY || ''; // וודא שיש לך KEY ב-Vercel ENV

  private constructor() {}

  public static getInstance(): NewNoaBrain {
    if (!NewNoaBrain.instance) {
      NewNoaBrain.instance = new NewNoaBrain();
    }
    return NewNoaBrain.instance;
  }

  /**
   * פונקציה מרכזית למשלוח הודעה לנועה
   */
  public async askNoa(prompt: string, history: Message[], context: NoaContext): Promise<string> {
    try {
      // בניית הפרומפט המשולב עם הקשר המלאי והסידור
      const contextSummary = this.buildContextString(context);
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: SYSTEM_PROMPT }] },
            { role: 'model', parts: [{ text: "הבנתי, אני נועה מהיום. אני מוכנה לנהל את המלאי והסידור של ח. סבן יחד עם ראמי." }] },
            ...history.map(msg => ({
              role: msg.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: msg.content }]
            })),
            { role: 'user', parts: [{ text: `${contextSummary}\n\nשאלה מראמי: ${prompt}` }] }
          ],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        })
      });

      if (!response.ok) throw new Error('Failed to connect to Noa Brain');

      const data = await response.json();
      return data.candidates[0].content.parts[0].text;

    } catch (error) {
      console.error('Noa Brain Error:', error);
      return "ראמי אחי, יש לי ניתוק קטן בחיבור למאגר. תבדוק שה-API KEY מעודכן ב-Vercel.";
    }
  }

  /**
   * הזרקת נתוני המלאי והסידור לתוך המוח של נועה
   */
  private buildContextString(context: NoaContext): string {
    let str = "הקשר נוכחי למערכת:\n";
    
    if (context.inventory && context.inventory.length > 0) {
      str += `- מלאי: ישנם ${context.inventory.length} פריטים מעודכנים.\n`;
    }
    
    if (context.drivers && context.drivers.length > 0) {
      const onlineDrivers = context.drivers.filter(d => d.status === 'ONLINE').length;
      str += `- סידור: ${onlineDrivers} נהגים זמינים כרגע.\n`;
    }

    return str;
  }
}

export const noaBrain = NewNoaBrain.getInstance();
