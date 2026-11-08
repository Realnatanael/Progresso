import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { api } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  /** Invalida /api/auth/me atrasado pra não apagar o user depois do login. */
  const authGen = useRef(0);

  useEffect(() => {
    const gen = ++authGen.current;
    api('/api/auth/me')
      .then((data) => {
        if (gen === authGen.current) setUser(data.user);
      })
      .catch(() => {
        if (gen === authGen.current) setUser(null);
      })
      .finally(() => {
        if (gen === authGen.current) setLoading(false);
      });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(email, password) {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        authGen.current += 1;
        // Grava o user antes de qualquer navigate — evita bounce pra /entrar.
        flushSync(() => {
          setUser(data.user);
          setLoading(false);
        });
        return data.user;
      },
      async register(payload) {
        const data = await api('/api/auth/register', {
          method: 'POST',
          body: payload,
        });
        authGen.current += 1;
        flushSync(() => {
          setUser(data.user);
          setLoading(false);
        });
        return data.user;
      },
      async logout() {
        authGen.current += 1;
        try {
          await api('/api/auth/logout', { method: 'POST' });
        } finally {
          flushSync(() => setUser(null));
        }
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de AuthProvider.');
  return context;
}
