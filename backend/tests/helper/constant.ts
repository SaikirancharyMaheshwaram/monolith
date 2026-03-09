import { SystemProgram } from "@solana/web3.js";

export const DUEL_SEED = Buffer.from("duel");
export const ESCROW_SEED = Buffer.from("escrow");
export const CONFIG_SEED = Buffer.from("config");
export const MAX_DUEL_DURATION = 365 * 24 * 60 * 60;
export const SYSTEM_PROGRAM = SystemProgram.programId;
export const VAULT_SEED = Buffer.from("vault");

export const UserResultByte = {
  winner: 0,
  loser: 1,
  draw: 2,
  bothLost: 3,
} as const;

export const UserResult = {
  winner: { winner: {} },
  loser: { loser: {} },
  draw: { draw: {} },
  bothLost: { bothLost: {} },
} as const;
