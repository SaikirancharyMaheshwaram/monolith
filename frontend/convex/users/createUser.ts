import { mutation } from "../_generated/server";
import { v } from "convex/values";

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export const createUser = mutation({
  args: {
    walletAddress: v.string(),
    username: v.string(),
    selectedCharacter: v.string(),
  },

  handler: async (ctx, args) => {
    const normalizedUsername = normalizeUsername(args.username);

    // check wallet uniqueness
    const existingWallet = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) =>
        q.eq("walletAddress", args.walletAddress)
      )
      .first();

    if (existingWallet) {
      throw new Error("User already exists for this wallet");
    }

    // check username uniqueness
    const existingUsername = await ctx.db
      .query("users")
      .withIndex("by_username", (q) =>
        q.eq("username", normalizedUsername)
      )
      .first();

    if (existingUsername) {
      throw new Error("Username already taken");
    }

    const userId = await ctx.db.insert("users", {
      walletAddress: args.walletAddress,
      username: normalizedUsername,

      selectedCharacter: args.selectedCharacter,

      unlockedCharacters: [args.selectedCharacter],
      ownedItems: [],

      xp: 0,
      tier: "Initiate",

      publicWins: 0,
      publicLosses: 0,

      totalWins: 0,
      totalLosses: 0,

      redemptionVaultBalance: 0,
      redemptionVaultLocked: false,
      redemptionVaultLockedAt: undefined,
      redemptionVaultUnlockedAt: undefined,
      redemptionVaultRedeemedAt: undefined,
      redemptionVaultRedeemedTotal: 0,

      activeDuelCount: 0,

      createdAt: Date.now(),
    });

    return userId;
  },
});
