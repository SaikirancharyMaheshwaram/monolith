import { v } from "convex/values";
import { query } from "../_generated/server";

export const getDuelById = query({
  args: { id: v.id("duels") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("duels")
      .withIndex("by_id", (q) => q.eq("_id", args.id))
      .unique();
  },
});
