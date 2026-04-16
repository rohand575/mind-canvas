import { useCanvasStore } from '../../store/canvasStore';

export function SidebarHeader() {
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/60 dark:border-white/[0.06]">
      <div className="flex items-center gap-2">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
        </svg>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Canvases</span>
      </div>
      <button
        onClick={() => setSidebarOpen(false)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-150"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
