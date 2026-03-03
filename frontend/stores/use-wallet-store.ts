import { asyncStorageAdapter } from "@/lib/storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface WalletState {
  isDevnet: boolean;
  toggleNetwork: () => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isDevnet: true,
      toggleNetwork: () => set((state) => ({ isDevnet: !state.isDevnet })),
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => asyncStorageAdapter),
    },
  ),
);
