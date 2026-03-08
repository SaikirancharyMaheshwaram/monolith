import { mutation } from "../_generated/server";
import { v } from "convex/values";

const DAY_MS = 24 * 60 * 60 * 1000;
const DUEL_DAYS = 1;
const GRACE_WINDOW = 2 * 60 * 1000; // 2 minutes

export const submitCompletion = mutation({
  args: {
    duelId: v.id("duels"),
    // duelId: v.string(),
    player: v.id("users"),
  },

  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);

    // //
    // const duel = await ctx.db
    //   .query("duels")
    //   .withIndex("by_id", (q) => q.eq("_id", args.duelId))
    //   .unique();

    if (!duel) {
      throw new Error("Duel not found");
    }

    if (duel.status !== "ACTIVE") {
      throw new Error("Duel not active");
    }

    if (args.player !== duel.player1 && args.player !== duel.player2) {
      throw new Error("Player not part of duel");
    }

    const now = Date.now();

    if (now < duel.startTime!) {
      throw new Error("Duel has not started yet");
    }

    if (now >= duel.endTime! + GRACE_WINDOW) {
      throw new Error("Duel already finished");
    }

    // apply grace window
    const effectiveTime = now - GRACE_WINDOW;

    const dayNumber =
      Math.floor((effectiveTime - duel.startTime!) / DAY_MS) + 1;

    console.log({ dayNumber });

    if (dayNumber < 0 || dayNumber > DUEL_DAYS) {
      throw new Error("Invalid submission day");
    }

    const existing = await ctx.db
      .query("submissions")
      .withIndex("by_duel_player_day", (q) =>
        q
          .eq("duelId", args.duelId)
          .eq("player", args.player)
          .eq("dayNumber", dayNumber),
      )
      .unique();

    if (existing) {
      return {
        success: true,
        message: "Already submitted today",
        dayNumber,
      };
    }

    await ctx.db.insert("submissions", {
      duelId: args.duelId,
      player: args.player,
      dayNumber,
      timestamp: now,
    });

    return {
      success: true,
      dayNumber,
    };
  },
});
