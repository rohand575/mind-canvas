import { create } from 'zustand';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase';

interface AuthStore {
  user: User | null;
  loading: boolean;
  initialized: boolean;

  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  loading: false,
  initialized: false,

  signInWithGoogle: async () => {
    set({ loading: true });
    try {
      await signInWithPopup(auth, googleProvider);
    } finally {
      set({ loading: false });
    }
  },

  signInWithEmail: async (email, password) => {
    set({ loading: true });
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      set({ loading: false });
    }
  },

  signUpWithEmail: async (email, password) => {
    set({ loading: true });
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } finally {
      set({ loading: false });
    }
  },

  signOut: async () => {
    await firebaseSignOut(auth);
  },
}));

// Subscribe to auth state changes — runs once on module load
onAuthStateChanged(auth, (user) => {
  useAuthStore.setState({ user, initialized: true, loading: false });
});
