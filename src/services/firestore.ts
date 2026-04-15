import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { FIRESTORE_CANVASES_COLLECTION } from '../constants';
import type { CanvasDocument, CanvasDocumentMeta } from '../types';

const canvasesRef = collection(db, FIRESTORE_CANVASES_COLLECTION);

export async function fetchUserCanvases(uid: string): Promise<CanvasDocumentMeta[]> {
  const q = query(
    canvasesRef,
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => {
    const data = d.data();
    return {
      id: d.id,
      name: data.name,
      updatedAt: data.updatedAt,
      createdAt: data.createdAt,
    };
  });
}

export async function fetchCanvas(canvasId: string): Promise<CanvasDocument | null> {
  const docRef = doc(db, FIRESTORE_CANVASES_COLLECTION, canvasId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as CanvasDocument;
}

export async function saveCanvasToFirestore(canvas: CanvasDocument): Promise<void> {
  const docRef = doc(db, FIRESTORE_CANVASES_COLLECTION, canvas.id);
  await setDoc(docRef, {
    ownerId: canvas.ownerId,
    name: canvas.name,
    elements: canvas.elements,
    canvasState: canvas.canvasState,
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
  });
}

export async function deleteCanvasFromFirestore(canvasId: string): Promise<void> {
  const docRef = doc(db, FIRESTORE_CANVASES_COLLECTION, canvasId);
  await deleteDoc(docRef);
}

export async function renameCanvasInFirestore(canvasId: string, name: string): Promise<void> {
  const docRef = doc(db, FIRESTORE_CANVASES_COLLECTION, canvasId);
  await updateDoc(docRef, { name, updatedAt: Date.now() });
}

/**
 * Real-time subscription to the user's canvas list.
 * Calls callback whenever any canvas is created, renamed, or deleted.
 * Returns an unsubscribe function.
 */
export function subscribeToUserCanvases(
  uid: string,
  callback: (list: CanvasDocumentMeta[]) => void,
): () => void {
  const q = query(
    canvasesRef,
    where('ownerId', '==', uid),
    orderBy('updatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name,
          updatedAt: data.updatedAt,
          createdAt: data.createdAt,
        } as CanvasDocumentMeta;
      });
      callback(list);
    },
    (err) => console.error('[Firestore] canvas list subscription error:', err),
  );
}

/**
 * Real-time subscription to a single canvas document.
 * Calls callback whenever the canvas content changes (e.g. saved from another device).
 * Returns an unsubscribe function.
 */
export function subscribeToCanvas(
  canvasId: string,
  callback: (canvas: CanvasDocument | null) => void,
): () => void {
  const docRef = doc(db, FIRESTORE_CANVASES_COLLECTION, canvasId);
  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback({ id: snapshot.id, ...snapshot.data() } as CanvasDocument);
    },
    (err) => console.error('[Firestore] canvas document subscription error:', err),
  );
}
