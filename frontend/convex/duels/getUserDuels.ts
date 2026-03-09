import { query } from "../_generated/server";
import { v } from "convex/values";
import { enrichDuels } from "./helpers";

export const getUserDuels = query({
  args: {
    userId: v.id("users"),
  },

  handler: async (ctx, args) => {
    const duelsAsPlayer1 = await ctx.db
      .query("duels")
      .withIndex("by_player1", (q) => q.eq("player1", args.userId))
      .collect();

    const duelsAsPlayer2 = await ctx.db
      .query("duels")
      .withIndex("by_player2", (q) => q.eq("player2", args.userId))
      .collect();

    return enrichDuels(ctx, [...duelsAsPlayer1, ...duelsAsPlayer2]);
  },
});
