import { create } from 'zustand';
import type { CanvasElement, AlignmentType, DistributionType } from '../types';
import { getElementBounds, getConnectionPointAbsolute } from '../utils/geometry';

interface ElementStore {
  elements: CanvasElement[];

  setElements: (elements: CanvasElement[]) => void;
  addElement: (element: CanvasElement) => void;
  updateElement: (id: string, updates: Partial<CanvasElement>) => void;
  removeElements: (ids: string[]) => void;
  duplicateElements: (ids: string[], offsetX?: number, offsetY?: number) => CanvasElement[];
  bringForward: (id: string) => void;
  sendBackward: (id: string) => void;
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  getMaxZIndex: () => number;
  clearAll: () => void;

  // ── Grouping ──────────────────────────────────────────────────
  groupElements: (ids: string[]) => string;
  ungroupElements: (ids: string[]) => void;

  // ── Lock ──────────────────────────────────────────────────────
  lockElements: (ids: string[], locked: boolean) => void;

  // ── Align & Distribute ────────────────────────────────────────
  alignElements: (ids: string[], alignment: AlignmentType) => void;
  distributeElements: (ids: string[], axis: DistributionType) => void;

  // ── Smart Connectors ──────────────────────────────────────────
  updateConnectorBindings: (movedIds: string[]) => void;
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

  duplicateElements: (ids, offsetX = 20, offsetY = 20) => {
    const { elements, getMaxZIndex } = get();
    let maxZ = getMaxZIndex();
    const toDuplicate = elements.filter((el) => ids.includes(el.id));
    // Assign new groupIds when duplicating grouped elements
    const groupIdMap = new Map<string, string>();
    const duplicated = toDuplicate.map((el) => {
      maxZ++;
      const now = Date.now();
      let newGroupId = el.groupId;
      if (el.groupId) {
        if (!groupIdMap.has(el.groupId)) {
          groupIdMap.set(el.groupId, crypto.randomUUID());
        }
        newGroupId = groupIdMap.get(el.groupId);
      }
      return {
        ...el,
        id: crypto.randomUUID(),
        x: el.x + offsetX,
        y: el.y + offsetY,
        zIndex: maxZ,
        groupId: newGroupId,
        // Clear bindings on duplicated arrows (they no longer reference valid shapes)
        startBinding: undefined,
        endBinding: undefined,
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

  // ── Grouping ──────────────────────────────────────────────────

  groupElements: (ids) => {
    const groupId = crypto.randomUUID();
    const now = Date.now();
    set((s) => ({
      elements: s.elements.map((el) =>
        ids.includes(el.id) ? { ...el, groupId, updatedAt: now } : el
      ),
    }));
    return groupId;
  },

  ungroupElements: (ids) => {
    const now = Date.now();
    set((s) => ({
      elements: s.elements.map((el) =>
        ids.includes(el.id) ? { ...el, groupId: undefined, updatedAt: now } : el
      ),
    }));
  },

  // ── Lock ──────────────────────────────────────────────────────

  lockElements: (ids, locked) => {
    const now = Date.now();
    set((s) => ({
      elements: s.elements.map((el) =>
        ids.includes(el.id) ? { ...el, locked, updatedAt: now } : el
      ),
    }));
  },

  // ── Align & Distribute ────────────────────────────────────────

  alignElements: (ids, alignment) => {
    const { elements } = get();
    const targets = elements.filter((el) => ids.includes(el.id));
    if (targets.length < 2) return;

    const bounds = targets.map((el) => ({ el, b: getElementBounds(el) }));

    let refValue: number;
    switch (alignment) {
      case 'left':   refValue = Math.min(...bounds.map(({ b }) => b.x)); break;
      case 'right':  refValue = Math.max(...bounds.map(({ b }) => b.x + b.width)); break;
      case 'centerX': refValue = (Math.min(...bounds.map(({ b }) => b.x)) + Math.max(...bounds.map(({ b }) => b.x + b.width))) / 2; break;
      case 'top':    refValue = Math.min(...bounds.map(({ b }) => b.y)); break;
      case 'bottom': refValue = Math.max(...bounds.map(({ b }) => b.y + b.height)); break;
      case 'centerY': refValue = (Math.min(...bounds.map(({ b }) => b.y)) + Math.max(...bounds.map(({ b }) => b.y + b.height))) / 2; break;
    }

    const now = Date.now();
    set((s) => ({
      elements: s.elements.map((el) => {
        if (!ids.includes(el.id)) return el;
        const b = getElementBounds(el);
        let newX = el.x;
        let newY = el.y;
        switch (alignment) {
          case 'left':   newX = refValue; break;
          case 'right':  newX = el.x + (refValue - (b.x + b.width)); break;
          case 'centerX': newX = el.x + (refValue - (b.x + b.width / 2)); break;
          case 'top':    newY = refValue; break;
          case 'bottom': newY = el.y + (refValue - (b.y + b.height)); break;
          case 'centerY': newY = el.y + (refValue - (b.y + b.height / 2)); break;
        }
        return { ...el, x: newX, y: newY, updatedAt: now };
      }),
    }));
  },

  distributeElements: (ids, axis) => {
    const { elements } = get();
    const targets = elements.filter((el) => ids.includes(el.id));
    if (targets.length < 3) return;

    const bounds = targets.map((el) => ({ el, b: getElementBounds(el) }));

    if (axis === 'horizontal') {
      bounds.sort((a, b) => a.b.x - b.b.x);
      const first = bounds[0].b.x;
      const last = bounds[bounds.length - 1].b.x + bounds[bounds.length - 1].b.width;
      const totalWidth = bounds.reduce((sum, { b }) => sum + b.width, 0);
      const gap = (last - first - totalWidth) / (bounds.length - 1);
      let cursor = first;
      const now = Date.now();
      set((s) => ({
        elements: s.elements.map((el) => {
          const entry = bounds.find(({ el: e }) => e.id === el.id);
          if (!entry) return el;
          const newX = el.x + (cursor - entry.b.x);
          cursor += entry.b.width + gap;
          return { ...el, x: newX, updatedAt: now };
        }),
      }));
    } else {
      bounds.sort((a, b) => a.b.y - b.b.y);
      const first = bounds[0].b.y;
      const last = bounds[bounds.length - 1].b.y + bounds[bounds.length - 1].b.height;
      const totalHeight = bounds.reduce((sum, { b }) => sum + b.height, 0);
      const gap = (last - first - totalHeight) / (bounds.length - 1);
      let cursor = first;
      const now = Date.now();
      set((s) => ({
        elements: s.elements.map((el) => {
          const entry = bounds.find(({ el: e }) => e.id === el.id);
          if (!entry) return el;
          const newY = el.y + (cursor - entry.b.y);
          cursor += entry.b.height + gap;
          return { ...el, y: newY, updatedAt: now };
        }),
      }));
    }
  },

  // ── Smart Connectors ──────────────────────────────────────────

  updateConnectorBindings: (movedIds) => {
    const { elements } = get();
    const now = Date.now();
    const updates: Map<string, Partial<CanvasElement>> = new Map();

    for (const arrow of elements) {
      if (arrow.type !== 'arrow' && arrow.type !== 'line') continue;
      if (!arrow.points || arrow.points.length < 2) continue;

      const startMoved = arrow.startBinding && movedIds.includes(arrow.startBinding.elementId);
      const endMoved = arrow.endBinding && movedIds.includes(arrow.endBinding.elementId);
      if (!startMoved && !endMoved) continue;

      // Current absolute endpoints
      const absEnd = {
        x: arrow.x + arrow.points[1].x,
        y: arrow.y + arrow.points[1].y,
      };

      let newX = arrow.x;
      let newY = arrow.y;
      let newEndX = absEnd.x;
      let newEndY = absEnd.y;

      if (startMoved && arrow.startBinding) {
        const shape = elements.find((el) => el.id === arrow.startBinding!.elementId);
        if (shape) {
          const cp = getConnectionPointAbsolute(shape, arrow.startBinding.point);
          newX = cp.x;
          newY = cp.y;
        }
      }

      if (endMoved && arrow.endBinding) {
        const shape = elements.find((el) => el.id === arrow.endBinding!.elementId);
        if (shape) {
          const cp = getConnectionPointAbsolute(shape, arrow.endBinding.point);
          newEndX = cp.x;
          newEndY = cp.y;
        }
      }

      updates.set(arrow.id, {
        x: newX,
        y: newY,
        points: [{ x: 0, y: 0 }, { x: newEndX - newX, y: newEndY - newY }],
        updatedAt: now,
      });
    }

    if (updates.size === 0) return;

    set((s) => ({
      elements: s.elements.map((el) => {
        const u = updates.get(el.id);
        return u ? { ...el, ...u } : el;
      }),
    }));
  },
}));
