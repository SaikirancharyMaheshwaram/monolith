import { SystemProgram } from "@solana/web3.js";

export const DUEL_SEED = Buffer.from("duel");
export const ESCROW_SEED = Buffer.from("escrow");
export const CONFIG_SEED = Buffer.from("config");
export const MAX_DUEL_DURATION = 365 * 24 * 60 * 60;
export const SYSTEM_PROGRAM = SystemProgram.programId;
