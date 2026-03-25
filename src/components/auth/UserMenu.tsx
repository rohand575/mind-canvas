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
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-150 ring-1 ring-gray-200 dark:ring-gray-700 overflow-hidden hover:ring-indigo-400 dark:hover:ring-indigo-500"
      >
        {user.photoURL ? (
          <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="w-full h-full flex items-center justify-center bg-indigo-500 text-white">
            {initial}
          </span>
        )}
      </button>

      <div
        className={`absolute top-full right-0 mt-2 bg-white dark:bg-gray-900 backdrop-blur-lg rounded-xl shadow-xl shadow-black/[0.08] dark:shadow-black/30 ring-1 ring-gray-950/[0.06] dark:ring-white/[0.08] p-2 min-w-[200px] z-50 transition-all duration-150 origin-top-right
          ${open ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
      >
        <div className="px-2.5 py-2 border-b border-gray-100 dark:border-gray-800 mb-1">
          {user.displayName && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.displayName}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full px-2.5 py-2 text-left rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-100"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
