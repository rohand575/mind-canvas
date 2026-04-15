import { useEffect } from 'react';
import { useCanvasStore } from '../../store/canvasStore';
import { useAuthStore } from '../../store/authStore';
import { useDocumentStore } from '../../store/documentStore';
import { SidebarHeader } from './SidebarHeader';
import { CanvasList } from './CanvasList';
import { SIDEBAR_WIDTH } from '../../constants';

export function Sidebar() {
  const sidebarOpen = useCanvasStore((s) => s.sidebarOpen);
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);
  const user = useAuthStore((s) => s.user);

  // Close sidebar if user signs out
  useEffect(() => {
    if (!user) setSidebarOpen(false);
  }, [user, setSidebarOpen]);

  return (
    <>
      {/* Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar panel */}
      <div
        className={`fixed top-0 left-0 z-50 h-full flex flex-col bg-white/98 dark:bg-gray-900/98 backdrop-blur-2xl shadow-2xl shadow-black/15 dark:shadow-black/40 ring-1 ring-black/[0.04] dark:ring-white/[0.08] border-r border-gray-200/50 dark:border-white/[0.05] transition-transform duration-300 ease-out`}
        style={{ width: SIDEBAR_WIDTH }}
        data-sidebar
      >
        <div
          className={`flex flex-col h-full transition-transform duration-300 ease-out ${
            sidebarOpen ? 'translate-x-0' : ''
          }`}
          style={{
            transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
          }}
        >
          <SidebarHeader />
          <CanvasList />

          {/* Sign-out at bottom */}
          <div className="px-4 py-3 border-t border-gray-200/60 dark:border-white/[0.06]">
            <button
              onClick={async () => {
                useDocumentStore.getState().reset();
                await useAuthStore.getState().signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Push the sidebar in/out */}
      <style>{`
        [data-sidebar] {
          transform: ${sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`};
        }
      `}</style>
    </>
  );
}
