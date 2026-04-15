import { useEffect, useRef } from 'react';

interface FindBarProps {
  query: string;
  currentIdx: number;
  totalMatches: number;
  onQueryChange: (q: string) => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function FindBar({ query, currentIdx, totalMatches, onQueryChange, onNext, onPrev, onClose }: FindBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input when the bar mounts
  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+F while in find bar — just re-select the input text
      e.preventDefault();
      inputRef.current?.select();
    }
  };

  const matchLabel = totalMatches === 0
    ? (query ? 'No results' : '')
    : `${currentIdx + 1} of ${totalMatches}`;

  return (
    <div
      data-find-bar
      className="absolute top-3 right-3 z-50 flex items-center gap-1 px-2 py-1.5 rounded-xl shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 ring-1 ring-black/5 dark:ring-white/10"
      style={{ minWidth: 260 }}
    >
      {/* Search icon */}
      <svg className="shrink-0 text-gray-400 dark:text-gray-500" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Find in text…"
        className="flex-1 bg-transparent outline-none text-sm text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 min-w-0"
        spellCheck={false}
        autoComplete="off"
      />

      {/* Match counter */}
      {query.length > 0 && (
        <span className={`text-xs shrink-0 px-1 tabular-nums ${totalMatches === 0 ? 'text-red-400 dark:text-red-400' : 'text-gray-400 dark:text-gray-400'}`}>
          {matchLabel}
        </span>
      )}

      {/* Prev button */}
      <button
        onMouseDown={(e) => e.preventDefault()} // keep focus in find bar
        onClick={onPrev}
        disabled={totalMatches === 0}
        title="Previous match (Shift+Enter)"
        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="18 15 12 9 6 15" />
        </svg>
      </button>

      {/* Next button */}
      <button
        onMouseDown={(e) => e.preventDefault()} // keep focus in find bar
        onClick={onNext}
        disabled={totalMatches === 0}
        title="Next match (Enter)"
        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-30 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Close button */}
      <button
        onMouseDown={(e) => e.preventDefault()} // keep focus in find bar
        onClick={onClose}
        title="Close (Escape)"
        className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
