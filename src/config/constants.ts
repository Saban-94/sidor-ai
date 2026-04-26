/**
 * SabanOS Constants
 * וודא שה-URL כאן הוא ה-Web App URL שקיבלת ב-Deploy האחרון (גרסה 26)
 */
export const GAS_URL = 
  import.meta.env.VITE_GAS_URL_GEMINI || 
  import.meta.env.VITE_GAS_URL_AI || 
  "https://script.google.com/macros/s/AKfycbxpG2Qg7zNbnnUiHisvUNYCl1SHUHR1GUyz68_7BeHkpeDCNTgtIZGjeRCTUOPVPZex/exec";

// טיפ: אם הכתובת ב-env חסרה, הוא ישתמש בכתובת הזו. 
// וודא שזו הכתובת של הגליון שבו ראית את "בדיקת דופק ידנית".
