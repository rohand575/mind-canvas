import { create } from 'zustand';

interface AIStore {
  isOpen: boolean;
  apiKey: string;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  setApiKey: (key: string) => void;
}

const getStoredApiKey = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('openai-api-key') ?? '';
  }
  return '';
};

export const useAIStore = create<AIStore>((set) => ({
  isOpen: false,
  apiKey: getStoredApiKey(),
  toggleOpen: () => set((s) => ({ isOpen: !s.isOpen })),
  setOpen: (open) => set({ isOpen: open }),
  setApiKey: (key) => {
    localStorage.setItem('openai-api-key', key);
    set({ apiKey: key });
  },
}));
