import { useEffect, useRef, useState } from 'react';
import { useToolStore } from '../../store/toolStore';
import { useElementStore } from '../../store/elementStore';
import { useShapeLibraryStore } from '../../store/shapeLibraryStore';
import { useHistory } from '../../hooks/useHistory';
import { pasteFromClipboard } from '../../hooks/useKeyboardShortcuts';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { saveSnapshot } = useHistory();
  const [position, setPosition] = useState({ x, y });
  const [hyperlinkInput, setHyperlinkInput] = useState(false);
  const [hyperlinkValue, setHyperlinkValue] = useState('');
  const [embedUrlInput, setEmbedUrlInput] = useState(false);
  const [embedUrlValue, setEmbedUrlValue] = useState('');

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 8;
    let newX = x;
    let newY = y;
    if (x + rect.width > window.innerWidth - padding) {
      newX = window.innerWidth - rect.width - padding;
    }
    if (y + rect.height > window.innerHeight - padding) {
      newY = window.innerHeight - rect.height - padding;
    }
    if (newX !== x || newY !== y) {
      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const selectedIds = useToolStore((s) => s.selectedIds);
  const singleSelected = selectedIds.length === 1 ? selectedIds[0] : null;

  const { elements } = useElementStore();
  const selectedElements = elements.filter(el => selectedIds.includes(el.id));
  const singleElement = singleSelected ? elements.find(el => el.id === singleSelected) : null;

  const isLocked = selectedElements.every(el => el.locked);
  const hasGroup = selectedElements.some(el => el.groupId);
  const allGrouped = selectedElements.length > 1 && selectedElements.every(el => el.groupId && el.groupId === selectedElements[0].groupId);
  const isArrowOrLine = singleElement && (singleElement.type === 'arrow' || singleElement.type === 'line');
  const isEmbed = singleElement?.type === 'embed';

  const handleCopy = () => {
    const selected = elements.filter((el) => selectedIds.includes(el.id));
    if (selected.length > 0) {
      navigator.clipboard.writeText(JSON.stringify({ type: 'canvas-clipboard', elements: selected }));
    }
    onClose();
  };

  const handlePaste = async () => {
    await pasteFromClipboard();
    onClose();
  };

  const handleDuplicate = () => {
    if (selectedIds.length > 0) {
      saveSnapshot();
      const duped = useElementStore.getState().duplicateElements(selectedIds);
      useToolStore.getState().setSelectedIds(duped.map((el) => el.id));
    }
    onClose();
  };

  const handleDelete = () => {
    if (selectedIds.length > 0) {
      saveSnapshot();
      useElementStore.getState().removeElements(selectedIds);
      useToolStore.getState().clearSelection();
    }
    onClose();
  };

  const handleBringForward = () => { if (singleSelected) useElementStore.getState().bringForward(singleSelected); onClose(); };
  const handleSendBackward = () => { if (singleSelected) useElementStore.getState().sendBackward(singleSelected); onClose(); };
  const handleBringToFront = () => { if (singleSelected) useElementStore.getState().bringToFront(singleSelected); onClose(); };
  const handleSendToBack = () => { if (singleSelected) useElementStore.getState().sendToBack(singleSelected); onClose(); };

  const handleToggleLock = () => {
    saveSnapshot();
    useElementStore.getState().lockElements(selectedIds, !isLocked);
    if (!isLocked) useToolStore.getState().clearSelection();
    onClose();
  };

  const handleGroup = () => {
    if (selectedIds.length < 2) return;
    saveSnapshot();
    useElementStore.getState().groupElements(selectedIds);
    onClose();
  };

  const handleUngroup = () => {
    saveSnapshot();
    // Get all elements with the same groupId as any selected element
    const groupIds = new Set(selectedElements.map(el => el.groupId).filter(Boolean));
    const idsToUngroup = elements
      .filter(el => el.groupId && groupIds.has(el.groupId))
      .map(el => el.id);
    useElementStore.getState().ungroupElements(idsToUngroup);
    onClose();
  };

  const handleHyperlinkOpen = () => {
    if (singleElement?.hyperlink) {
      window.open(singleElement.hyperlink, '_blank', 'noopener,noreferrer');
    }
    onClose();
  };

  const handleAddLink = () => {
    setHyperlinkValue(singleElement?.hyperlink || '');
    setHyperlinkInput(true);
  };

  const handleSaveLink = () => {
    if (singleSelected) {
      const url = hyperlinkValue.trim();
      useElementStore.getState().updateElement(singleSelected, {
        hyperlink: url || undefined,
      });
    }
    onClose();
  };

  const handleRemoveLink = () => {
    if (singleSelected) {
      useElementStore.getState().updateElement(singleSelected, { hyperlink: undefined });
    }
    onClose();
  };

  const handleEditEmbedUrl = () => {
    setEmbedUrlValue(singleElement?.embedUrl ?? '');
    setEmbedUrlInput(true);
  };

  const handleSaveEmbedUrl = () => {
    if (singleSelected) {
      const url = embedUrlValue.trim();
      useElementStore.getState().updateElement(singleSelected, { embedUrl: url || undefined });
    }
    onClose();
  };

  const handleToggleElbow = () => {
    if (!singleElement) return;
    const newStyle = singleElement.connectorStyle === 'elbow' ? 'straight' : 'elbow';
    useElementStore.getState().updateElement(singleElement.id, { connectorStyle: newStyle });
    onClose();
  };

  const handleAddToLibrary = () => {
    const selected = elements.filter(el => selectedIds.includes(el.id));
    if (selected.length === 0) return;
    const name = `Shape ${useShapeLibraryStore.getState().items.length + 1}`;
    useShapeLibraryStore.getState().addItem(name, selected);
    useShapeLibraryStore.getState().setOpen(true);
    onClose();
  };

  const item = `w-[calc(100%-10px)] mx-1.5 px-3.5 py-2.5 text-left text-sm rounded-xl hover:bg-gray-500/[0.06] dark:hover:bg-white/[0.06] transition-colors duration-100 flex items-center justify-between`;
  const shortcut = `text-xs text-gray-400 dark:text-gray-500 ml-6`;
  const sep = <div className="h-px bg-gray-950/[0.05] dark:bg-white/[0.06] my-1.5 mx-3" />;

  return (
    <div
      ref={menuRef}
      className="fixed bg-white/98 dark:bg-gray-900/98 backdrop-blur-xl rounded-2xl shadow-[0_8px_28px_rgba(0,0,0,0.10),0_2px_8px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.5)] border border-black/[0.06] dark:border-white/[0.07] py-2.5 min-w-[220px] z-[100] animate-in fade-in zoom-in-95"
      style={{ left: position.x, top: position.y }}
    >
      {hyperlinkInput ? (
        <div className="px-3 py-2 flex flex-col gap-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Link URL</span>
          <input
            autoFocus
            value={hyperlinkValue}
            onChange={(e) => setHyperlinkValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveLink(); if (e.key === 'Escape') setHyperlinkInput(false); }}
            placeholder="https://..."
            className="text-[13px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-indigo-400 w-full"
          />
          <div className="flex gap-2">
            <button onClick={handleSaveLink} className="flex-1 text-[12px] py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              Save
            </button>
            <button onClick={() => setHyperlinkInput(false)} className="text-[12px] py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-600 dark:text-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : embedUrlInput ? (
        <div className="px-3 py-2 flex flex-col gap-2">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">Embed URL</span>
          <input
            autoFocus
            value={embedUrlValue}
            onChange={(e) => setEmbedUrlValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEmbedUrl(); if (e.key === 'Escape') setEmbedUrlInput(false); }}
            placeholder="https://youtube.com/watch?v=..."
            className="text-[13px] px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-white/10 bg-transparent text-gray-800 dark:text-gray-200 outline-none focus:ring-1 focus:ring-indigo-400 w-full"
          />
          <div className="flex gap-2">
            <button onClick={handleSaveEmbedUrl} className="flex-1 text-[12px] py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors">
              Save
            </button>
            <button onClick={() => setEmbedUrlInput(false)} className="text-[12px] py-1.5 px-3 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-600 dark:text-gray-400 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {selectedIds.length > 0 && (
            <>
              <button onClick={handleCopy} className={item + ' text-gray-700 dark:text-gray-300'}>
                Copy <span className={shortcut}>Ctrl+C</span>
              </button>
              <button onClick={handlePaste} className={item + ' text-gray-700 dark:text-gray-300'}>
                Paste <span className={shortcut}>Ctrl+V</span>
              </button>
              <button onClick={handleDuplicate} className={item + ' text-gray-700 dark:text-gray-300'}>
                Duplicate <span className={shortcut}>Ctrl+D</span>
              </button>
              {sep}
              <button onClick={handleDelete} className={item + ' text-red-600 dark:text-red-400'}>
                Delete <span className={shortcut}>Del</span>
              </button>
              {sep}

              {/* Group / Ungroup */}
              {selectedIds.length > 1 && !allGrouped && (
                <button onClick={handleGroup} className={item + ' text-gray-700 dark:text-gray-300'}>
                  Group <span className={shortcut}>Ctrl+G</span>
                </button>
              )}
              {(hasGroup || allGrouped) && (
                <button onClick={handleUngroup} className={item + ' text-gray-700 dark:text-gray-300'}>
                  Ungroup <span className={shortcut}>Ctrl+Shift+G</span>
                </button>
              )}

              {/* Lock / Unlock */}
              <button onClick={handleToggleLock} className={item + ' text-gray-700 dark:text-gray-300'}>
                {isLocked ? 'Unlock' : 'Lock'} <span className={shortcut}>Ctrl+L</span>
              </button>

              {/* Add to library */}
              <button onClick={handleAddToLibrary} className={item + ' text-gray-700 dark:text-gray-300'}>
                Add to Library
              </button>

              {/* Embed URL (embed elements only) */}
              {isEmbed && singleElement && (
                <>
                  {sep}
                  <button onClick={handleEditEmbedUrl} className={item + ' text-gray-700 dark:text-gray-300'}>
                    {singleElement.embedUrl ? 'Edit Embed URL' : 'Add Embed URL'}
                  </button>
                </>
              )}

              {/* Hyperlink (non-embed single element) */}
              {singleElement && !isEmbed && (
                <>
                  {sep}
                  {singleElement.hyperlink ? (
                    <>
                      <button onClick={handleHyperlinkOpen} className={item + ' text-blue-600 dark:text-blue-400'}>
                        Open Link
                      </button>
                      <button onClick={handleAddLink} className={item + ' text-gray-700 dark:text-gray-300'}>
                        Edit Link
                      </button>
                      <button onClick={handleRemoveLink} className={item + ' text-gray-700 dark:text-gray-300'}>
                        Remove Link
                      </button>
                    </>
                  ) : (
                    <button onClick={handleAddLink} className={item + ' text-gray-700 dark:text-gray-300'}>
                      Add Link
                    </button>
                  )}
                </>
              )}

              {/* Connector style (arrow/line only) */}
              {isArrowOrLine && (
                <>
                  {sep}
                  <button onClick={handleToggleElbow} className={item + ' text-gray-700 dark:text-gray-300'}>
                    {singleElement?.connectorStyle === 'elbow' ? 'Straight connector' : 'Elbow connector'}
                  </button>
                </>
              )}

              {/* Z-ordering (single only) */}
              {singleSelected && (
                <>
                  {sep}
                  <button onClick={handleBringToFront} className={item + ' text-gray-700 dark:text-gray-300'}>
                    Bring to front <span className={shortcut}>Ctrl+Shift+]</span>
                  </button>
                  <button onClick={handleBringForward} className={item + ' text-gray-700 dark:text-gray-300'}>
                    Bring forward <span className={shortcut}>Ctrl+]</span>
                  </button>
                  <button onClick={handleSendBackward} className={item + ' text-gray-700 dark:text-gray-300'}>
                    Send backward <span className={shortcut}>Ctrl+[</span>
                  </button>
                  <button onClick={handleSendToBack} className={item + ' text-gray-700 dark:text-gray-300'}>
                    Send to back <span className={shortcut}>Ctrl+Shift+[</span>
                  </button>
                </>
              )}
            </>
          )}
          {!selectedIds.length && (
            <button onClick={handlePaste} className={item + ' text-gray-700 dark:text-gray-300'}>
              Paste <span className={shortcut}>Ctrl+V</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}
