import { query } from "../_generated/server";
import { v } from "convex/values";

export const getActiveDuels = query({
  args: {
    userId: v.id("users"),
  },

  handler: async (ctx, args) => {
    const duels1 = await ctx.db
      .query("duels")
      .withIndex("by_player1", (q) => q.eq("player1", args.userId))
      .collect();

    const duels2 = await ctx.db
      .query("duels")
      .withIndex("by_player2", (q) => q.eq("player2", args.userId))
      .collect();

    const all = [...duels1, ...duels2];

    return all.filter((d) => d.status === "ACTIVE");
  },
});