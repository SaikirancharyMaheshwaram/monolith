import { asyncStorageAdapter } from "@/lib/storage";
import { PublicKey } from "@solana/web3.js";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

type AuthStatus = "public" | "connected" | "authenticated";

interface WalletState {
  isDevnet: boolean;
  toggleNetwork: () => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  status: AuthStatus;
  setStatus: (s: AuthStatus) => void;

  publicKey: PublicKey | null;
  setPublicKey: (key: PublicKey | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      isDevnet: true,
      toggleNetwork: () => set((state) => ({ isDevnet: !state.isDevnet })),
      isAuthenticated: false,
      setAuthenticated: (value) => set({ isAuthenticated: value }),
      status: "public",
      setStatus: (s) => set({ status: s }),
      publicKey: null,
      setPublicKey: (key) => set({ publicKey: key }),
    }),

    {
      name: "wallet-storage",
      storage: createJSONStorage(() => asyncStorageAdapter),
    },
  ),
);
