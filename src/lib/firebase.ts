// saban-94/sidor-ai/src/lib/firebase.ts

import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json'; // טעינת ההגדרות מהקובץ שהעלית

// אתחול האפליקציה עם ההגדרות מה-Config
const app = initializeApp(firebaseConfig);

// חיבור ל-Firestore תוך שימוש ב-Database ID הספציפי מהקובץ
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * פונקציית בדיקת חיבור:
 * מנסה למשוך מסמך בדיקה כדי לוודא שהקונפיגורציה ב-Vercel תקינה.
 */
async function testConnection() {
  try {
    // ניסיון קריאה מהשרת כדי לוודא תקשורת חיה
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('permission-denied')) {
      // במידה ויש חוקי אבטחה, שגיאת הרשאה היא סימן חיובי שהחיבור לשרת הצליח
      console.log("חיבור ל-Firebase אומת בהצלחה (Permission denied כצפוי).");
    } else if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("שגיאה: הלקוח אופליין. בדוק את חיבור האינטרנט או את הגדרות ה-Firebase ב-Vercel.");
    } else {
      console.error("שגיאת חיבור ל-Firebase:", error);
    }
  }
}

// הרצת הבדיקה בעליית האפליקציה
testConnection();

// פונקציות עזר להתחברות
export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => auth.signOut();

// האזנה לשינויי סטטוס התחברות
export const onAuthChange = (callback: (user: any) => void) => onAuthStateChanged(auth, callback);
