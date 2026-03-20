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
        flex items-center justify-center w-11 h-11 rounded-xl transition-all duration-200
        ${active
          ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 shadow-md shadow-indigo-500/20'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700/60 dark:hover:text-gray-200'
        }
        ${className}
      `}
    >
      {children}
    </button>
  );
}
