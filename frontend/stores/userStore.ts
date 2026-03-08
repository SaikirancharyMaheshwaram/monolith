import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { convexClient } from "@/lib/convex-client";
import { create } from "zustand";

type CreateUserInput = {
  walletAddress: string;
  username: string;
  selectedCharacter: string;
};

type UserState = {
  user: Doc<"users"> | null;
  walletAddress: string | null;
  username: string;
  tier: string;
  xp: number;
  vaultBalance: number;
  vaultLocked: boolean;
  vaultRedeemedTotal: number;
  vaultUnlockedAt: number | null;
  vaultLockedAt: number | null;
  loading: boolean;
  fetchUser: (wallet: string) => Promise<Doc<"users"> | null>;
  createUser: (input: CreateUserInput) => Promise<void>;
  refreshProfile: () => Promise<void>;
};

function patchFromUser(set: (fn: (state: UserState) => Partial<UserState>) => void, user: Doc<"users"> | null) {
  set((state) => ({
    ...state,
    user,
    username: user?.username ?? "",
    tier: user?.tier ?? "",
    xp: user?.xp ?? 0,
    vaultBalance: user?.redemptionVaultBalance ?? 0,
    vaultLocked: user?.redemptionVaultLocked ?? false,
    vaultRedeemedTotal: user?.redemptionVaultRedeemedTotal ?? 0,
    vaultUnlockedAt: user?.redemptionVaultUnlockedAt ?? null,
    vaultLockedAt: user?.redemptionVaultLockedAt ?? null,
  }));
}

export const useUserStore = create<UserState>((set, get) => ({
  user: null,
  walletAddress: null,
  username: "",
  tier: "",
  xp: 0,
  vaultBalance: 0,
  vaultLocked: false,
  vaultRedeemedTotal: 0,
  vaultUnlockedAt: null,
  vaultLockedAt: null,
  loading: false,

  fetchUser: async (wallet) => {
    if (!wallet) {
      patchFromUser(set, null);
      set((state) => ({ ...state, walletAddress: null, loading: false }));
      return null;
    }

    set((state) => ({ ...state, loading: true, walletAddress: wallet }));

    try {
      const user = await convexClient.query(api.users.getUserByWallet.getUserByWallet, {
        walletAddress: wallet,
      });
      patchFromUser(set, user);
      return user;
    } finally {
      set((state) => ({ ...state, loading: false }));
    }
  },

  createUser: async (input) => {
    set((state) => ({ ...state, loading: true }));

    try {
      await convexClient.mutation(api.users.createUser.createUser, input);
      const user = await convexClient.query(api.users.getUserByWallet.getUserByWallet, {
        walletAddress: input.walletAddress,
      });
      patchFromUser(set, user);
      set((state) => ({ ...state, walletAddress: input.walletAddress }));
    } finally {
      set((state) => ({ ...state, loading: false }));
    }
  },

  refreshProfile: async () => {
    const wallet = get().walletAddress;
    if (!wallet) return;
    await get().fetchUser(wallet);
  },
}));
