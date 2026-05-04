import { create } from 'zustand';
import type { LibraryItem, CanvasElement } from '../types';

const STORAGE_KEY = 'canvas-shape-library';

function loadFromStorage(): LibraryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: LibraryItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

interface ShapeLibraryStore {
  items: LibraryItem[];
  isOpen: boolean;

  addItem: (name: string, elements: CanvasElement[]) => void;
  removeItem: (id: string) => void;
  renameItem: (id: string, name: string) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
}

export const useShapeLibraryStore = create<ShapeLibraryStore>((set, get) => ({
  items: loadFromStorage(),
  isOpen: false,

  addItem: (name, elements) => {
    const item: LibraryItem = {
      id: crypto.randomUUID(),
      name,
      elements: elements.map((el) => ({ ...el })),
    };
    const items = [...get().items, item];
    saveToStorage(items);
    set({ items });
  },

  removeItem: (id) => {
    const items = get().items.filter((item) => item.id !== id);
    saveToStorage(items);
    set({ items });
  },

  renameItem: (id, name) => {
    const items = get().items.map((item) =>
      item.id === id ? { ...item, name } : item
    );
    saveToStorage(items);
    set({ items });
  },

  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
}));
