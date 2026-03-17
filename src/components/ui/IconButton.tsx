interface IconButtonProps {
  active?: boolean;
  title?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}

export function IconButton({ active, title, onClick, children, className = '' }: IconButtonProps) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`
        flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150
        ${active
          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 shadow-sm'
          : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700/50'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}
