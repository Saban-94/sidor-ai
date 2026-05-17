import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { auth, getCachedIdentity } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<any>(auth.currentUser);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const handleQuotaExceeded = () => {
      if (!user) {
        setUser(getCachedIdentity());
      }
    };
    window.addEventListener('firebase-quota-exceeded', handleQuotaExceeded);

    const unsubscribe = onAuthStateChanged(auth, async (newUser) => {
      if (newUser) {
        setUser(newUser);
        try {
          const idToken = await getIdToken(newUser);
          setToken(idToken);
        } catch (e) {
          console.error("Error getting token:", e);
        }
      } else {
        // Fallback to cache ONLY if we have literally no other option (quota exceeded)
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      window.removeEventListener('firebase-quota-exceeded', handleQuotaExceeded);
    };
  }, []);

  return { user, loading, token };
}
