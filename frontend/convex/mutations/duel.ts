// convex/mutations/createPublicDuel.ts

import { v } from "convex/values";
import { mutation } from "../_generated/server";

export const createPublicDuel = mutation({
  args: {
    userId: v.id("users"),
    stakeTier: v.number(),
    shieldSelected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    if (user.activeDuelCount >= 3)
      throw new Error("Max 3 active duels reached");

    const existingOpen = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "OPEN"))
      .filter((q) => q.eq(q.field("player1"), user.walletAddress))
      .first();

    if (existingOpen)
      throw new Error("Already have an open public duel");

    const duelId = await ctx.db.insert("duels", {
      mode: "PUBLIC",
      player1: user.walletAddress,
      player2: undefined,

      stakeTier: args.stakeTier,

      status: "OPEN",

      startTime: undefined,
      endTime: undefined,

      shieldPlayer1: args.shieldSelected,
      shieldPlayer2: false,

      shieldUsedPlayer1: false,
      shieldUsedPlayer2: false,

      winner: undefined,
      resolved: false,
      nonce: undefined,

      createdAt: Date.now(),
    });

    return duelId;
  },
});