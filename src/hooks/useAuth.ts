import { useState, useEffect } from 'react';
import { User, onAuthStateChanged, getIdToken } from 'firebase/auth';
import { auth, getCachedIdentity } from '../lib/firebase';

export function useAuth() {
  const [user, setUser] = useState<any>(auth.currentUser || getCachedIdentity());
  const [loading, setLoading] = useState(!auth.currentUser && !getCachedIdentity());
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
        const idToken = await getIdToken(newUser);
        setToken(idToken);
      } else {
        // Fallback to cache if strictly necessary (e.g. quota exceeded mid-session)
        const cached = getCachedIdentity();
        if (cached) {
          setUser(cached);
        } else {
          setUser(null);
          setToken(null);
        }
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
