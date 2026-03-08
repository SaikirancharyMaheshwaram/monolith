// convex/auth/verifyAndAuth.ts
import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { PublicKey } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

export const verifyAndAuth = mutation({
  args: {
    walletAddress: v.string(),
    signature: v.string(), // bs58-encoded
  },
  handler: async (ctx, { walletAddress, signature }) => {
    // 1. Find the challenge
    const challenge = await ctx.db
      .query("authChallenges")
      .withIndex("by_wallet", q => q.eq("walletAddress", walletAddress))
      .first();

    if (!challenge) throw new Error("No challenge found. Request a new one.");
    if (challenge.expiresAt < Date.now()) {
      await ctx.db.delete(challenge._id);
      throw new Error("Challenge expired. Request a new one.");
    }

    // 2. Rebuild the exact message that was signed
    const message = `Sign in to Orange Arena\nWallet: ${walletAddress}\nNonce: ${challenge.nonce}`;

    // 3. Verify the ed25519 signature
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = new PublicKey(walletAddress).toBytes();

    const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    if (!isValid) throw new Error("Invalid signature.");

    // 4. Delete used challenge (one-time use)
    await ctx.db.delete(challenge._id);

    // 5. Check if user exists
    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_wallet", q => q.eq("walletAddress", walletAddress))
      .first();

    // 6. Issue session token
    const sessionToken = crypto.randomUUID();
    await ctx.db.insert("sessions", {
      walletAddress,
      token: sessionToken,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return {
      sessionToken,
      isNewUser: !existingUser,
    };
  },
});