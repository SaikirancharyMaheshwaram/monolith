import { mutation } from "../_generated/server";
import { v } from "convex/values";

const JOIN_BUFFER = 5 * 60 * 1000; // 5 minutes

export const joinFriendDuel = mutation({
  args: {
    duelId: v.id("duels"),
    player2: v.id("users"),
  },

  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);

    if (!duel) {
      throw new Error("Duel not found");
    }

    if (duel.status !== "OPEN") {
      throw new Error("Duel already taken");
    }

    if (duel.player1 === args.player2) {
      throw new Error("Cannot join your own duel");
    }

    const now = Date.now();
    // const dateInUTC = new Date(now).getTime();
    // console.log({ now, dates });
    // console.log({ start: duel.startTime, sub: dateInUTC - duel.startTime });

    if (now >= duel.startTime! - JOIN_BUFFER) {
      throw new Error("Too late to join duel");
    }

    const player1 = await ctx.db.get(duel.player1);
    const player2 = await ctx.db.get(args.player2);

    if (!player1 || !player2) {
      throw new Error("Player not found");
    }

    if (player1.activeDuelCount >= 3 || player2.activeDuelCount >= 3) {
      throw new Error("Duel limit reached");
    }

    await ctx.db.patch(args.duelId, {
      player2: args.player2,
      status: "ACTIVE",
    });

    await ctx.db.patch(duel.player1, {
      activeDuelCount: player1.activeDuelCount + 1,
    });

    await ctx.db.patch(args.player2, {
      activeDuelCount: player2.activeDuelCount + 1,
    });

    return {
      success: true,
    };
  },
});
