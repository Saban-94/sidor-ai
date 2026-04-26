/**
 * SabanOS Constants - Final Fix
 */
// הוספתי את VITE_GAS_URL_AI כעדיפות ראשונה
export const GAS_URL = 
  import.meta.env.VITE_GAS_URL_AI || 
  import.meta.env.VITE_GAS_URL_GEMINI || 
  import.meta.env.VITE_GAS_URL || 
  "https://script.google.com/macros/s/AKfycbxpG2Qg7zNbnnUiHisvUNYCl1SHUHR1GUyz68_7BeHkpeDCNTgtIZGjeRCTUOPVPZex/exec";
