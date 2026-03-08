import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const cancelOpenDuel = mutation({
  args: {
    duelId: v.id("duels"),
    caller: v.id("users"),
  },

  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);

    if (!duel) {
      throw new Error("Duel not found");
    }

    if (duel.status !== "OPEN") {
      throw new Error("Duel cannot be cancelled");
    }

    if (duel.player1 !== args.caller) {
      throw new Error("Only creator can cancel duel");
    }

    if (duel.player2) {
      throw new Error("Opponent already joined");
    }

    const now = Date.now();

    if (now < duel.startTime!) {
      throw new Error("Cannot cancel before start time");
    }

    await ctx.db.patch(args.duelId, {
      status: "CANCELLED",
    });

    return {
      success: true,
      message: "Duel cancelled. Player can withdraw stake.",
    };
  },
});
