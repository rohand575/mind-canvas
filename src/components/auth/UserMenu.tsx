import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useDocumentStore } from '../../store/documentStore';

export function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const reset = useDocumentStore((s) => s.reset);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  if (!user) return null;

  const initial = (user.displayName?.[0] || user.email?.[0] || '?').toUpperCase();

  const handleSignOut = async () => {
    setOpen(false);
    reset();
    await signOut();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-200 ring-2 ring-white dark:ring-gray-800 shadow-lg shadow-black/10 overflow-hidden hover:ring-indigo-400 dark:hover:ring-indigo-500 hover:scale-105 active:scale-95"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            {initial}
          </span>
        )}
      </button>

      <div
        className={`absolute top-full right-0 mt-3 bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/15 dark:shadow-black/40 ring-1 ring-black/[0.04] dark:ring-white/[0.08] border border-white/60 dark:border-white/[0.05] p-2 min-w-[220px] z-50 transition-all duration-200 origin-top-right
          ${open ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 -translate-y-1 pointer-events-none'}`}
      >
        <div className="px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 mb-2">
          {user.displayName && (
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user.displayName}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full px-3 py-2.5 text-left rounded-xl text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100 transition-colors duration-150"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
