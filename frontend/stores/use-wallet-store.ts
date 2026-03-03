import { asyncStorageAdapter } from "@/lib/storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface WalletState {
  isDevnet: boolean;
  toggleNetwork: () => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isDevnet: true,
      toggleNetwork: () => set((state) => ({ isDevnet: !state.isDevnet })),
      isAuthenticated: false,
      setAuthenticated: (value) => set({ isAuthenticated: value }),
    }),

    {
      name: "wallet-storage",
      storage: createJSONStorage(() => asyncStorageAdapter),
    },
  ),
);
