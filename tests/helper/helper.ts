import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { DArena } from "../../target/types/d_arena";
import { CONFIG_SEED, DUEL_SEED, ESCROW_SEED } from "./constant";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { randomBytes } from "crypto";
import { expect } from "chai";

export async function airdropIfNeeded(
  connection: anchor.web3.Connection,
  pubkey: PublicKey,
  minBalance = 2 * LAMPORTS_PER_SOL
): Promise<void> {
  const balance = await connection.getBalance(pubkey);
  if (balance < minBalance) {
    const sig = await connection.requestAirdrop(pubkey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  }
}

export function getDuelPda(
  program: Program<DArena>,
  creator: PublicKey,
  nonce: BN
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [DUEL_SEED, creator.toBuffer(), nonce.toBuffer("le", 8)],
    program.programId
  );
}

export function getEscrowPda(
  program: Program<DArena>,
  duelPda: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ESCROW_SEED, duelPda.toBuffer()],
    program.programId
  );
}
export function getConfigPda(
  program: Program<DArena>,
  duelPda: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], program.programId);
}

export function getNonce(): anchor.BN {
  return new anchor.BN(randomBytes(8));
}

const SECONDS = 1;
const MINUTES = 60 * SECONDS;
const HOURS = 60 * MINUTES;
const DAYS = 24 * HOURS;

export const DURATIONS = {
  oneHour: 1 * HOURS,
  oneDay: 1 * DAYS,
  oneWeek: 7 * DAYS, // weekly streak window
  oneMonth: 30 * DAYS, // monthly streak window
  oneYear: 365 * DAYS, // yearly streak window (MAX_DUEL_DURATION)
} as const;

export function streakWindow(durationSeconds: number): {
  startTime: BN;
  endTime: BN;
} {
  const now = Math.floor(Date.now() / 1000);
  return {
    startTime: new BN(now + 60),
    endTime: new BN(now + 60 + durationSeconds),
  };
}

export const logTransactionResult = (label: string, txSignature: string) => {
  console.log(`\n${label}:`);
  console.log(`   Txn signature: ${txSignature}`);
};

export async function expectAnchorError(
  promise: Promise<any>,
  errorCode: string
): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected error "${errorCode}" but transaction succeeded`);
  } catch (err) {
    if (err instanceof anchor.AnchorError) {
      console.log(err.toString());
      expect(err.error.errorCode.code).to.equal(
        errorCode,
        `Expected "${errorCode}" but got "${err.error.errorCode.code}"`
      );
    } else {
      throw err;
    }
  }
}
