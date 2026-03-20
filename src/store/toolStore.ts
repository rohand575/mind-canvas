import { create } from 'zustand';
import type { Tool, StrokeStyle, FillStyle } from '../types';
import {
  DEFAULT_STROKE_COLOR,
  DEFAULT_FILL_COLOR,
  DEFAULT_STROKE_WIDTH,
  DEFAULT_ROUGHNESS,
  DEFAULT_OPACITY,
  DEFAULT_FONT_SIZE,
  DEFAULT_STROKE_STYLE,
  DEFAULT_FILL_STYLE,
  DEFAULT_EDGE_ROUNDNESS,
} from '../constants';

interface ToolStore {
  activeTool: Tool;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  roughness: number;
  opacity: number;
  fontSize: number;
  strokeStyle: StrokeStyle;
  fillStyle: FillStyle;
  edgeRoundness: number;
  lockToolMode: boolean;
  selectedIds: string[];

  setActiveTool: (tool: Tool) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setRoughness: (roughness: number) => void;
  setOpacity: (opacity: number) => void;
  setFontSize: (fontSize: number) => void;
  setStrokeStyle: (style: StrokeStyle) => void;
  setFillStyle: (style: FillStyle) => void;
  setEdgeRoundness: (r: number) => void;
  setLockToolMode: (lock: boolean) => void;
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
  opacity: DEFAULT_OPACITY,
  fontSize: DEFAULT_FONT_SIZE,
  strokeStyle: DEFAULT_STROKE_STYLE,
  fillStyle: DEFAULT_FILL_STYLE,
  edgeRoundness: DEFAULT_EDGE_ROUNDNESS,
  lockToolMode: false,
  selectedIds: [],

  setActiveTool: (tool) => set({ activeTool: tool }),
  setStrokeColor: (color) => set({ strokeColor: color }),
  setFillColor: (color) => set({ fillColor: color }),
  setStrokeWidth: (width) => set({ strokeWidth: width }),
  setRoughness: (roughness) => set({ roughness: roughness }),
  setOpacity: (opacity) => set({ opacity }),
  setFontSize: (fontSize) => set({ fontSize }),
  setStrokeStyle: (style) => set({ strokeStyle: style }),
  setFillStyle: (style) => set({ fillStyle: style }),
  setEdgeRoundness: (r) => set({ edgeRoundness: r }),
  setLockToolMode: (lock) => set({ lockToolMode: lock }),
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
