import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); 
export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

/**
 * פונקציה קריטית: שולפת את ה-Token המעודכן של המשתמש המחובר.
 * זה המפתח שחייב לעבור ל-GAS כדי לפתור את שגיאת 403.
 */
export const getValidToken = async () => {
  const user = auth.currentUser;
  if (!user) return null;
  return await getIdToken(user, true); // true מאלץ רענון של ה-Token
};

// בדיקת חיבור משופרת
async function testConnection() {
  try {
    // מנסה לקרוא מסמך בדיקה כדי לוודא שה-API פתוח
    await getDocFromServer(doc(db, 'system', 'health'));
    console.log("SabanOS: Firebase connection established ✅");
  } catch (error: any) {
    if (error.code === 'permission-denied') {
      console.warn("SabanOS: Connected, but access restricted by Rules.");
    } else {
      console.error("SabanOS: Connection error:", error.message);
    }
  }
}

testConnection();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => auth.signOut();
