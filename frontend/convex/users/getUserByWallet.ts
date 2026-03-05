import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserByWallet = query({
  args: {
    walletAddress: v.string(),
  },

  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    return user ?? null;
  },
});
