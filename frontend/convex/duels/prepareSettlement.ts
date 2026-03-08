import { mutation } from "../_generated/server";
import { v } from "convex/values";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Buffer } from "buffer";

const RESULT_MAP = {
  winner: 0,
  loser: 1,
  draw: 2,
  bothLost: 3,
} as const;

function writeUInt64LE(value: number) {
  const buffer = Buffer.alloc(8);
  let remainder = Math.floor(value);

  for (let i = 0; i < 8; i += 1) {
    buffer[i] = remainder & 0xff;
    remainder = Math.floor(remainder / 256);
  }

  return buffer;
}

function buildSettlementMessage(
  onchainDuelId: number,
  callerWallet: string,
  resultByte: number,
  settlementNonce: number,
) {
  return Buffer.concat([
    writeUInt64LE(onchainDuelId),
    bs58.decode(callerWallet),
    Buffer.from([resultByte]),
    writeUInt64LE(settlementNonce),
  ]);
}

export const prepareSettlement = mutation({
  args: {
    duelId: v.id("duels"),
    callerWallet: v.string(),
    onchainDuelId: v.number(),
    settlementNonce: v.number(),
  },
  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);
    if (!duel) throw new Error("Duel not found");
    if (duel.status !== "ACTIVE") throw new Error("Duel not active");
    if (duel.resolved) throw new Error("Duel already resolved");
    if (!duel.endTime || Date.now() < duel.endTime) {
      throw new Error("Duel has not ended yet");
    }

    const player1 = await ctx.db.get(duel.player1);
    const player2 = duel.player2 ? await ctx.db.get(duel.player2) : null;

    if (!player1 || !player2) throw new Error("Participants not found");

    if (
      args.callerWallet !== player1.walletAddress &&
      args.callerWallet !== player2.walletAddress
    ) {
      throw new Error("Caller is not a duel participant");
    }

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

    let outcome:
      | "PLAYER1_WIN"
      | "PLAYER2_WIN"
      | "DRAW_BOTH_SUCCESS"
      | "DRAW_BOTH_FAIL";
    let winnerWallet: string | null = null;
    let resultKey: keyof typeof RESULT_MAP;

    if (p1Score === 0 && p2Score === 0) {
      outcome = "DRAW_BOTH_FAIL";
      resultKey = "bothLost";
    } else if (p1Score > p2Score) {
      outcome = "PLAYER1_WIN";
      winnerWallet = player1.walletAddress;
      resultKey =
        args.callerWallet === player1.walletAddress ? "winner" : "loser";
    } else if (p2Score > p1Score) {
      outcome = "PLAYER2_WIN";
      winnerWallet = player2.walletAddress;
      resultKey =
        args.callerWallet === player2.walletAddress ? "winner" : "loser";
    } else {
      outcome = "DRAW_BOTH_SUCCESS";
      resultKey = "draw";
    }

    const resultByte = RESULT_MAP[resultKey];
    const message = buildSettlementMessage(
      args.onchainDuelId,
      args.callerWallet,
      resultByte,
      args.settlementNonce,
    );

    const secret = process.env.BACKEND_SIGNER_SECRET_KEY;
    if (!secret) throw new Error("Missing BACKEND_SIGNER_SECRET_KEY");

    const secretKey = bs58.decode(secret);
    const signature = nacl.sign.detached(message, secretKey);
    const payload = JSON.stringify({
      duelId: args.duelId,
      callerWallet: args.callerWallet,
      onchainDuelId: args.onchainDuelId,
      settlementNonce: args.settlementNonce,
      outcome,
      resultKey,
      resultByte,
      winnerWallet,
      p1Score,
      p2Score,
    });

    const existingSettlement = await ctx.db
      .query("settlements")
      .withIndex("by_duel", (q) => q.eq("duelId", args.duelId))
      .unique();

    if (existingSettlement) {
      await ctx.db.patch(existingSettlement._id, {
        payload,
        payloadHash: bs58.encode(message),
        signature: bs58.encode(signature),
        createdAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settlements", {
        duelId: args.duelId,
        payload,
        payloadHash: bs58.encode(message),
        signature: bs58.encode(signature),
        createdAt: Date.now(),
      });
    }

    return {
      outcome,
      resultKey,
      resultByte,
      winnerWallet,
      callerWallet: args.callerWallet,
      message: bs58.encode(message),
      signature: bs58.encode(signature),
    };
  },
});
