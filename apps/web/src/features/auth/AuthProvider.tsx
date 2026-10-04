import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserProfile } from '@ovelo/types';
import { get, post } from '../../lib/api';
type AuthContext = {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};
const Context = createContext<AuthContext | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    try {
      const result = await get<{ data: { user: UserProfile } }>('/auth/me');
      setUser(result.data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  const value = useMemo<AuthContext>(
    () => ({
      user,
      loading,
      refresh,
      login: async (email, password) => {
        const result = await post<{ data: { user: UserProfile } }>('/auth/login', {
          email,
          password,
        });
        setUser(result.data.user);
      },
      logout: async () => {
        await post('/auth/logout');
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider missing');
  return context;
};
