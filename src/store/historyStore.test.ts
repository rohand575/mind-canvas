import { describe, it, expect, beforeEach } from 'vitest';
import { useHistoryStore } from './historyStore';
import type { CanvasElement } from '../types';

function makeEl(id: string): CanvasElement {
  return {
    id,
    type: 'rectangle',
    x: 0,
    y: 0,
    width: 10,
    height: 10,
    strokeColor: '#000',
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
  };
}

describe('historyStore', () => {
  beforeEach(() => {
    useHistoryStore.getState().clear();
  });

  it('pushState adds snapshots and clears the redo stack', () => {
    const s = useHistoryStore.getState();
    s.pushState([makeEl('a')]);
    useHistoryStore.setState({ future: [[makeEl('x')]] });
    s.pushState([makeEl('b')]);
    expect(useHistoryStore.getState().past).toHaveLength(2);
    expect(useHistoryStore.getState().future).toHaveLength(0);
  });

  it('caps history at exactly 50 entries', () => {
    const s = useHistoryStore.getState();
    for (let i = 0; i < 60; i++) {
      s.pushState([makeEl(`el-${i}`)]);
    }
    const { past } = useHistoryStore.getState();
    expect(past).toHaveLength(50);
    // Oldest retained snapshot should be #10 (60 pushed, first 10 evicted)
    expect(past[0][0].id).toBe('el-10');
    expect(past[49][0].id).toBe('el-59');
  });

  it('popState discards the most recent snapshot', () => {
    const s = useHistoryStore.getState();
    s.pushState([makeEl('a')]);
    s.pushState([makeEl('b')]);
    s.popState();
    const { past } = useHistoryStore.getState();
    expect(past).toHaveLength(1);
    expect(past[0][0].id).toBe('a');
  });

  it('snapshots are copies — mutating an element later does not corrupt history', () => {
    const el = makeEl('a');
    useHistoryStore.getState().pushState([el]);
    el.x = 999;
    expect(useHistoryStore.getState().past[0][0].x).toBe(0);
  });
});
