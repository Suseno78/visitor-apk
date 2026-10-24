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

export type MembershipStatus = 'verified' | 'unverified' | 'none';

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
  /**
   * Membership status:
   * - 'verified': Cloud returned an active membership
   * - 'unverified': Network error, RPC timeout, or auth issue prevented verification (cached workspace may exist)
   * - 'none': Cloud confirmed user has no workspace membership
   */
  membershipStatus: MembershipStatus;
  /** Previously recorded workspace ID from local sync metadata or device records */
  cachedWorkspaceId: string | null;
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
import { SyncMetadataService } from '../storage/syncMetadataService';

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
  const [cachedWorkspaceId, setCachedWorkspaceId] = useState<string | null>(null);
  const [state, setState] = useState<{
    workspace: WorkspaceInfo | null;
    workspaceId: string | null;
    workspaceName: string | null;
    role: string | null;
    loading: boolean;
    error: string | null;
    membershipStatus: MembershipStatus;
  }>({
    workspace: null,
    workspaceId: null,
    workspaceName: null,
    role: null,
    loading: true,
    error: null,
    membershipStatus: 'unverified',
  });

  // Load stored offline preference and cached sync metadata on mount
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [storedOffline, syncMeta] = await Promise.all([
          AsyncStorage.getItem(OFFLINE_MODE_KEY),
          SyncMetadataService.getMetadata(),
        ]);
        if (isMounted) {
          setIsOfflineMode(storedOffline === 'true');
          setCachedWorkspaceId(syncMeta.workspaceId || null);
        }
      } catch (err) {
        console.warn('[WorkspaceProvider] Failed to read initial storage flags:', err);
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
    // Read local sync metadata to see if this device was previously part of a workspace
    const syncMeta = await SyncMetadataService.getMetadata().catch(() => ({ workspaceId: null, lastSyncedAt: null }));
    const localWsId = syncMeta.workspaceId || null;
    setCachedWorkspaceId(localWsId);

    if (!user) {
      setState({
        workspace: null,
        workspaceId: null,
        workspaceName: null,
        role: null,
        loading: false,
        error: null,
        membershipStatus: localWsId ? 'unverified' : 'none',
      });
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      // Call public.get_my_workspace()
      const { data, error } = await supabase.rpc('get_my_workspace');

      if (error) {
        // Distinguish permission denied / network error from confirmed absence
        console.warn('[WorkspaceProvider] RPC get_my_workspace error:', error.message);
        setState({
          workspace: null,
          workspaceId: null,
          workspaceName: null,
          role: null,
          loading: false,
          error: error.message,
          membershipStatus: 'unverified',
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

      if (ws) {
        // Verified active membership in cloud
        setState({
          workspace: ws,
          workspaceId: ws.workspace_id,
          workspaceName: ws.workspace_name,
          role: ws.role,
          loading: false,
          error: null,
          membershipStatus: 'verified',
        });
      } else {
        // Server returned empty result: confirmed no cloud membership for this user ID
        // If this device has a localWsId, mark as unverified (session might have changed)
        setState({
          workspace: null,
          workspaceId: null,
          workspaceName: null,
          role: null,
          loading: false,
          error: null,
          membershipStatus: localWsId ? 'unverified' : 'none',
        });
      }
    } catch (err: any) {
      // Network timeout or offline failure during RPC call
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn('[WorkspaceProvider] Network/RPC exception in get_my_workspace:', errMsg);
      setState({
        workspace: null,
        workspaceId: null,
        workspaceName: null,
        role: null,
        loading: false,
        error: errMsg,
        membershipStatus: 'unverified',
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
    cachedWorkspaceId,
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
