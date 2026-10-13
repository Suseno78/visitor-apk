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
}

interface WorkspaceContextValue extends WorkspaceState {
  /** Trigger a fresh check for workspace membership (useful after QR pairing). */
  reloadWorkspace: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const { user, loading: authLoading } = useAuth();
  const [state, setState] = useState<WorkspaceState>({
    workspace: null,
    workspaceId: null,
    workspaceName: null,
    role: null,
    loading: false,
    error: null,
  });

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

      setState({
        workspace: ws,
        workspaceId: ws?.workspace_id ?? null,
        workspaceName: ws?.workspace_name ?? null,
        role: ws?.role ?? null,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      // Safe fallback
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
