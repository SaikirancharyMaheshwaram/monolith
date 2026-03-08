import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    walletAddress: v.string(),
    username: v.string(),

    selectedCharacter: v.string(),

    unlockedCharacters: v.array(v.string()),
    ownedItems: v.array(v.string()),

    xp: v.number(),
    tier: v.string(),

    publicWins: v.number(),
    publicLosses: v.number(),

    totalWins: v.number(),
    totalLosses: v.number(),

    redemptionVaultBalance: v.number(),

    activeDuelCount: v.number(),

    createdAt: v.number(),
  })
    .index("by_wallet", ["walletAddress"])
    .index("by_username", ["username"]),

  duels: defineTable({
    mode: v.union(v.literal("PUBLIC"), v.literal("FRIEND")),

    player1: v.id("users"),
    player2: v.optional(v.id("users")),

    stakeAmount: v.number(),

    status: v.union(
      v.literal("CREATED"),
      v.literal("OPEN"),
      v.literal("ACTIVE"),
      v.literal("COMPLETED"),
      v.literal("RESOLVED"),
      v.literal("CANCELLED"),
    ),

    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),

    shieldPlayer1: v.boolean(),
    shieldPlayer2: v.boolean(),

    shieldUsedPlayer1: v.boolean(),
    shieldUsedPlayer2: v.boolean(),

    resolved: v.boolean(),

    winner: v.optional(v.id("users")),

    nonce: v.number(),
    onchainDuelAddress: v.optional(v.string()),
    onchainEscrowAddress: v.optional(v.string()),
    onchainProgramId: v.optional(v.string()),
    onchainTxSignature: v.optional(v.string()),
    onchainNonce: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_player1", ["player1"])
    .index("by_player2", ["player2"]),

  submissions: defineTable({
    duelId: v.id("duels"),
    player: v.id("users"),
    dayNumber: v.number(),
    timestamp: v.number(),
  }).index("by_duel_player_day", ["duelId", "player", "dayNumber"]),

  settlements: defineTable({
    duelId: v.id("duels"),
    payload: v.string(),
    payloadHash: v.string(),
    signature: v.string(),
    createdAt: v.number(),
  }).index("by_duel", ["duelId"]),
});
