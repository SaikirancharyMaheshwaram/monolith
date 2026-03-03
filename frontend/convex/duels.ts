import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const createDuel = mutation({
  args: {
    token: v.string(),
    opponentWallet: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(args.token);

    const userId = user.userId;

    return { message: "Authorized", userId };
  },
});
