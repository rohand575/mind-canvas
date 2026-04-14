import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { LoginDialog } from './LoginDialog';
import { UserMenu } from './UserMenu';

export function LoginButton() {
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!initialized) return null;

  if (user) return <UserMenu />;

  return (
    <>
      <button
        onClick={() => setDialogOpen(true)}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white text-sm font-medium transition-all duration-150 shadow-lg shadow-indigo-500/30 active:scale-[0.96]"
      >
        Sign in
      </button>
      <LoginDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
