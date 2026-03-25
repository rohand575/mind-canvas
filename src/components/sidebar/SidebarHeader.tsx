import { useAuthStore } from '../../store/authStore';
import { useCanvasStore } from '../../store/canvasStore';

export function SidebarHeader() {
  const user = useAuthStore((s) => s.user);
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-white/[0.06]">
      <div className="flex items-center gap-3 min-w-0">
        {user?.photoURL ? (
          <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full flex-shrink-0" referrerPolicy="no-referrer" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-white text-sm font-semibold">
            {(user?.displayName?.[0] || user?.email?.[0] || '?').toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          {user?.displayName && (
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{user.displayName}</p>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
        </div>
      </div>
      <button
        onClick={() => setSidebarOpen(false)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150 flex-shrink-0"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
