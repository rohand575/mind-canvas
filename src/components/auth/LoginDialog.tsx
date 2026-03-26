import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';

interface LoginDialogProps {
  open: boolean;
  onClose: () => void;
}

export function LoginDialog({ open, onClose }: LoginDialogProps) {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useAuthStore();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setError('');
      setEmail('');
      setPassword('');
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
  };

  const handleGoogle = async () => {
    setError('');
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Authentication failed';
      setError(msg.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xl" />
      <div
        className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-2xl shadow-black/25 dark:shadow-black/50 ring-1 ring-black/[0.05] dark:ring-white/[0.1] px-8 py-8 max-w-sm w-full mx-6 animate-in fade-in zoom-in-95 border border-white/50 dark:border-white/[0.05]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1.5 tracking-tight">
          {isSignUp ? 'Create account' : 'Sign in'}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-7">
          {isSignUp ? 'Start saving your canvases to the cloud' : 'Access your saved canvases'}
        </p>

        {/* Google sign-in */}
        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-white dark:bg-gray-800 shadow-sm hover:shadow-md ring-1 ring-gray-200/80 dark:ring-gray-600 hover:ring-gray-300 dark:hover:ring-gray-500 transition-all duration-200 text-sm font-semibold text-gray-700 dark:text-gray-200 disabled:opacity-50 active:scale-[0.98]"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          <span className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide">or</span>
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full px-4 py-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-200"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            className="w-full px-4 py-3 rounded-xl bg-gray-50/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all duration-200"
          />

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-b from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white text-sm font-semibold shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40 transition-all duration-200 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? 'Please wait…' : isSignUp ? 'Sign up' : 'Sign in'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-5">
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button
            onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
            className="text-indigo-500 hover:text-indigo-600 font-medium"
          >
            {isSignUp ? 'Sign in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  );
}
