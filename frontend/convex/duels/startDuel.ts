import { mutation } from "../_generated/server";
import { v } from "convex/values";

const DUEL_DURATION = 7 * 24 * 60 * 60 * 1000;

export const startDuel = mutation({
  args: {
    duelId: v.id("duels"),
    caller: v.id("users"),
  },

  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);

    if (!duel) {
      throw new Error("Duel not found");
    }

    // Authorization check
    if (args.caller !== duel.player1 && args.caller !== duel.player2) {
      throw new Error("Unauthorized: not part of this duel");
    }

    if (duel.status !== "CREATED") {
      throw new Error("Duel cannot be started");
    }

    if (!duel.player2) {
      throw new Error("Second player missing");
    }

    const player1 = await ctx.db.get(duel.player1);
    const player2 = await ctx.db.get(duel.player2);

    if (!player1 || !player2) {
      throw new Error("Players not found");
    }

    if (player1.activeDuelCount >= 3 || player2.activeDuelCount >= 3) {
      throw new Error("Duel limit reached");
    }

    const now = Date.now();

    await ctx.db.patch(args.duelId, {
      status: "ACTIVE",
      startTime: now,
      endTime: now + DUEL_DURATION,
    });

    await ctx.db.patch(duel.player1, {
      activeDuelCount: player1.activeDuelCount + 1,
    });

    await ctx.db.patch(duel.player2, {
      activeDuelCount: player2.activeDuelCount + 1,
    });

    return {
      success: true,
      startTime: now,
      endTime: now + DUEL_DURATION,
    };
  },
});