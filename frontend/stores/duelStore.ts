import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { convexClient } from "@/lib/convex-client";
import { create } from "zustand";

type DuelProgress = {
  player1: Id<"users">;
  player2?: Id<"users">;
  p1Days: number[];
  p2Days: number[];
};

type DuelMapEntry = {
  duel: Doc<"duels">;
  progress?: DuelProgress;
};

type DuelState = {
  activeDuels: Doc<"duels">[];
  duelMap: Record<string, DuelMapEntry>;
  selectedDuelId: Id<"duels"> | null;
  submissionLoading: boolean;
  resolveLoading: boolean;
  fetchActiveDuels: (userId: Id<"users">) => Promise<void>;
  refreshDuel: (duelId: Id<"duels">) => Promise<void>;
  submitCompletion: (duelId: Id<"duels">, playerId: Id<"users">) => Promise<void>;
  resolveDuel: (duelId: Id<"duels">) => Promise<void>;
  setSelectedDuelId: (duelId: Id<"duels"> | null) => void;
};

export const useDuelStore = create<DuelState>((set, get) => ({
  activeDuels: [],
  duelMap: {},
  selectedDuelId: null,
  submissionLoading: false,
  resolveLoading: false,

  fetchActiveDuels: async (userId) => {
    const duels = await convexClient.query(api.duels.getActiveDuels.getActiveDuels, {
      userId,
    });

    set((state) => ({
      ...state,
      activeDuels: duels,
      duelMap: duels.reduce<Record<string, DuelMapEntry>>((acc, duel) => {
        acc[duel._id] = { duel, progress: state.duelMap[duel._id]?.progress };
        return acc;
      }, {}),
      selectedDuelId: duels[0]?._id ?? null,
    }));

    if (duels[0]) {
      await get().refreshDuel(duels[0]._id);
    }
  },

  refreshDuel: async (duelId) => {
    const [duel, progress] = await Promise.all([
      convexClient.query(api.duels.getDuelById.getDuelById, { id: duelId }),
      convexClient.query(api.duels.getDuelProgress.getDuelProgress, { duelId }),
    ]);

    if (!duel) return;

    set((state) => ({
      ...state,
      duelMap: {
        ...state.duelMap,
        [duelId]: {
          duel,
          progress,
        },
      },
      activeDuels: state.activeDuels.map((d) => (d._id === duelId ? duel : d)),
    }));
  },

  submitCompletion: async (duelId, playerId) => {
    set((state) => ({ ...state, submissionLoading: true }));
    try {
      await convexClient.mutation(api.submissions.submitCompletion.submitCompletion, {
        duelId,
        player: playerId,
      });
      await get().refreshDuel(duelId);
    } finally {
      set((state) => ({ ...state, submissionLoading: false }));
    }
  },

  resolveDuel: async (duelId) => {
    set((state) => ({ ...state, resolveLoading: true }));
    try {
      await convexClient.mutation(api.duels.computeOutcome.computeOutcome, {
        duelId,
      });
      await get().refreshDuel(duelId);
    } finally {
      set((state) => ({ ...state, resolveLoading: false }));
    }
  },

  setSelectedDuelId: (duelId) => {
    set((state) => ({ ...state, selectedDuelId: duelId }));
  },
}));
