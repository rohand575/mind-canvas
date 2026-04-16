import { openDB, type IDBPDatabase } from 'idb';
import type { CanvasDocument, CanvasDocumentMeta } from '../types';
import { DB_NAME, DB_VERSION, STORE_NAME } from '../constants';

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

export async function saveCanvasLocally(canvas: CanvasDocument): Promise<void> {
  const db = await getDB();
  await db.put(STORE_NAME, canvas);
}

export async function loadCanvasLocally(id: string): Promise<CanvasDocument | null> {
  const db = await getDB();
  return (await db.get(STORE_NAME, id)) ?? null;
}

export async function loadAllCanvasMeta(): Promise<CanvasDocumentMeta[]> {
  const db = await getDB();
  const all = (await db.getAll(STORE_NAME)) as CanvasDocument[];
  return all
    .map(({ id, name, createdAt, updatedAt }) => ({ id, name, createdAt, updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function deleteCanvasLocally(id: string): Promise<void> {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
}
