import { create } from 'zustand';
import type { CanvasElement } from '../types';

interface HistoryStore {
  past: CanvasElement[][];
  future: CanvasElement[][];

  pushState: (elements: CanvasElement[]) => void;
  undo: () => CanvasElement[] | null;
  redo: () => CanvasElement[] | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

const MAX_HISTORY = 50;

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  past: [],
  future: [],

  pushState: (elements) =>
    set((s) => ({
      past: [...s.past.slice(-MAX_HISTORY), elements.map((e) => ({ ...e }))],
      future: [], // Clear redo stack on new action
    })),

  undo: () => {
    const { past } = get();
    if (past.length === 0) return null;
    const previous = past[past.length - 1];
    set((s) => ({
      past: s.past.slice(0, -1),
      // The current state will be pushed to future by the caller
    }));
    return previous;
  },

  redo: () => {
    const { future } = get();
    if (future.length === 0) return null;
    const next = future[future.length - 1];
    set((s) => ({
      future: s.future.slice(0, -1),
      // The current state will be pushed to past by the caller
    }));
    return next;
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] }),
}));
