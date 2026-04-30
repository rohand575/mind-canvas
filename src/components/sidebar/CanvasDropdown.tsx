import { useState, useRef, useEffect } from 'react';
import { useDocumentStore } from '../../store/documentStore';

export function CanvasDropdown() {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);

  // Wraps both the trigger button and the fixed panel so contains() works for outside-click
  const dropdownRef = useRef<HTMLDivElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const canvasList = useDocumentStore((s) => s.canvasList);
  const currentCanvasId = useDocumentStore((s) => s.currentCanvasId);
  const { createCanvas, openCanvas, renameCanvas, deleteCanvas } = useDocumentStore();

  const close = () => { setOpen(false); setMenuId(null); setRenamingId(null); };

  // Close on outside click (works for fixed panel too — DOM containment, not layout)
  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (!menuId) return;
    const handle = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [menuId]);

  useEffect(() => {
    if (renamingId && renameRef.current) renameRef.current.focus();
  }, [renamingId]);

  const handleCreate = async () => {
    const name = `Untitled ${canvasList.length + 1}`;
    await createCanvas(name);
  };

  const handleRename = async (id: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) await renameCanvas(id, trimmed);
    setRenamingId(null);
  };

  const handleDelete = async (id: string) => {
    setMenuId(null);
    if (!confirm('Delete this canvas? This cannot be undone.')) return;
    await deleteCanvas(id);
  };

  return (
    <>
      {/* ── Blur overlay ─────────────────────────────────────────────────────────
          Sits above the toolbar panels (z-40) but below the dropdown (z-50).
          Blurs and lightly dims all other UI when the picker is open.       */}
      {open && (
        <div
          className="fixed inset-0 z-[45] bg-black/[0.06] backdrop-blur-[2px] transition-opacity duration-200"
          onMouseDown={close}
        />
      )}

      {/* ── Trigger button + panel wrapper ───────────────────────────────────── */}
      <div className="absolute top-5 left-5 z-[50]" ref={dropdownRef}>

        {/* + / × trigger */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label="Open canvas switcher"
          className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200 ${
            open
              ? 'bg-indigo-500 shadow-lg shadow-indigo-500/40 text-white scale-[0.96]'
              : 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg shadow-md shadow-black/[0.06] dark:shadow-black/30 ring-1 ring-black/[0.06] dark:ring-white/[0.07] text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:shadow-lg hover:scale-[1.03]'
          }`}
        >
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
            className={`transition-transform duration-200 ${open ? 'rotate-45' : 'rotate-0'}`}
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        {/* ── Dropdown panel ───────────────────────────────────────────────────
            Uses position:fixed so it escapes App's overflow:hidden clip.
            Top = button top (20px) + button height (56px) + gap (10px) = 86px */}
        {open && (
          <div className="fixed top-[86px] left-5 w-[380px] bg-white dark:bg-[#13131f] rounded-3xl shadow-2xl shadow-black/[0.16] dark:shadow-black/60 ring-1 ring-black/[0.05] dark:ring-white/[0.07] z-[50] animate-in fade-in slide-in-from-top-2 duration-200">

            {/* Header */}
            <div className="px-6 pt-6 pb-4">
              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-gray-400 dark:text-gray-500 select-none">
                Canvases
              </p>
            </div>

            {/* Canvas list */}
            <div className="px-4 pb-2 max-h-[320px] overflow-y-auto space-y-1.5">
              {canvasList.length === 0 && (
                <div className="flex flex-col items-center gap-2.5 py-12">
                  <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-white/[0.04] flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-600">
                      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" />
                    </svg>
                  </div>
                  <p className="text-[13px] text-gray-400 dark:text-gray-500 text-center">
                    No canvases yet.<br />Create one below.
                  </p>
                </div>
              )}

              {canvasList.map((canvas) => {
                const isActive = canvas.id === currentCanvasId;
                const isRenaming = renamingId === canvas.id;

                return (
                  <div
                    key={canvas.id}
                    className={`group relative flex items-center gap-4 px-4 py-3.5 rounded-2xl cursor-pointer transition-all duration-150 ${
                      isActive
                        ? 'bg-indigo-50 dark:bg-indigo-500/[0.10]'
                        : 'hover:bg-gray-50 dark:hover:bg-white/[0.03]'
                    }`}
                    onClick={() => {
                      if (!isRenaming) { openCanvas(canvas.id); close(); }
                    }}
                  >
                    {/* Icon box */}
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors duration-150 ${
                      isActive
                        ? 'bg-indigo-100 dark:bg-indigo-500/20'
                        : 'bg-gray-100 dark:bg-white/[0.06]'
                    }`}>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="1.75"
                        strokeLinecap="round" strokeLinejoin="round"
                        className={isActive ? 'text-indigo-500 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" />
                      </svg>
                    </div>

                    {/* Name / rename input */}
                    {isRenaming ? (
                      <input
                        ref={renameRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(canvas.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(canvas.id);
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="flex-1 min-w-0 bg-transparent text-[15px] font-medium text-gray-800 dark:text-gray-200 focus:outline-none border-b-2 border-indigo-400 pb-0.5"
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className={`flex-1 min-w-0 text-[15px] font-medium truncate ${
                        isActive ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {canvas.name}
                      </span>
                    )}

                    {/* Right: active dot + 3-dot menu */}
                    {!isRenaming && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isActive && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500 dark:bg-indigo-400" />
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(menuId === canvas.id ? null : canvas.id);
                          }}
                          className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-400 hover:bg-gray-200/70 dark:hover:bg-white/[0.08] transition-all duration-150"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="1.75" />
                            <circle cx="12" cy="12" r="1.75" />
                            <circle cx="12" cy="19" r="1.75" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* Context menu */}
                    {menuId === canvas.id && (
                      <div
                        ref={menuRef}
                        className="absolute top-full right-3 mt-2 bg-white dark:bg-gray-900 rounded-2xl shadow-xl shadow-black/[0.10] dark:shadow-black/40 ring-1 ring-black/[0.06] dark:ring-white/[0.08] p-2 min-w-[160px] z-[60]"
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setMenuId(null);
                            setRenameValue(canvas.name);
                            setRenamingId(canvas.id);
                          }}
                          className="w-full px-3.5 py-2.5 text-left rounded-xl text-[13px] font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors duration-100"
                        >
                          Rename
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(canvas.id);
                          }}
                          className="w-full px-3.5 py-2.5 text-left rounded-xl text-[13px] font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/[0.08] transition-colors duration-100"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* New Canvas */}
            <div className="p-4 pt-3">
              <button
                onClick={handleCreate}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-2xl text-[14px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/[0.08] hover:bg-amber-100/80 dark:hover:bg-amber-500/[0.14] border border-dashed border-amber-300 dark:border-amber-500/30 hover:border-amber-400 dark:hover:border-amber-500/50 transition-all duration-150"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New Canvas
              </button>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
