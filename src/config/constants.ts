/**
 * SabanOS Constants - Final Fix
 */
// הוספתי את VITE_GAS_URL_AI כעדיפות ראשונה
export const GAS_URL = 
  import.meta.env.VITE_GAS_URL_AI || 
  import.meta.env.VITE_GAS_URL_GEMINI || 
  import.meta.env.VITE_GAS_URL || 
  "https://script.google.com/macros/s/AKfycbyYtJI5Jl7tsDUsfRBIvP7X67PtMgcxJztL-XOwcblDEszIRzj6HuesIraA_Z7pH1lv7Q/exec";
