import { describe, it, expect } from 'vitest';
import {
  getElementBounds,
  hitTestElement,
  normalizeBounds,
  boundsOverlap,
  boundsContainedIn,
  findNearestConnectionPoint,
} from './geometry';
import type { CanvasElement } from '../types';

function makeEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
  return {
    id: 'el-1',
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    strokeColor: '#1e1e1e',
    fillColor: 'transparent',
    strokeWidth: 2,
    roughness: 1,
    opacity: 1,
    strokeStyle: 'solid',
    fillStyle: 'hachure',
    edgeRoundness: 0,
    rotation: 0,
    zIndex: 1,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('getElementBounds', () => {
  it('returns x/y/width/height for shapes', () => {
    expect(getElementBounds(makeEl({ x: 10, y: 20, width: 30, height: 40 }))).toEqual({
      x: 10, y: 20, width: 30, height: 40,
    });
  });

  it('computes bounds from points for lines', () => {
    const line = makeEl({
      type: 'line',
      x: 100,
      y: 100,
      points: [{ x: 0, y: 0 }, { x: 50, y: -30 }],
    });
    expect(getElementBounds(line)).toEqual({ x: 100, y: 70, width: 50, height: 30 });
  });
});

describe('hitTestElement', () => {
  it('never hits locked elements', () => {
    const el = makeEl({ locked: true, fillColor: '#ff0000' });
    expect(hitTestElement({ x: 50, y: 25 }, el)).toBe(false);
  });

  it('hits filled rectangles anywhere inside', () => {
    const el = makeEl({ fillColor: '#ff0000' });
    expect(hitTestElement({ x: 50, y: 25 }, el)).toBe(true);
  });

  it('hits transparent rectangles only near the border', () => {
    const el = makeEl(); // transparent fill
    expect(hitTestElement({ x: 1, y: 1 }, el)).toBe(true);   // near border
    expect(hitTestElement({ x: 50, y: 25 }, el)).toBe(false); // center
  });

  it('hits straight lines near the segment', () => {
    const line = makeEl({ type: 'line', points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] });
    expect(hitTestElement({ x: 25, y: 25 }, line)).toBe(true);
    expect(hitTestElement({ x: 50, y: 0 }, line)).toBe(false);
  });

  it('hit-tests elbow connectors along the routed path, not the diagonal', () => {
    const elbow = makeEl({
      type: 'arrow',
      connectorStyle: 'elbow',
      points: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
    });
    // Elbow route: (0,0) → (50,0) → (50,100) → (100,100)
    expect(hitTestElement({ x: 50, y: 0 }, elbow)).toBe(true);   // on horizontal segment
    expect(hitTestElement({ x: 50, y: 50 }, elbow)).toBe(true);  // on vertical segment
    expect(hitTestElement({ x: 25, y: 25 }, elbow)).toBe(false); // on the (undrawn) diagonal
  });

  it('does not hit single-point connectors', () => {
    const stub = makeEl({ type: 'arrow', points: [{ x: 0, y: 0 }] });
    expect(hitTestElement({ x: 0, y: 0 }, stub)).toBe(false);
  });
});

describe('normalizeBounds', () => {
  it('flips negative dimensions', () => {
    expect(normalizeBounds(10, 10, -5, -8)).toEqual({ x: 5, y: 2, width: 5, height: 8 });
  });
});

describe('boundsOverlap / boundsContainedIn', () => {
  it('detects overlap and containment', () => {
    const a = { x: 0, y: 0, width: 10, height: 10 };
    const b = { x: 5, y: 5, width: 10, height: 10 };
    const inner = { x: 2, y: 2, width: 3, height: 3 };
    expect(boundsOverlap(a, b)).toBe(true);
    expect(boundsOverlap(a, { x: 20, y: 20, width: 1, height: 1 })).toBe(false);
    expect(boundsContainedIn(inner, a)).toBe(true);
    expect(boundsContainedIn(b, a)).toBe(false);
  });
});

describe('findNearestConnectionPoint', () => {
  it('snaps to the closest connection point within range', () => {
    const shape = makeEl({ id: 'target', x: 0, y: 0, width: 100, height: 100 });
    const hit = findNearestConnectionPoint({ x: 52, y: 3 }, [shape], [], 20);
    expect(hit).not.toBeNull();
    expect(hit!.elementId).toBe('target');
    expect(hit!.point).toBe('n');
  });

  it('respects exclusions and distance', () => {
    const shape = makeEl({ id: 'target' });
    expect(findNearestConnectionPoint({ x: 50, y: 0 }, [shape], ['target'], 20)).toBeNull();
    expect(findNearestConnectionPoint({ x: 500, y: 500 }, [shape], [], 20)).toBeNull();
  });
});
