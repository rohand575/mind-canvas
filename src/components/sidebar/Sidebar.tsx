import { useCanvasStore } from '../../store/canvasStore';
import { SidebarHeader } from './SidebarHeader';
import { CanvasList } from './CanvasList';
import { SIDEBAR_WIDTH } from '../../constants';

export function Sidebar() {
  const sidebarOpen = useCanvasStore((s) => s.sidebarOpen);
  const setSidebarOpen = useCanvasStore((s) => s.setSidebarOpen);

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
        className="fixed top-0 left-0 z-50 h-full flex flex-col bg-white/98 dark:bg-gray-900/98 backdrop-blur-2xl shadow-2xl shadow-black/15 dark:shadow-black/40 ring-1 ring-black/[0.04] dark:ring-white/[0.08] border-r border-gray-200/50 dark:border-white/[0.05] transition-transform duration-300 ease-out"
        style={{
          width: SIDEBAR_WIDTH,
          transform: sidebarOpen ? 'translateX(0)' : `translateX(-${SIDEBAR_WIDTH}px)`,
        }}
      >
        <SidebarHeader />
        <CanvasList />
      </div>
    </>
  );
}
