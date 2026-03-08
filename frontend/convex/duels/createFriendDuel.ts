import { mutation } from "../_generated/server";
import { v } from "convex/values";

const DEFAULT_DUEL_DURATION = 7 * 24 * 60 * 60 * 1000;

export const createFriendDuel = mutation({
  args: {
    player1: v.string(),
    stakeAmount: v.number(),
    startTime: v.number(),
    endTime: v.optional(v.number()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    onchainDuelAddress: v.optional(v.string()),
    onchainEscrowAddress: v.optional(v.string()),
    onchainProgramId: v.optional(v.string()),
    onchainTxSignature: v.optional(v.string()),
    onchainNonce: v.optional(v.string()),
  },

  handler: async (ctx, args) => {
    const {
      player1,
      stakeAmount,
      startTime,
      endTime,
      title,
      description,
      onchainDuelAddress,
      onchainEscrowAddress,
      onchainProgramId,
      onchainTxSignature,
      onchainNonce,
    } = args;

    const now = Date.now();
    const finalEndTime = endTime ?? startTime + DEFAULT_DUEL_DURATION;

    if (startTime <= now) {
      throw new Error("Start time must be in the future");
    }
    if (finalEndTime <= startTime) {
      throw new Error("End time must be after start time");
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
      title: title?.trim() || undefined,
      description: description?.trim() || undefined,

      player1: user._id,
      player2: undefined,

      stakeAmount,

      status: "OPEN",

      startTime,
      endTime: finalEndTime,

      shieldPlayer1: false,
      shieldPlayer2: false,

      shieldUsedPlayer1: false,
      shieldUsedPlayer2: false,

      resolved: false,

      winner: undefined,

      nonce: Date.now(),
      onchainDuelAddress,
      onchainEscrowAddress,
      onchainProgramId,
      onchainTxSignature,
      onchainNonce,

      createdAt: now,
    });

    return duelId;
  },
});
