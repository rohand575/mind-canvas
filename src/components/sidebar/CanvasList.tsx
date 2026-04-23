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

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

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
    if (trimmed && renamingId) await renameCanvas(id, trimmed);
    setRenamingId(null);
  };

  const handleDelete = async (id: string) => {
    setMenuId(null);
    if (!confirm('Delete this canvas? This cannot be undone.')) return;
    await deleteCanvas(id);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* New canvas — sits in its own section with generous margins */}
      <div className="px-6 py-5">
        <button
          onClick={handleCreate}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-[13px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/[0.08] hover:bg-indigo-100/70 dark:hover:bg-indigo-500/[0.14] transition-all duration-150"
        >
          <div className="w-5 h-5 rounded-md bg-indigo-500/15 dark:bg-indigo-400/20 flex items-center justify-center flex-shrink-0">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          New canvas
        </button>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-gray-100 dark:bg-white/[0.06]" />

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && canvasList.length === 0 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-10">Loading…</p>
        )}

        {!isLoading && canvasList.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-6 py-16">
            <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-white/[0.06] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
              </svg>
            </div>
            <p className="text-[12px] text-gray-400 dark:text-gray-500 text-center leading-relaxed">
              No canvases yet.<br />Create one to get started.
            </p>
          </div>
        )}

        {canvasList.length > 0 && (
          <div className="px-3 pt-5 pb-6">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-gray-400 dark:text-gray-500 px-3 mb-3">
              All canvases
            </p>
            <div className="flex flex-col gap-0.5">
              {canvasList.map((canvas) => (
                <div
                  key={canvas.id}
                  className={`group relative flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition-colors duration-100
                    ${canvas.id === currentCanvasId
                      ? 'bg-indigo-500/[0.08] dark:bg-indigo-400/[0.12]'
                      : 'hover:bg-gray-100/80 dark:hover:bg-white/[0.04]'
                    }`}
                  onClick={() => {
                    if (renamingId !== canvas.id) openCanvas(canvas.id);
                  }}
                >
                  {/* Active indicator bar */}
                  <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full transition-all duration-150 ${canvas.id === currentCanvasId ? 'bg-indigo-500 dark:bg-indigo-400 opacity-100' : 'opacity-0'}`} />

                  <svg
                    className={`w-4 h-4 flex-shrink-0 transition-colors duration-100 ${canvas.id === currentCanvasId ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"
                  >
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
                      className="flex-1 min-w-0 bg-transparent text-[13px] focus:outline-none border-b border-indigo-400"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className={`flex-1 min-w-0 text-[13px] font-medium truncate ${canvas.id === currentCanvasId ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {canvas.name}
                    </span>
                  )}

                  {renamingId !== canvas.id && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuId(menuId === canvas.id ? null : canvas.id);
                      }}
                      className="w-6 h-6 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-gray-200/60 dark:hover:bg-white/[0.08] transition-all duration-100 flex-shrink-0"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                  )}

                  {menuId === canvas.id && (
                    <div
                      ref={menuRef}
                      className="absolute top-full right-0 mt-1.5 bg-white dark:bg-gray-900 rounded-xl shadow-xl shadow-black/[0.08] dark:shadow-black/30 ring-1 ring-gray-950/[0.06] dark:ring-white/[0.08] p-1.5 min-w-[150px] z-50"
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setMenuId(null);
                          setRenameValue(canvas.name);
                          setRenamingId(canvas.id);
                        }}
                        className="w-full px-3 py-2 text-left rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-100"
                      >
                        Rename
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(canvas.id);
                        }}
                        className="w-full px-3 py-2 text-left rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors duration-100"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer — anchors the bottom so the sidebar doesn't feel empty */}
      <div className="px-6 py-5 border-t border-gray-100 dark:border-white/[0.06]">
        <p className="text-[11px] text-gray-300 dark:text-gray-600 font-medium tracking-wide">Canvas v1.0</p>
      </div>

    </div>
  );
}
