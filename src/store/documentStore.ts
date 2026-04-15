import { create } from 'zustand';
import type { CanvasDocumentMeta } from '../types';
import { useElementStore } from './elementStore';
import { useCanvasStore } from './canvasStore';
import { useAuthStore } from './authStore';
import {
  fetchCanvas,
  saveCanvasToFirestore,
  deleteCanvasFromFirestore,
  renameCanvasInFirestore,
  subscribeToUserCanvases,
  subscribeToCanvas,
} from '../services/firestore';

// Subscription handles live outside Zustand state to avoid serialisation issues
let listUnsub: (() => void) | null = null;
let canvasUnsub: (() => void) | null = null;

interface DocumentStore {
  currentCanvasId: string | null;
  canvasList: CanvasDocumentMeta[];
  isSaving: boolean;
  isLoading: boolean;
  /** Timestamp of the last save we performed locally — used to ignore our own echoed snapshots */
  localUpdatedAt: number;

  subscribeCanvasList: (uid: string) => void;
  unsubscribeAll: () => void;
  createCanvas: (name: string) => Promise<string>;
  openCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  saveCurrentCanvas: () => Promise<void>;
  reset: () => void;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  currentCanvasId: null,
  canvasList: [],
  isSaving: false,
  isLoading: false,
  localUpdatedAt: 0,

  /**
   * Start a real-time subscription to the signed-in user's canvas list.
   * Replaces any existing list subscription.
   */
  subscribeCanvasList: (uid) => {
    if (listUnsub) { listUnsub(); listUnsub = null; }
    listUnsub = subscribeToUserCanvases(uid, (list) => {
      set({ canvasList: list });
    });
  },

  /**
   * Tear down all active Firestore subscriptions (call on sign-out).
   */
  unsubscribeAll: () => {
    if (listUnsub) { listUnsub(); listUnsub = null; }
    if (canvasUnsub) { canvasUnsub(); canvasUnsub = null; }
  },

  createCanvas: async (name) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Must be signed in to create a canvas');

    const id = crypto.randomUUID();
    const now = Date.now();

    await saveCanvasToFirestore({
      id,
      name,
      ownerId: user.uid,
      elements: [],
      canvasState: { offsetX: 0, offsetY: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now,
    });

    // The list subscription will pick up the new canvas automatically;
    // we still set currentCanvasId and clear the canvas immediately.
    set({ currentCanvasId: id, localUpdatedAt: now });
    useElementStore.getState().setElements([]);
    useCanvasStore.getState().loadState({ offsetX: 0, offsetY: 0, zoom: 1 });

    // Subscribe to real-time updates for the new canvas
    if (canvasUnsub) { canvasUnsub(); canvasUnsub = null; }
    canvasUnsub = subscribeToCanvas(id, (remote) => {
      if (!remote) return;
      const { localUpdatedAt, currentCanvasId } = get();
      // Only apply updates that are newer than our last local save
      if (remote.id === currentCanvasId && remote.updatedAt > localUpdatedAt) {
        useElementStore.getState().setElements(remote.elements);
        useCanvasStore.getState().loadState(remote.canvasState);
        set({ localUpdatedAt: remote.updatedAt });
      }
    });

    return id;
  },

  openCanvas: async (id) => {
    // Tear down existing canvas subscription before switching
    if (canvasUnsub) { canvasUnsub(); canvasUnsub = null; }

    set({ isLoading: true });
    try {
      const canvas = await fetchCanvas(id);
      if (!canvas) throw new Error('Canvas not found');

      useElementStore.getState().setElements(canvas.elements);
      useCanvasStore.getState().loadState(canvas.canvasState);

      if (canvas.canvasState.theme) {
        useCanvasStore.getState().setTheme(canvas.canvasState.theme);
      }
      if (canvas.canvasState.showGrid !== undefined) {
        const current = useCanvasStore.getState().showGrid;
        if (current !== canvas.canvasState.showGrid) {
          useCanvasStore.getState().toggleGrid();
        }
      }

      set({ currentCanvasId: id, localUpdatedAt: canvas.updatedAt });
    } finally {
      set({ isLoading: false });
    }

    // Start real-time subscription for this canvas
    canvasUnsub = subscribeToCanvas(id, (remote) => {
      if (!remote) return;
      const { localUpdatedAt, currentCanvasId } = get();
      // Only apply changes that come from another device (newer than our last save)
      if (remote.id === currentCanvasId && remote.updatedAt > localUpdatedAt) {
        useElementStore.getState().setElements(remote.elements);
        useCanvasStore.getState().loadState(remote.canvasState);
        set({ localUpdatedAt: remote.updatedAt });
      }
    });
  },

  renameCanvas: async (id, name) => {
    await renameCanvasInFirestore(id, name);
    // List subscription will reflect the rename; update locally too for instant feedback
    set((s) => ({
      canvasList: s.canvasList.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c
      ),
    }));
  },

  deleteCanvas: async (id) => {
    await deleteCanvasFromFirestore(id);
    const { currentCanvasId, canvasList } = get();
    const newList = canvasList.filter((c) => c.id !== id);
    set({ canvasList: newList });

    if (currentCanvasId === id) {
      if (canvasUnsub) { canvasUnsub(); canvasUnsub = null; }
      if (newList.length > 0) {
        await get().openCanvas(newList[0].id);
      } else {
        set({ currentCanvasId: null, localUpdatedAt: 0 });
        useElementStore.getState().setElements([]);
        useCanvasStore.getState().loadState({ offsetX: 0, offsetY: 0, zoom: 1 });
      }
    }
  },

  saveCurrentCanvas: async () => {
    const { currentCanvasId, isSaving } = get();
    const user = useAuthStore.getState().user;
    if (!user || !currentCanvasId || isSaving) return;

    set({ isSaving: true });
    try {
      const { elements } = useElementStore.getState();
      const { offsetX, offsetY, zoom, theme, showGrid } = useCanvasStore.getState();
      const existing = get().canvasList.find((c) => c.id === currentCanvasId);
      const now = Date.now();

      await saveCanvasToFirestore({
        id: currentCanvasId,
        name: existing?.name ?? 'Untitled',
        ownerId: user.uid,
        elements,
        canvasState: { offsetX, offsetY, zoom, theme, showGrid },
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });

      // Record the save timestamp so the echoed snapshot is ignored
      set((s) => ({
        localUpdatedAt: now,
        canvasList: s.canvasList.map((c) =>
          c.id === currentCanvasId ? { ...c, updatedAt: now } : c
        ),
      }));
    } finally {
      set({ isSaving: false });
    }
  },

  reset: () => {
    get().unsubscribeAll();
    set({ currentCanvasId: null, canvasList: [], isSaving: false, isLoading: false, localUpdatedAt: 0 });
  },
}));
