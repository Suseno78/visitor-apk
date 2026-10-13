import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createElement } from 'react';
import { Platform } from 'react-native';
import { supabase } from '../lib/supabase';
import type { Session, User, AuthError } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  /** The currently authenticated user, or null. */
  user: User | null;
  /** The current Supabase session, or null. */
  session: Session | null;
  /** True while the initial session is being restored or anonymous sign-in is running. */
  loading: boolean;
  /** The last authentication error, if any. */
  error: AuthError | Error | null;
  /** Indicates whether the current authenticated user is anonymous. */
  isAnonymous: boolean;
}

interface AuthContextValue extends AuthState {
  /** Sign out helper if needed in future phases. Never called automatically. */
  signOut: () => Promise<AuthError | null>;
  /** Clear the current error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function checkIsAnonymous(user: User | null): boolean {
  if (!user) return false;
  return Boolean(user.is_anonymous || user.app_metadata?.provider === 'anonymous');
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
    isAnonymous: false,
  });

  // Check persisted session on mount. If absent, automatically sign in anonymously.
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // 1. Check if a persisted Supabase session already exists in AsyncStorage
        const {
          data: { session: existingSession },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          console.warn('[Auth] Error reading persisted session:', sessionError.message);
        }

        if (existingSession?.user) {
          // Session already exists (restored from AsyncStorage)
          if (isMounted) {
            setState({
              user: existingSession.user,
              session: existingSession,
              loading: false,
              error: null,
              isAnonymous: checkIsAnonymous(existingSession.user),
            });
          }
          return;
        }

        // 2. No session found on this device -> Automatically sign in anonymously
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously({
          options: {
            data: {
              app: 'visitra',
              platform: Platform.OS,
            },
          },
        });

        if (anonError) {
          console.error('[Auth] Failed to sign in anonymously:', anonError.message);
          if (isMounted) {
            setState((prev) => ({
              ...prev,
              loading: false,
              error: anonError,
            }));
          }
          return;
        }

        if (isMounted && anonData.user) {
          setState({
            user: anonData.user,
            session: anonData.session,
            loading: false,
            error: null,
            isAnonymous: checkIsAnonymous(anonData.user),
          });
        }
      } catch (err: any) {
        console.error('[Auth] Unexpected error during auth initialization:', err);
        if (isMounted) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err : new Error(String(err)),
          }));
        }
      }
    };

    initAuth();

    // 3. Listen for any auth state changes (token refresh, etc.)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (isMounted) {
        setState((prev) => ({
          ...prev,
          user: session?.user ?? null,
          session,
          isAnonymous: checkIsAnonymous(session?.user ?? null),
          error: null,
        }));
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // -------------------------------------------------------------------
  // Auth actions
  // -------------------------------------------------------------------

  const signOut = useCallback(async (): Promise<AuthError | null> => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.warn('[Auth] Sign-out failed:', error.message);
      setState((prev) => ({ ...prev, error }));
      return error;
    }

    return null;
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------

  const value: AuthContextValue = {
    ...state,
    signOut,
    clearError,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current authentication state and actions.
 *
 * Must be used inside an `<AuthProvider>`.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      '[useAuth] useAuth() must be used within an <AuthProvider>. ' +
        'Wrap your root layout with <AuthProvider>.'
    );
  }

  return context;
}
