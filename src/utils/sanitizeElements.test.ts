import { describe, it, expect } from 'vitest';
import { sanitizeElement, sanitizeElements, cloneElementsForPaste } from './sanitizeElements';
import type { CanvasElement } from '../types';

const valid = {
  id: 'a',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
};

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

describe('sanitizeElement', () => {
  it('accepts a minimal valid element and applies style defaults', () => {
    const el = sanitizeElement(valid);
    expect(el).not.toBeNull();
    expect(el!.strokeColor).toBeTypeOf('string');
    expect(el!.opacity).toBeGreaterThanOrEqual(0);
    expect(el!.strokeStyle).toBe('solid');
  });

  it('rejects elements with non-finite coordinates', () => {
    expect(sanitizeElement({ ...valid, x: NaN })).toBeNull();
    expect(sanitizeElement({ ...valid, y: Infinity })).toBeNull();
    expect(sanitizeElement({ ...valid, x: 'abc' })).toBeNull();
  });

  it('rejects unknown types and missing ids', () => {
    expect(sanitizeElement({ ...valid, type: 'blob' })).toBeNull();
    expect(sanitizeElement({ ...valid, id: undefined })).toBeNull();
    expect(sanitizeElement(null)).toBeNull();
    expect(sanitizeElement('str')).toBeNull();
  });

  it('coerces invalid numerics to defaults and clamps ranges', () => {
    const el = sanitizeElement({ ...valid, width: 'wide', opacity: 99, strokeWidth: -5 });
    expect(el!.width).toBe(0);
    expect(el!.opacity).toBe(1);
    expect(el!.strokeWidth).toBe(0);
  });

  it('drops linear elements without 2+ valid points', () => {
    expect(sanitizeElement({ ...valid, type: 'arrow' })).toBeNull();
    expect(sanitizeElement({ ...valid, type: 'arrow', points: [{ x: 0, y: 0 }] })).toBeNull();
    expect(sanitizeElement({ ...valid, type: 'arrow', points: [{ x: 0, y: 0 }, { x: 'x', y: 1 }] })).toBeNull();
    expect(
      sanitizeElement({ ...valid, type: 'arrow', points: [{ x: 0, y: 0 }, { x: 5, y: 5 }] }),
    ).not.toBeNull();
  });

  it('drops malformed bindings but keeps the element', () => {
    const el = sanitizeElement({ ...valid, startBinding: { elementId: 5, point: 'n' } });
    expect(el).not.toBeNull();
    expect(el!.startBinding).toBeUndefined();
    const el2 = sanitizeElement({ ...valid, startBinding: { elementId: 'x', point: 'middle' } });
    expect(el2!.startBinding).toBeUndefined();
    const el3 = sanitizeElement({ ...valid, startBinding: { elementId: 'x', point: 'n' } });
    expect(el3!.startBinding).toEqual({ elementId: 'x', point: 'n' });
  });
});

describe('sanitizeElements', () => {
  it('drops invalid entries and keeps valid ones', () => {
    const out = sanitizeElements([valid, { ...valid, id: 'b', x: NaN }, 'junk', null]);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('a');
  });

  it('regenerates duplicate ids', () => {
    const out = sanitizeElements([valid, { ...valid }]);
    expect(out).toHaveLength(2);
    expect(out[0].id).not.toBe(out[1].id);
  });

  it('returns [] for non-arrays', () => {
    expect(sanitizeElements({})).toEqual([]);
    expect(sanitizeElements(undefined)).toEqual([]);
  });
});

describe('cloneElementsForPaste', () => {
  it('assigns fresh ids and applies offsets and z-indexes', () => {
    const src = [makeEl({ id: 'a', x: 10, y: 10, zIndex: 1 })];
    const out = cloneElementsForPaste(src, 20, 30, 5);
    expect(out[0].id).not.toBe('a');
    expect(out[0].x).toBe(30);
    expect(out[0].y).toBe(40);
    expect(out[0].zIndex).toBe(6);
  });

  it('remaps group ids consistently within the clone set', () => {
    const src = [
      makeEl({ id: 'a', groupId: 'g1' }),
      makeEl({ id: 'b', groupId: 'g1' }),
      makeEl({ id: 'c', groupId: 'g2' }),
    ];
    const out = cloneElementsForPaste(src, 0, 0, 0);
    expect(out[0].groupId).toBe(out[1].groupId);
    expect(out[0].groupId).not.toBe('g1');
    expect(out[2].groupId).not.toBe(out[0].groupId);
  });

  it('remaps bindings when the bound shape is in the set, clears otherwise', () => {
    const src = [
      makeEl({ id: 'shape' }),
      makeEl({
        id: 'arrow',
        type: 'arrow',
        points: [{ x: 0, y: 0 }, { x: 10, y: 10 }],
        startBinding: { elementId: 'shape', point: 'e' },
        endBinding: { elementId: 'outside', point: 'w' },
      }),
    ];
    const out = cloneElementsForPaste(src, 0, 0, 0);
    const clonedShape = out[0];
    const clonedArrow = out[1];
    expect(clonedArrow.startBinding).toEqual({ elementId: clonedShape.id, point: 'e' });
    expect(clonedArrow.endBinding).toBeUndefined();
  });
});
