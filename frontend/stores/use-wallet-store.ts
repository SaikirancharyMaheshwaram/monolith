import { asyncStorageAdapter } from "@/lib/storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// type AuthStatus = "public" | "connected" | "authenticated";
type AuthStatus = "public" | "connected" | "authenticated" | "onboarding";

interface WalletState {
  isDevnet: boolean;
  toggleNetwork: () => void;
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
  status: AuthStatus;
  setStatus: (s: AuthStatus) => void;

  publicKey: string | null;
  setPublicKey: (key: string | null) => void;
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
      version: 2,
      storage: createJSONStorage(() => asyncStorageAdapter),
      migrate: (persistedState) => {
        const state = persistedState as Partial<WalletState> & {
          publicKey?: unknown;
        };

        const nextPublicKey =
          typeof state.publicKey === "string" ? state.publicKey : null;

        return {
          ...state,
          publicKey: nextPublicKey,
        } as WalletState;
      },
    },
  ),
);
