import { mutation } from "../_generated/server";
import { v } from "convex/values";

import { sha256 } from "../lib/sha";
import { signHash } from "../lib/signPayload";

export const computeOutcome = mutation({
  args: {
    duelId: v.id("duels"),
  },

  handler: async (ctx, args) => {
    const now = Date.now();
    const duel = await ctx.db.get(args.duelId);

    if (!duel) throw new Error("Duel not found");

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

    if (duel.status !== "ACTIVE") throw new Error("Duel not active");

    if (duel.resolved) throw new Error("Duel already resolved");

    if (!duel.endTime || now < duel.endTime)
      throw new Error("Duel has not ended yet");

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

    // Outcome cases
    let outcome:
      | "PLAYER1_WIN"
      | "PLAYER2_WIN"
      | "DRAW_BOTH_SUCCESS"
      | "DRAW_BOTH_FAIL";

    if (p1Score === 0 && p2Score === 0) {
      outcome = "DRAW_BOTH_FAIL";
    } else if (p1Score > p2Score) {
      outcome = "PLAYER1_WIN";
    } else if (p2Score > p1Score) {
      outcome = "PLAYER2_WIN";
    } else {
      outcome = "DRAW_BOTH_SUCCESS";
    }

    const payload = {
      duelId: args.duelId,
      player1: duel.player1,
      player2: duel.player2,
      outcome,
      p1Score,
      p2Score,
      stakeAmount: duel.stakeAmount,
      nonce: duel.nonce,
    };

    const payloadString = JSON.stringify(payload);

    const payloadHash = await sha256(payloadString);

    const signature = signHash(payloadHash);

    await ctx.db.insert("settlements", {
      duelId: args.duelId,
      payloadHash,
      signature,
      payload: payloadString,
      createdAt: now,
    });

    const player1 = await ctx.db.get(duel.player1);
    const player2 = duel.player2 ? await ctx.db.get(duel.player2) : null;
    const winnerId =
      outcome === "PLAYER1_WIN"
        ? duel.player1
        : outcome === "PLAYER2_WIN"
          ? duel.player2
          : undefined;
    const loserVaultCredit =
      outcome === "PLAYER1_WIN" || outcome === "PLAYER2_WIN"
        ? duel.stakeAmount * 0.25
        : 0;

    if (player1 && player2) {
      if (outcome === "PLAYER1_WIN") {
        await ctx.db.patch(duel.player1, {
          totalWins: (player1.totalWins ?? 0) + 1,
          redemptionVaultLocked: false,
          redemptionVaultUnlockedAt: now,
        });
        await ctx.db.patch(duel.player2, {
          totalLosses: (player2.totalLosses ?? 0) + 1,
          redemptionVaultBalance:
            (player2.redemptionVaultBalance ?? 0) + loserVaultCredit,
          redemptionVaultLocked: true,
          redemptionVaultLockedAt: now,
        });
      } else if (outcome === "PLAYER2_WIN") {
        await ctx.db.patch(duel.player2, {
          totalWins: (player2.totalWins ?? 0) + 1,
          redemptionVaultLocked: false,
          redemptionVaultUnlockedAt: now,
        });
        await ctx.db.patch(duel.player1, {
          totalLosses: (player1.totalLosses ?? 0) + 1,
          redemptionVaultBalance:
            (player1.redemptionVaultBalance ?? 0) + loserVaultCredit,
          redemptionVaultLocked: true,
          redemptionVaultLockedAt: now,
        });
      }
    }

    await ctx.db.patch(args.duelId, {
      winner: winnerId,
      resolved: true,
      status: "COMPLETED",
    });

    return {
      payload,
      payloadHash,
      signature,
      payloadString,
    };
  },
});
