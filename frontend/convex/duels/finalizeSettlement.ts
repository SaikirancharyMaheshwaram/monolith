import { mutation } from "../_generated/server";
import { v } from "convex/values";


export const finalizeSettlement = mutation({
  args: {
    duelId: v.id("duels"),
    settlementTxSignature: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const duel = await ctx.db.get(args.duelId);
    if (!duel) throw new Error("Duel not found");
    if (duel.resolved) {
      return { success: true, alreadyResolved: true };
    }

    const player1 = await ctx.db.get(duel.player1);
    const player2 = duel.player2 ? await ctx.db.get(duel.player2) : null;
    if (!player1 || !player2) throw new Error("Participants not found");

    const submissions = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("duelId"), args.duelId))
      .collect();

    let p1Score = 0;
    let p2Score = 0;

    for (const submission of submissions) {
      if (submission.player === duel.player1) p1Score += 1;
      if (submission.player === duel.player2) p2Score += 1;
    }

    const winner =
      p1Score > p2Score
        ? duel.player1
        : p2Score > p1Score
          ? duel.player2
          : undefined;
    const loser =
      winner === duel.player1
        ? duel.player2
        : winner === duel.player2
          ? duel.player1
          : undefined;
    const loserVaultCredit = winner && loser ? duel.stakeAmount * 0.25 : 0;

    await ctx.db.patch(args.duelId, {
      winner,
      resolved: true,
      status: "RESOLVED",
    });

    if (winner === duel.player1) {
      await ctx.db.patch(duel.player1, {
        totalWins: (player1.totalWins ?? 0) + 1,
        redemptionVaultLocked: false,
        redemptionVaultUnlockedAt: now,
      });
      await ctx.db.patch(duel.player2!, {
        totalLosses: (player2.totalLosses ?? 0) + 1,
        redemptionVaultBalance:
          (player2.redemptionVaultBalance ?? 0) + loserVaultCredit,
        redemptionVaultLocked: true,
        redemptionVaultLockedAt: now,
      });
    } else if (winner === duel.player2) {
      await ctx.db.patch(duel.player2!, {
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

    const settlement = await ctx.db
      .query("settlements")
      .withIndex("by_duel", (q) => q.eq("duelId", args.duelId))
      .unique();

    if (settlement) {
      await ctx.db.patch(settlement._id, {
        payload: JSON.stringify({
          settlementTxSignature: args.settlementTxSignature,
          finalizedAt: now,
          loserVaultCredit,
          loser,
          previousPayload: settlement.payload,
        }),
      });
    }

    return {
      success: true,
      winnerWallet:
        winner === duel.player1
          ? player1.walletAddress
          : winner === duel.player2
            ? player2.walletAddress
            : null,
    };
  },
});
