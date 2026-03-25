import { useState, useRef, useEffect } from 'react';
import { useDocumentStore } from '../../store/documentStore';

export function CanvasList() {
  const canvasList = useDocumentStore((s) => s.canvasList);
  const currentCanvasId = useDocumentStore((s) => s.currentCanvasId);
  const { createCanvas, openCanvas, renameCanvas, deleteCanvas, isLoading } = useDocumentStore();

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuId) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuId]);

  const handleCreate = async () => {
    const name = `Untitled ${canvasList.length + 1}`;
    await createCanvas(name);
  };

  const handleRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed && renamingId) {
      await renameCanvas(id, trimmed);
    }
    setRenamingId(null);
  };

  const handleDelete = async (id: string) => {
    setMenuId(null);
    if (!confirm('Delete this canvas? This cannot be undone.')) return;
    await deleteCanvas(id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* New canvas button */}
      <div className="px-3 py-2">
        <button
          onClick={handleCreate}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/[0.06] dark:hover:bg-indigo-400/[0.08] transition-colors duration-150"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New canvas
        </button>
      </div>

      {/* Canvas list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {isLoading && canvasList.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">Loading…</p>
        )}

        {!isLoading && canvasList.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-8">No canvases yet. Create one!</p>
        )}

        <div className="flex flex-col gap-0.5">
          {canvasList.map((canvas) => (
            <div
              key={canvas.id}
              className={`group relative flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-colors duration-100
                ${canvas.id === currentCanvasId
                  ? 'bg-indigo-500/[0.08] text-indigo-700 dark:bg-indigo-400/[0.12] dark:text-indigo-300'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-white/[0.04]'
                }`}
              onClick={() => {
                if (renamingId !== canvas.id) openCanvas(canvas.id);
              }}
            >
              {/* Canvas icon */}
              <svg className="w-4 h-4 flex-shrink-0 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
              </svg>

              {renamingId === canvas.id ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(canvas.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(canvas.id);
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="flex-1 min-w-0 bg-transparent text-sm focus:outline-none border-b border-indigo-400"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 min-w-0 text-sm truncate">{canvas.name}</span>
              )}

              {/* Context menu trigger */}
              {renamingId !== canvas.id && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === canvas.id ? null : canvas.id);
                  }}
                  className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-gray-200/60 dark:hover:bg-white/[0.08] transition-all duration-100"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                  </svg>
                </button>
              )}

              {/* Dropdown menu */}
              {menuId === canvas.id && (
                <div
                  ref={menuRef}
                  className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-900 rounded-xl shadow-lg shadow-black/[0.08] dark:shadow-black/30 ring-1 ring-gray-950/[0.06] dark:ring-white/[0.08] p-1.5 min-w-[140px] z-50"
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuId(null);
                      setRenameValue(canvas.name);
                      setRenamingId(canvas.id);
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-100"
                  >
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(canvas.id);
                    }}
                    className="w-full px-2.5 py-1.5 text-left rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors duration-100"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
