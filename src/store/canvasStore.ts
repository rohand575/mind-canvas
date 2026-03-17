import { create } from 'zustand';
import type { CanvasState, Theme } from '../types';
import { DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '../constants';

interface CanvasStore extends CanvasState {
  theme: Theme;
  showGrid: boolean;
  snapToGrid: boolean;
  isPanning: boolean;

  setOffset: (x: number, y: number) => void;
  setZoom: (zoom: number, centerX?: number, centerY?: number) => void;
  zoomIn: (centerX?: number, centerY?: number) => void;
  zoomOut: (centerX?: number, centerY?: number) => void;
  resetView: () => void;
  setIsPanning: (val: boolean) => void;
  toggleGrid: () => void;
  toggleSnapToGrid: () => void;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  loadState: (state: Partial<CanvasState>) => void;
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  offsetX: 0,
  offsetY: 0,
  zoom: DEFAULT_ZOOM,
  theme: 'light',
  showGrid: true,
  snapToGrid: false,
  isPanning: false,

  setOffset: (x, y) => set({ offsetX: x, offsetY: y }),

  setZoom: (newZoom, centerX, centerY) => {
    const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
    const { zoom, offsetX, offsetY } = get();
    if (centerX !== undefined && centerY !== undefined) {
      // Zoom toward cursor position
      const scale = clamped / zoom;
      set({
        zoom: clamped,
        offsetX: centerX - (centerX - offsetX) * scale,
        offsetY: centerY - (centerY - offsetY) * scale,
      });
    } else {
      set({ zoom: clamped });
    }
  },

  zoomIn: (centerX, centerY) => {
    const { zoom, setZoom } = get();
    setZoom(zoom * 1.1, centerX, centerY);
  },

  zoomOut: (centerX, centerY) => {
    const { zoom, setZoom } = get();
    setZoom(zoom / 1.1, centerX, centerY);
  },

  resetView: () => set({ offsetX: 0, offsetY: 0, zoom: DEFAULT_ZOOM }),

  setIsPanning: (val) => set({ isPanning: val }),

  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  toggleTheme: () =>
    set((s) => ({ theme: s.theme === 'light' ? 'dark' : 'light' })),

  setTheme: (theme) => set({ theme }),

  loadState: (state) => set(state),
}));
