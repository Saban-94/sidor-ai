import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromServer,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// CRITICAL FIX: Force long polling to bypass network proxies/CSP that block QUIC/WebSockets
// Also enable persistence for offline-first stability
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  experimentalForceLongPolling: true
}, (firebaseConfig as any).firestoreDatabaseId);

export const auth = getAuth();
export const googleProvider = new GoogleAuthProvider();

// Identity Cache for fallbacks during auth/quota-exceeded
const AUTH_CACHE_KEY = 'saban_auth_cache';
export const getCachedIdentity = () => {
  try {
    const cached = localStorage.getItem(AUTH_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch { return null; }
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastSeen: new Date().toISOString()
    }));
  }
});

// Test connection on boot with Quota Awareness
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error.message?.includes('quota-exceeded') || error.code === 'resource-exhausted') {
      console.warn("🚒 Firebase Quota Exceeded. Entering local-only mode.");
      window.dispatchEvent(new CustomEvent('firebase-quota-exceeded'));
    } else if (error.message?.includes('permission-denied')) {
      console.log("Firebase connection verified.");
    }
  }
}
testConnection();

export const loginWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('User closed the login popup.');
      return;
    }
    console.error('Firebase Auth Error:', error);
    throw error;
  }
};
export const logout = () => auth.signOut();
