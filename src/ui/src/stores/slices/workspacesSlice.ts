import type { StateCreator } from "zustand";
import type { Workspace } from "../../types";
import type { AppState } from "../useAppStore";

export interface WorkspacesSlice {
  workspaces: Workspace[];
  selectedWorkspaceId: string | null;
  setWorkspaces: (workspaces: Workspace[]) => void;
  addWorkspace: (ws: Workspace) => void;
  updateWorkspace: (id: string, updates: Partial<Workspace>) => void;
  removeWorkspace: (id: string) => void;
  selectWorkspace: (id: string | null) => void;
}

export const createWorkspacesSlice: StateCreator<
  AppState,
  [],
  [],
  WorkspacesSlice
> = (set) => ({
  workspaces: [],
  selectedWorkspaceId: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  addWorkspace: (ws) => set((s) => ({ workspaces: [...s.workspaces, ws] })),
  updateWorkspace: (id, updates) =>
    set((s) => ({
      workspaces: s.workspaces.map((w) =>
        w.id === id ? { ...w, ...updates } : w,
      ),
    })),
  removeWorkspace: (id) =>
    set((s) => {
      const newUnreadCompletions = new Set(s.unreadCompletions);
      newUnreadCompletions.delete(id);
      // Drop all per-workspace terminal state for the removed workspace.
      // The cleanup effect in TerminalPanel watches `terminalTabs` and tears
      // down xterm instances and PTYs whose tab ids no longer exist in any
      // workspace; the other maps are value-keyed by workspace id.
      const orphanedTabIds = (s.terminalTabs[id] ?? []).map((t) => t.id);
      const newTerminalTabs = { ...s.terminalTabs };
      delete newTerminalTabs[id];
      const newActiveTerminalTabId = { ...s.activeTerminalTabId };
      delete newActiveTerminalTabId[id];
      const newWorkspaceTerminalCommands = { ...s.workspaceTerminalCommands };
      delete newWorkspaceTerminalCommands[id];
      const newPaneTrees = { ...s.terminalPaneTrees };
      const newActivePane = { ...s.activeTerminalPaneId };
      for (const tabId of orphanedTabIds) {
        delete newPaneTrees[tabId];
        delete newActivePane[tabId];
      }
      const newDiffTabs = { ...s.diffTabsByWorkspace };
      delete newDiffTabs[id];
      const newDiffSelectionByWorkspace = { ...s.diffSelectionByWorkspace };
      delete newDiffSelectionByWorkspace[id];
      const newChatDrafts = { ...s.chatDrafts };
      delete newChatDrafts[id];
      return {
        workspaces: s.workspaces.filter((w) => w.id !== id),
        selectedWorkspaceId:
          s.selectedWorkspaceId === id ? null : s.selectedWorkspaceId,
        unreadCompletions: newUnreadCompletions,
        terminalTabs: newTerminalTabs,
        activeTerminalTabId: newActiveTerminalTabId,
        workspaceTerminalCommands: newWorkspaceTerminalCommands,
        terminalPaneTrees: newPaneTrees,
        activeTerminalPaneId: newActivePane,
        diffTabsByWorkspace: newDiffTabs,
        diffSelectionByWorkspace: newDiffSelectionByWorkspace,
        chatDrafts: newChatDrafts,
      };
    }),
  selectWorkspace: (id) =>
    set((s) => {
      if (id === s.selectedWorkspaceId) return s;
      // Save the outgoing workspace's diff selection before switching, then
      // restore the incoming workspace's last selection (if any). Per-workspace
      // diff *tabs* live in diffTabsByWorkspace and are preserved.
      const prev = s.selectedWorkspaceId;
      const selectionMap = prev
        ? {
            ...s.diffSelectionByWorkspace,
            [prev]: {
              path: s.diffSelectedFile,
              layer: s.diffSelectedLayer,
            },
          }
        : s.diffSelectionByWorkspace;
      const restored = id ? selectionMap[id] : undefined;
      const updates: Partial<AppState> = {
        selectedWorkspaceId: id,
        rightSidebarTab: "changes",
        diffSelectionByWorkspace: selectionMap,
        diffSelectedFile: restored?.path ?? null,
        diffSelectedLayer: restored?.layer ?? null,
        diffContent: null,
        diffError: null,
        diffPreviewMode: "diff",
        diffPreviewContent: null,
        diffPreviewLoading: false,
        diffPreviewError: null,
      };
      if (id && s.unreadCompletions.has(id)) {
        const next = new Set(s.unreadCompletions);
        next.delete(id);
        updates.unreadCompletions = next;
      }
      return updates;
    }),
});
