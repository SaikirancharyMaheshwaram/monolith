import { mutation } from "./_generated/server";
import { v } from "convex/values";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { SignJWT } from "jose";

export const requestNonce = mutation({
  args: { walletAddress: v.string() },
  handler: async (ctx, { walletAddress }) => {
    const nonce = crypto.randomUUID();

    const existing = await ctx.db
      .query("nonces")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", walletAddress))
      .collect();

    for (const r of existing) {
      await ctx.db.delete(r._id);
    }

    await ctx.db.insert("nonces", {
      walletAddress,
      nonce,
      createdAt: Date.now(),
    });

    return nonce;
  },
});

export const verifyWallet = mutation({
  args: {
    walletAddress: v.string(),
    signature: v.string(),
    nonce: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("nonces")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!record) throw new Error("Nonce not found");
    if (record.nonce !== args.nonce) throw new Error("Invalid nonce");

    const message = new TextEncoder().encode(args.nonce);
    const signatureBytes = bs58.decode(args.signature);
    const publicKeyBytes = bs58.decode(args.walletAddress);

    const isValid = nacl.sign.detached.verify(
      message,
      signatureBytes,
      publicKeyBytes,
    );

    if (!isValid) throw new Error("Invalid signature");

    await ctx.db.delete(record._id);

    let user = await ctx.db
      .query("users")
      .withIndex("by_wallet", (q) => q.eq("walletAddress", args.walletAddress))
      .first();

    if (!user) {
      const id = await ctx.db.insert("users", {
        walletAddress: args.walletAddress,
        username: "New Hunter",
        createdAt: Date.now(),
      });
      user = await ctx.db.get(id);
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

    const token = await new SignJWT({
      userId: user!._id,
      walletAddress: user!.walletAddress,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    return { token };
  },
});
