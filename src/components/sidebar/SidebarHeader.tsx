import { useCanvasStore } from '../../store/canvasStore';

export function SidebarHeader() {
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);

  return (
    <div className="px-6 py-6 border-b border-gray-100 dark:border-white/[0.06]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 flex-shrink-0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-gray-900 dark:text-gray-100 leading-none mb-1">Canvas</p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 leading-none">Your workspaces</p>
          </div>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all duration-150"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
