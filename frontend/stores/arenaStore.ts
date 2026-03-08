import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { convexClient } from "@/lib/convex-client";
import { create } from "zustand";

type ArenaFilters = {
  minStake: number;
  maxStake: number;
  mode: "ALL" | "FRIEND";
};

type CreateDuelInput = {
  player1: string;
  stakeAmount: number;
  startTime: number;
};

type ArenaState = {
  openDuels: Doc<"duels">[];
  createLoading: boolean;
  joinLoading: boolean;
  filters: ArenaFilters;
  fetchOpenDuels: (userId: Id<"users">) => Promise<void>;
  createDuel: (input: CreateDuelInput) => Promise<Id<"duels">>;
  joinDuel: (duelId: Id<"duels">, player2: Id<"users">) => Promise<void>;
  cancelDuel: (duelId: Id<"duels">, caller: Id<"users">) => Promise<void>;
  setFilters: (filters: Partial<ArenaFilters>) => void;
  reset: () => void;
};

export const useArenaStore = create<ArenaState>((set, get) => ({
  openDuels: [],
  createLoading: false,
  joinLoading: false,
  filters: {
    minStake: 0,
    maxStake: 100,
    mode: "ALL",
  },

  // Note: backend currently exposes getScheduledDuels; we filter OPEN here for arena list.
  fetchOpenDuels: async (userId) => {
    const scheduled = await convexClient.query(api.duels.getScheduledDuels.getScheduledDuels, {
      userId,
    });

    const { minStake, maxStake } = get().filters;

    const open = scheduled.filter(
      (duel) =>
        duel.status === "OPEN" &&
        duel.stakeAmount >= minStake &&
        duel.stakeAmount <= maxStake,
    );

    set((state) => ({ ...state, openDuels: open }));
  },

  createDuel: async ({ player1, stakeAmount, startTime }) => {
    set((state) => ({ ...state, createLoading: true }));
    try {
      const duelId = await convexClient.mutation(api.duels.createFriendDuel.createFriendDuel, {
        player1,
        stakeAmount,
        startTime,
      });
      return duelId;
    } finally {
      set((state) => ({ ...state, createLoading: false }));
    }
  },

  joinDuel: async (duelId, player2) => {
    set((state) => ({ ...state, joinLoading: true }));
    try {
      await convexClient.mutation(api.duels.joinFriendDuel.joinFriendDuel, {
        duelId,
        player2,
      });
    } finally {
      set((state) => ({ ...state, joinLoading: false }));
    }
  },

  cancelDuel: async (duelId, caller) => {
    await convexClient.mutation(api.duels.cancelOpenDuel.cancelOpenDuel, {
      duelId,
      caller,
    });
  },

  setFilters: (filters) => {
    set((state) => ({
      ...state,
      filters: { ...state.filters, ...filters },
    }));
  },

  reset: () => {
    set((state) => ({
      ...state,
      openDuels: [],
      createLoading: false,
      joinLoading: false,
      filters: {
        minStake: 0,
        maxStake: 100,
        mode: "ALL",
      },
    }));
  },
}));
