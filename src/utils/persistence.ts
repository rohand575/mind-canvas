import { openDB, type IDBPDatabase } from 'idb';
import type { CanvasElement, CanvasState } from '../types';
import { DB_NAME, DB_VERSION, STORE_NAME, DEFAULT_CANVAS_ID } from '../constants';

interface SavedCanvas {
  id: string;
  elements: CanvasElement[];
  canvasState: CanvasState;
  updatedAt: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveCanvas(
  elements: CanvasElement[],
  canvasState: CanvasState,
): Promise<void> {
  const db = await getDB();
  const data: SavedCanvas = {
    id: DEFAULT_CANVAS_ID,
    elements,
    canvasState,
    updatedAt: Date.now(),
  };
  await db.put(STORE_NAME, data);
}

export async function loadCanvas(): Promise<{
  elements: CanvasElement[];
  canvasState: CanvasState;
} | null> {
  const db = await getDB();
  const data = await db.get(STORE_NAME, DEFAULT_CANVAS_ID) as SavedCanvas | undefined;
  if (!data) return null;
  return { elements: data.elements, canvasState: data.canvasState };
}

export async function clearCanvas(): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, DEFAULT_CANVAS_ID);
}
