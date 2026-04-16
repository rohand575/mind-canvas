import { create } from 'zustand';
import type { CanvasDocumentMeta } from '../types';
import { useElementStore } from './elementStore';
import { useCanvasStore } from './canvasStore';
import {
  saveCanvasLocally,
  loadCanvasLocally,
  loadAllCanvasMeta,
  deleteCanvasLocally,
} from '../utils/persistence';

// Only one save may run at a time. New saves are chained after the current one.
let saveQueue: Promise<void> = Promise.resolve();

interface DocumentStore {
  currentCanvasId: string | null;
  canvasList: CanvasDocumentMeta[];
  isSaving: boolean;
  isLoading: boolean;

  init: () => Promise<void>;
  createCanvas: (name: string) => Promise<string>;
  openCanvas: (id: string) => Promise<void>;
  renameCanvas: (id: string, name: string) => Promise<void>;
  deleteCanvas: (id: string) => Promise<void>;
  saveCurrentCanvas: () => Promise<void>;
}

export const useDocumentStore = create<DocumentStore>((set, get) => ({
  currentCanvasId: null,
  canvasList: [],
  isSaving: false,
  isLoading: false,

  init: async () => {
    set({ isLoading: true });
    try {
      const list = await loadAllCanvasMeta();
      if (list.length > 0) {
        set({ canvasList: list });
        await get().openCanvas(list[0].id);
      } else {
        await get().createCanvas('Untitled 1');
      }
    } catch (err) {
      console.error('[documentStore] init failed:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Queue a save of the CURRENT canvas state.
   * State is captured immediately so switching canvases after calling this
   * does not corrupt the saved data. Saves are serialised — no two writes
   * run at the same time.
   */
  saveCurrentCanvas: async () => {
    const canvasId = get().currentCanvasId;
    if (!canvasId) return;

    const elements = useElementStore.getState().elements;
    const { offsetX, offsetY, zoom, theme, showGrid } = useCanvasStore.getState();
    const existing = get().canvasList.find((c) => c.id === canvasId);
    const now = Date.now();

    const thisSave = saveQueue.then(async () => {
      set({ isSaving: true });
      try {
        await saveCanvasLocally({
          id: canvasId,
          name: existing?.name ?? 'Untitled',
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

    saveQueue = thisSave;
    await thisSave;
  },

  createCanvas: async (name) => {
    if (get().currentCanvasId) {
      await get().saveCurrentCanvas();
    }

    const id = crypto.randomUUID();
    const now = Date.now();

    await saveCanvasLocally({
      id,
      name,
      elements: [],
      canvasState: { offsetX: 0, offsetY: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now,
    });

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

    if (prevId && prevId !== id) {
      await get().saveCurrentCanvas();
    }

    set({ isLoading: true });
    try {
      const canvas = await loadCanvasLocally(id);
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
    const canvas = await loadCanvasLocally(id);
    if (canvas) {
      await saveCanvasLocally({ ...canvas, name, updatedAt: Date.now() });
    }
    set((s) => ({
      canvasList: s.canvasList.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c
      ),
    }));
  },

  deleteCanvas: async (id) => {
    await deleteCanvasLocally(id);
    const { currentCanvasId, canvasList } = get();
    const newList = canvasList.filter((c) => c.id !== id);
    set({ canvasList: newList });

    if (currentCanvasId === id) {
      if (newList.length > 0) {
        await get().openCanvas(newList[0].id);
      } else {
        await get().createCanvas('Untitled 1');
      }
    }
  },
}));
