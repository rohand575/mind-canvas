import { create } from 'zustand';
import type { CanvasDocumentMeta } from '../types';
import { useElementStore } from './elementStore';
import { useCanvasStore } from './canvasStore';
import { useAuthStore } from './authStore';
import {
  fetchUserCanvases,
  fetchCanvas,
  saveCanvasToFirestore,
  deleteCanvasFromFirestore,
  renameCanvasInFirestore,
} from '../services/firestore';

interface DocumentStore {
  currentCanvasId: string | null;
  canvasList: CanvasDocumentMeta[];
  isSaving: boolean;
  isLoading: boolean;

  loadCanvasList: () => Promise<void>;
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

  loadCanvasList: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const list = await fetchUserCanvases(user.uid);
    set({ canvasList: list });
  },

  createCanvas: async (name) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error('Must be signed in to create a canvas');

    const id = crypto.randomUUID();
    const now = Date.now();

    // Save empty canvas to Firestore
    await saveCanvasToFirestore({
      id,
      name,
      ownerId: user.uid,
      elements: [],
      canvasState: { offsetX: 0, offsetY: 0, zoom: 1 },
      createdAt: now,
      updatedAt: now,
    });

    // Update local state
    set((s) => ({
      currentCanvasId: id,
      canvasList: [{ id, name, createdAt: now, updatedAt: now }, ...s.canvasList],
    }));

    // Clear the canvas
    useElementStore.getState().setElements([]);
    useCanvasStore.getState().loadState({ offsetX: 0, offsetY: 0, zoom: 1 });

    return id;
  },

  openCanvas: async (id) => {
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

      set({ currentCanvasId: id });
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

    // If we deleted the active canvas, switch to the first remaining or clear
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

  saveCurrentCanvas: async () => {
    const { currentCanvasId, isSaving } = get();
    const user = useAuthStore.getState().user;
    if (!user || !currentCanvasId || isSaving) return;

    set({ isSaving: true });
    try {
      const { elements } = useElementStore.getState();
      const { offsetX, offsetY, zoom, theme, showGrid } = useCanvasStore.getState();
      const existing = get().canvasList.find((c) => c.id === currentCanvasId);

      await saveCanvasToFirestore({
        id: currentCanvasId,
        name: existing?.name ?? 'Untitled',
        ownerId: user.uid,
        elements,
        canvasState: { offsetX, offsetY, zoom, theme, showGrid },
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      });

      // Update the updatedAt in the list
      set((s) => ({
        canvasList: s.canvasList.map((c) =>
          c.id === currentCanvasId ? { ...c, updatedAt: Date.now() } : c
        ),
      }));
    } finally {
      set({ isSaving: false });
    }
  },

  reset: () => {
    set({ currentCanvasId: null, canvasList: [], isSaving: false, isLoading: false });
  },
}));
