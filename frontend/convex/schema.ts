import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    walletAddress: v.string(),
    username: v.string(),
    createdAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),

  nonces: defineTable({
    walletAddress: v.string(),
    nonce: v.string(),
    createdAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),
});