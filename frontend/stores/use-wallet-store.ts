import { create } from "zustand";

interface WalletState {
  isDevnet: boolean;
  toggleNetwork: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  isDevnet: true,
  toggleNetwork: () => set((state) => ({ isDevnet: !state.isDevnet })),
}));
