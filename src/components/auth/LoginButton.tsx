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
        className="px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors duration-150 shadow-sm"
      >
        Sign in
      </button>
      <LoginDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </>
  );
}
