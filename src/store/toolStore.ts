import { create } from 'zustand';
import type { Tool } from '../types';
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_ROUGHNESS,
} from '../constants';

interface ToolStore {
  activeTool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  selectedIds: string[];

  setActiveTool: (tool: Tool) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setRoughness: (roughness: number) => void;
  setSelectedIds: (ids: string[]) => void;
  addSelectedId: (id: string) => void;
  removeSelectedId: (id: string) => void;
  clearSelection: () => void;
}

export const useToolStore = create<ToolStore>((set) => ({
  activeTool: 'select',
  strokeColor: DEFAULT_STROKE_COLOR,
  fillColor: DEFAULT_FILL_COLOR,
  strokeWidth: DEFAULT_STROKE_WIDTH,
  roughness: DEFAULT_ROUGHNESS,
  selectedIds: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setRoughness: (roughness) => set({ roughness: roughness }),
  setSelectedIds: (ids) => set({ selectedIds: ids }),
  addSelectedId: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds
        : [...s.selectedIds, id],
    })),
  removeSelectedId: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.filter((sid) => sid !== id),
    })),
  clearSelection: () => set({ selectedIds: [] }),
}));
