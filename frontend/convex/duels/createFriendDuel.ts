import { mutation } from "../_generated/server";
import { v } from "convex/values";

const DUEL_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export const createFriendDuel = mutation({
  args: {
    player1: v.string(),
    stakeAmount: v.number(),
    startTime: v.number(),
  },

  handler: async (ctx, args) => {
    const { player1, stakeAmount, startTime } = args;

    const now = Date.now();
    const newDate = new Date(startTime);

    console.log({ now, newDate: newDate.getUTCDate });

    if (startTime <= now) {
      throw new Error("Start time must be in the future");
    }

    // const user = await ctx.db.get(player1);
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", player1))
      .unique();

    if (!user) throw new Error("User not found");

    if (!user) {
      throw new Error("Player not found");
    }

    if (user.activeDuelCount >= 3) {
      throw new Error("Max duel limit reached");
    }

    const duelId = await ctx.db.insert("duels", {
      mode: "FRIEND",

      player1: user._id,
      player2: undefined,

      stakeAmount,

      status: "OPEN",

      startTime,
      endTime: startTime + DUEL_DURATION,

      shieldPlayer1: false,
      shieldPlayer2: false,

      shieldUsedPlayer1: false,
      shieldUsedPlayer2: false,

      resolved: false,

      winner: undefined,

      nonce: Date.now(),

      createdAt: now,
    });

    return duelId;
  },
});
