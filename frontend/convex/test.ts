import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAuth } from "./lib/auth";

export const protectedTest = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const user = await requireAuth(args.token);

    return {
      message: "You are authenticated",
      userId: user.userId,
      wallet: user.walletAddress,
    };
  },
});