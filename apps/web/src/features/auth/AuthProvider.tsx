import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useRef,
  useCallback,
  Fragment,
} from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import type { UserProfile } from '@ovelo/types';
import { get, post } from '../../lib/api';
type AuthContext = {
  user: UserProfile | null;
  loading: boolean;
  sessionError: string | null;
  login: (
    email: string,
    password: string,
    consent?: { termsVersion: string; privacyVersion: string },
  ) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  confirmProviderSignIn: () => Promise<void>;
};
const Context = createContext<AuthContext | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const location = useLocation();
  const queryClient = useQueryClient();
  const checked = useRef(false);
  const request = useRef(0);
  const identity = useRef<string | null>(null);
  const mutating = useRef(false);
  const channel = useRef<BroadcastChannel | null>(null);
  const publicPage = ['/', '/how-it-works', '/terms', '/privacy', '/consent', '/auth/complete'].includes(location.pathname);
  const refresh = useCallback(async () => {
    if (mutating.current) return;
    const current = ++request.current;
    try {
      const result = await get<{ data: { user: UserProfile } }>('/auth/me');
      if (current === request.current) {
        if (identity.current && identity.current !== result.data.user.id) queryClient.clear();
        identity.current = result.data.user.id;
        setSessionError(null);
        setUser(result.data.user);
      }
    } catch (error) {
      if (current === request.current) {
        if (identity.current) queryClient.clear();
        identity.current = null;
        setUser(null);
        setSessionError((error as Error & { status?: number }).status === 401 ? null : error instanceof Error ? error.message : 'Unable to verify your session. Please retry.');
      }
    } finally {
      if (current === request.current) setLoading(false);
    }
  }, [queryClient]);
  const confirmProviderSignIn = useCallback(async () => {
    mutating.current = true;
    const current = ++request.current;
    try {
      const result = await get<{ data: { user: UserProfile } }>('/auth/oauth/result');
      if (current !== request.current) throw new Error('Another sign-in changed this session. Start sign-in again.');
      await queryClient.cancelQueries();
      if (current !== request.current) throw new Error('Another sign-in changed this session. Start sign-in again.');
      queryClient.clear();
      identity.current = result.data.user.id;
      setSessionError(null);
      checked.current = true;
      setUser(result.data.user);
      setLoading(false);
      channel.current?.postMessage('identity-changed');
    } catch (error) {
      if (current === request.current) {
        identity.current = null;
        queryClient.clear();
        setUser(null);
        setLoading(false);
      }
      throw error;
    } finally {
      mutating.current = false;
    }
  }, [queryClient]);
  useEffect(() => {
    const reset = () => {
      ++request.current;
      identity.current = null;
      setUser(null);
      setSessionError(null);
      queryClient.clear();
      checked.current = false;
      if (!publicPage) {
        checked.current = true;
        setLoading(true);
        void refresh();
      }
    };
    const check = () => {
      if (!publicPage && document.visibilityState === 'visible') void refresh();
    };
    const bus = typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('ovelo-auth');
    channel.current = bus;
    if (bus) bus.onmessage = reset;
    window.addEventListener('focus', check);
    window.addEventListener('ovelo-session-expired', reset);
    window.addEventListener('pageshow', check);
    return () => {
      bus?.close();
      channel.current = null;
      window.removeEventListener('focus', check);
      window.removeEventListener('ovelo-session-expired', reset);
      window.removeEventListener('pageshow', check);
    };
  }, [publicPage, queryClient, refresh]);
  useEffect(() => {
    if (publicPage) {
      checked.current = false;
      setLoading(false);
      return;
    }
    if (checked.current) return;
    checked.current = true;
    setLoading(true);
    void refresh();
  }, [publicPage, refresh]);
  const value = useMemo<AuthContext>(
    () => ({
      user,
      sessionError,
      loading: loading || (!publicPage && !checked.current),
      refresh,
      confirmProviderSignIn,
      login: async (email, password, consent) => {
        mutating.current = true;
        const current = ++request.current;
        try {
          const result = await post<{ data: { user: UserProfile } }>('/auth/login', {
            email,
            password,
            ...(consent || {}),
          });
          if (current !== request.current) return;
          await queryClient.cancelQueries();
          queryClient.clear();
          identity.current = result.data.user.id;
          checked.current = true;
          setUser(result.data.user);
          setSessionError(null);
          setLoading(false);
          channel.current?.postMessage('identity-changed');
        } finally {
          mutating.current = false;
        }
      },
      logout: async () => {
        mutating.current = true;
        try {
          ++request.current;
          await post('/auth/logout');
          ++request.current;
          await queryClient.cancelQueries();
          queryClient.clear();
          identity.current = null;
          setUser(null);
          setSessionError(null);
          setLoading(false);
          checked.current = true;
          channel.current?.postMessage('identity-changed');
        } finally {
          mutating.current = false;
        }
      },
    }),
    [user, sessionError, loading, publicPage, queryClient, refresh, confirmProviderSignIn],
  );
  return (
    <Context.Provider value={value}>
      <Fragment key={user?.id || 'anonymous'}>{children}</Fragment>
    </Context.Provider>
  );
}
export const useAuth = () => {
  const context = useContext(Context);
  if (!context) throw new Error('AuthProvider missing');
  return context;
};
