import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createElement } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceInfo {
  workspace_id: string;
  workspace_name: string;
  role: string;
}

interface WorkspaceState {
  /** The workspace details if the user is a member of one, or null. */
  workspace: WorkspaceInfo | null;
  /** Convenient accessor for workspace ID. */
  workspaceId: string | null;
  /** Convenient accessor for workspace name. */
  workspaceName: string | null;
  /** The user's role in the workspace (e.g. 'owner', 'member'), or null. */
  role: string | null;
  /** True while retrieving workspace info. */
  loading: boolean;
  /** Error message if retrieval encounters an unexpected network/system error. */
  error: string | null;
  /** Indicates whether the user chose to operate in local-first Offline Mode. */
  isOfflineMode: boolean;
}

interface WorkspaceContextValue extends WorkspaceState {
  /** Trigger a fresh check for workspace membership (useful after QR pairing). */
  reloadWorkspace: () => Promise<void>;
  /** Switch to offline mode without a cloud workspace. */
  enableOfflineMode: () => Promise<void>;
  /** Exit offline mode (e.g., when connecting to a cloud workspace). */
  exitOfflineMode: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

import AsyncStorage from '@react-native-async-storage/async-storage';

export const OFFLINE_MODE_KEY = '@visitra_offline_mode';

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineLoaded, setOfflineLoaded] = useState<boolean>(false);
  const [state, setState] = useState<{
    workspace: WorkspaceInfo | null;
    workspaceId: string | null;
    workspaceName: string | null;
    role: string | null;
    loading: boolean;
    error: string | null;
  }>({
    workspace: null,
    workspaceId: null,
    workspaceName: null,
    role: null,
    loading: true,
    error: null,
  });

  // Load stored offline preference on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(OFFLINE_MODE_KEY);
        if (isMounted) {
          setIsOfflineMode(stored === 'true');
        }
      } catch (err) {
        console.warn('[WorkspaceProvider] Failed to read offline mode flag:', err);
      } finally {
        if (isMounted) {
          setOfflineLoaded(true);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  const enableOfflineMode = useCallback(async () => {
    try {
      await AsyncStorage.setItem(OFFLINE_MODE_KEY, 'true');
      setIsOfflineMode(true);
    } catch (err) {
      console.warn('[WorkspaceProvider] Failed to persist offline mode flag:', err);
    }
  }, []);

  const exitOfflineMode = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(OFFLINE_MODE_KEY);
      setIsOfflineMode(false);
    } catch (err) {
      console.warn('[WorkspaceProvider] Failed to clear offline mode flag:', err);
    }
  }, []);

  const fetchWorkspace = useCallback(async () => {
    if (!user) {
      setState({
        workspace: null,
        workspaceId: null,
        workspaceName: null,
        role: null,
        loading: false,
        error: null,
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Call public.get_my_workspace()
      const { data, error } = await supabase.rpc('get_my_workspace');

      if (error) {
        // An anonymous user without workspace membership will legitimately not return
        // an existing workspace. We handle this absence safely rather than treating it as fatal.
        setState({
          workspace: null,
          workspaceId: null,
          workspaceName: null,
          role: null,
          loading: false,
          error: null,
        });
        return;
      }

      let ws: WorkspaceInfo | null = null;
      if (data) {
        if (Array.isArray(data) && data.length > 0) {
          ws = data[0] as WorkspaceInfo;
        } else if (typeof data === 'object' && (data as any).workspace_id) {
          ws = data as WorkspaceInfo;
        }
      }

      // NOTE: Do NOT auto-clear OFFLINE_MODE_KEY here. ALKI/BY0W devices never
      // set this flag, so it is naturally absent for them. For a device that
      // transitioned from offline mode to a cloud workspace, the flag must
      // remain until the offline-data adoption process is explicitly resolved.
      // The syncWorkspace guard checks this flag to prevent silent uploads.

      setState({
        workspace: ws,
        workspaceId: ws?.workspace_id ?? null,
        workspaceName: ws?.workspace_name ?? null,
        role: ws?.role ?? null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      // Safe fallback (e.g. network timeout or offline)
      setState({
        workspace: null,
        workspaceId: null,
        workspaceName: null,
        role: null,
        loading: false,
        error: null,
      });
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchWorkspace();
    }
  }, [authLoading, fetchWorkspace]);

  const value: WorkspaceContextValue = {
    ...state,
    loading: state.loading || !offlineLoaded,
    isOfflineMode,
    enableOfflineMode,
    exitOfflineMode,
    reloadWorkspace: fetchWorkspace,
  };

  return createElement(WorkspaceContext.Provider, { value }, children);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current workspace state and actions.
 *
 * Must be used inside a `<WorkspaceProvider>`.
 */
export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error(
      '[useWorkspace] useWorkspace() must be used within a <WorkspaceProvider>. ' +
        'Wrap your root layout with <WorkspaceProvider>.'
    );
  }

  return context;
}
