import { create } from 'zustand';
import type { CanvasElement } from '../types';

interface ElementStore {
  elements: CanvasElement[];

  setElements: (elements: CanvasElement[]) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[]) => CanvasElement[];
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  getMaxZIndex: () => number;
  clearAll: () => void;
}

export const useElementStore = create<ElementStore>((set, get) => ({
  elements: [],

  setElements: (elements) => set({ elements }),

  addElement: (element) =>
    set((s) => ({ elements: [...s.elements, element] })),

  updateElement: (id, updates) =>
    set((s) => ({
      elements: s.elements.map((el) =>
        el.id === id ? { ...el, ...updates, updatedAt: Date.now() } : el
      ),
    })),

  removeElements: (ids) =>
    set((s) => ({
      elements: s.elements.filter((el) => !ids.includes(el.id)),
    })),

  duplicateElements: (ids) => {
    const { elements, getMaxZIndex } = get();
    let maxZ = getMaxZIndex();
    const toDuplicate = elements.filter((el) => ids.includes(el.id));
    const duplicated = toDuplicate.map((el) => {
      maxZ++;
      const now = Date.now();
      return {
        ...el,
        id: crypto.randomUUID(),
        x: el.x + 20,
        y: el.y + 20,
        zIndex: maxZ,
        createdAt: now,
        updatedAt: now,
      };
    });
    set((s) => ({ elements: [...s.elements, ...duplicated] }));
    return duplicated;
  },

  bringForward: (id) =>
    set((s) => {
      const sorted = [...s.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx < sorted.length - 1) {
        const currentZ = sorted[idx].zIndex;
        sorted[idx] = { ...sorted[idx], zIndex: sorted[idx + 1].zIndex };
        sorted[idx + 1] = { ...sorted[idx + 1], zIndex: currentZ };
      }
      return { elements: sorted };
    }),

  sendBackward: (id) =>
    set((s) => {
      const sorted = [...s.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((el) => el.id === id);
      if (idx > 0) {
        const currentZ = sorted[idx].zIndex;
        sorted[idx] = { ...sorted[idx], zIndex: sorted[idx - 1].zIndex };
        sorted[idx - 1] = { ...sorted[idx - 1], zIndex: currentZ };
      }
      return { elements: sorted };
    }),

  bringToFront: (id) =>
    set((s) => {
      const maxZ = Math.max(...s.elements.map((el) => el.zIndex), 0) + 1;
      return {
        elements: s.elements.map((el) =>
          el.id === id ? { ...el, zIndex: maxZ } : el
        ),
      };
    }),

  sendToBack: (id) =>
    set((s) => {
      const minZ = Math.min(...s.elements.map((el) => el.zIndex), 0) - 1;
      return {
        elements: s.elements.map((el) =>
          el.id === id ? { ...el, zIndex: minZ } : el
        ),
      };
    }),

  getMaxZIndex: () => {
    const { elements } = get();
    return elements.length > 0
      ? Math.max(...elements.map((el) => el.zIndex))
      : 0;
  },

  clearAll: () => set({ elements: [] }),
}));
