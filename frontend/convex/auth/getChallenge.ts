// convex/auth/generateChallenge.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const generateChallenge = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const nonce = crypto.randomUUID();
    const message = `Sign in to MyApp\nWallet: ${walletAddress}\nNonce: ${nonce}`;

    // Store nonce temporarily (expire after 5 mins)
    await ctx.db.insert("authChallenges", {
      walletAddress,
      nonce,
      message,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return { message, nonce };
  },
});