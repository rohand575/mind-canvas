/**
 * Wires Firebase auth state changes to Firestore real-time subscriptions.
 * Import this module once at app startup (main.tsx) — it has no exports.
 *
 * - Sign in  → subscribe to the user's canvas list in real time
 * - Sign out → tear down all Firestore subscriptions and reset document state
 */
import { useAuthStore } from './authStore';
import { useDocumentStore } from './documentStore';

useAuthStore.subscribe((state, prev) => {
  const signedIn = !!state.user;
  const wasSignedIn = !!prev.user;

  if (signedIn && !wasSignedIn) {
    // User just signed in — start real-time canvas list subscription
    useDocumentStore.getState().subscribeCanvasList(state.user!.uid);
  } else if (!signedIn && wasSignedIn) {
    // User just signed out — clean up all subscriptions and clear state
    useDocumentStore.getState().reset();
  }
});
