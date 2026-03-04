// import { defineSchema, defineTable } from "convex/server";
// import { v } from "convex/values";

// export default defineSchema({
//   users: defineTable({
//     walletAddress: v.string(),
//     username: v.string(),
//     createdAt: v.number(),
//   }).index("by_wallet", ["walletAddress"]),

//   nonces: defineTable({
//     walletAddress: v.string(),
//     nonce: v.string(),
//     createdAt: v.number(),
//   }).index("by_wallet", ["walletAddress"]),
// });

// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    walletAddress: v.string(),
    username: v.string(),
    usernameLower: v.string(), // for case-insensitive uniqueness

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
    .index("by_usernameLower", ["usernameLower"]),

  duels: defineTable({
    duelId: v.string(),

    mode: v.union(v.literal("PUBLIC"), v.literal("FRIEND")),

    player1: v.string(),
    player2: v.optional(v.string()),

    stakeTier: v.number(),

    status: v.union(
      v.literal("CREATED"),
      v.literal("OPEN"),
      v.literal("ACTIVE"),
      v.literal("COMPLETED"),
      v.literal("SETTLEMENT_READY"),
      v.literal("RESOLVED"),
      v.literal("CANCELLED"),
    ),

    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),

    shieldPlayer1: v.boolean(),
    shieldPlayer2: v.boolean(),

    shieldUsedPlayer1: v.boolean(),
    shieldUsedPlayer2: v.boolean(),

    winner: v.optional(v.string()),

    resolved: v.boolean(),

    nonce: v.optional(v.string()),

    createdAt: v.number(),
  })
    .index("by_duelId", ["duelId"])
    .index("by_status", ["status"])
    .index("by_nonce", ["nonce"]),

  submissions: defineTable({
    duelId: v.string(),
    player: v.string(),
    dayNumber: v.number(),
    timestamp: v.number(),
  }).index("by_duel_player_day", ["duelId", "player", "dayNumber"]),

  nonces: defineTable({
    walletAddress: v.string(),
    nonce: v.string(),
    createdAt: v.number(),
  }).index("by_wallet", ["walletAddress"]),
});
