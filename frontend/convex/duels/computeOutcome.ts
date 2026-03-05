import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const computeOutcome = mutation({
  args: {
    duelId: v.id("duels"),
  },

  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);

    if (!duel) throw new Error("Duel not found");

    // Prevent duplicate settlement payloads
    const existingSettlement = await ctx.db
      .query("settlements")
      .withIndex("by_duel", (q) => q.eq("duelId", args.duelId))
      .unique();

    if (existingSettlement) {
      return {
        message: "Settlement already computed",
        duelId: args.duelId,
      };
    }

    if (duel.status !== "ACTIVE")
      throw new Error("Duel not active");

    if (duel.resolved)
      throw new Error("Duel already resolved");

    const now = Date.now();

    if (now < duel.endTime)
      throw new Error("Duel has not ended yet");

    // Collect submissions
    const submissions = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("duelId"), args.duelId))
      .collect();

    let p1Score = 0;
    let p2Score = 0;

    for (const s of submissions) {
      if (s.player === duel.player1) p1Score++;
      if (s.player === duel.player2) p2Score++;
    }

    // Determine outcome
    let outcome: "PLAYER1_WIN" | "PLAYER2_WIN" | "DRAW";

    if (p1Score > p2Score) {
      outcome = "PLAYER1_WIN";
    } else if (p2Score > p1Score) {
      outcome = "PLAYER2_WIN";
    } else {
      outcome = "DRAW";
    }

    // Settlement payload (no money math)
    const payload = {
      duelId: args.duelId,
      player1: duel.player1,
      player2: duel.player2,
      outcome,
      p1Score,
      p2Score,
      nonce: duel.nonce,
    };

    // In production you would hash + sign this payload
    const payloadHash = JSON.stringify(payload);
    const signature = "backend_signature_placeholder";

    await ctx.db.insert("settlements", {
      duelId: args.duelId,
      payloadHash,
      signature,
      createdAt: now,
    });

    await ctx.db.patch(args.duelId, {
      winner:
        outcome === "PLAYER1_WIN"
          ? duel.player1
          : outcome === "PLAYER2_WIN"
          ? duel.player2
          : undefined,
      resolved: true,
      status: "COMPLETED",
    });

    return {
      payload,
      signature,
    };
  },
});