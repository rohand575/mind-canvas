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
} from '../services/firestore';

// Only one save may run at a time. New saves are chained after the current one.
let saveQueue: Promise<void> = Promise.resolve();

// List subscription handle (sidebar real-time updates)
let listUnsub: (() => void) | null = null;

interface DocumentStore {
  currentCanvasId: string | null;
  canvasList: CanvasDocumentMeta[];
  isSaving: boolean;
  isLoading: boolean;

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

  subscribeCanvasList: (uid) => {
    if (listUnsub) { listUnsub(); listUnsub = null; }
    listUnsub = subscribeToUserCanvases(uid, (list) => {
      set({ canvasList: list });
    });
  },

  unsubscribeAll: () => {
    if (listUnsub) { listUnsub(); listUnsub = null; }
  },

  /**
   * Queue a save of the CURRENT canvas state.
   * State (canvasId, elements, viewport) is captured immediately so switching
   * canvases after calling this does not corrupt the saved data.
   * Saves are serialised — no two writes run at the same time.
   */
  saveCurrentCanvas: async () => {
    const canvasId = get().currentCanvasId;
    const user = useAuthStore.getState().user;
    if (!user || !canvasId) return;

    // Snapshot everything synchronously right now, before any async work
    const elements = useElementStore.getState().elements;
    const { offsetX, offsetY, zoom, theme, showGrid } = useCanvasStore.getState();
    const existing = get().canvasList.find((c) => c.id === canvasId);
    const now = Date.now();

    // Chain this save after whatever is already in the queue
    const thisSave = saveQueue.then(async () => {
      set({ isSaving: true });
      try {
        await saveCanvasToFirestore({
          id: canvasId,
          name: existing?.name ?? 'Untitled',
          ownerId: user.uid,
          elements,
          canvasState: { offsetX, offsetY, zoom, theme, showGrid },
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        });
        set((s) => ({
          canvasList: s.canvasList.map((c) =>
            c.id === canvasId ? { ...c, updatedAt: now } : c
          ),
        }));
      } catch (err) {
        console.error('[documentStore] save failed:', err);
      } finally {
        set({ isSaving: false });
      }
    });

    saveQueue = thisSave; // advance the queue tail
    await thisSave;       // wait for just this save (not future ones)
  },

  createCanvas: async (name) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Must be signed in to create a canvas');

    // Save current canvas before leaving (captures state right now)
    if (get().currentCanvasId) {
      await get().saveCurrentCanvas();
    }

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

    // Optimistic local update — list subscription will confirm shortly
    set((s) => ({
      currentCanvasId: id,
      canvasList: [{ id, name, createdAt: now, updatedAt: now }, ...s.canvasList],
    }));

    useElementStore.getState().setElements([]);
    useCanvasStore.getState().loadState({ offsetX: 0, offsetY: 0, zoom: 1 });

    return id;
  },

  openCanvas: async (id) => {
    const prevId = get().currentCanvasId;

    // Save current canvas before switching (captures state right now)
    if (prevId && prevId !== id) {
      await get().saveCurrentCanvas();
    }

    set({ isLoading: true });
    try {
      const canvas = await fetchCanvas(id);
      if (!canvas) {
        console.error('[documentStore] canvas not found:', id);
        return;
      }

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

      set({ currentCanvasId: id });
    } catch (err) {
      console.error('[documentStore] openCanvas error:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  renameCanvas: async (id, name) => {
    await renameCanvasInFirestore(id, name);
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
      if (newList.length > 0) {
        await get().openCanvas(newList[0].id);
      } else {
        set({ currentCanvasId: null });
        useElementStore.getState().setElements([]);
        useCanvasStore.getState().loadState({ offsetX: 0, offsetY: 0, zoom: 1 });
      }
    }
  },

  reset: () => {
    get().unsubscribeAll();
    saveQueue = Promise.resolve();
    set({ currentCanvasId: null, canvasList: [], isSaving: false, isLoading: false });
  },
}));
