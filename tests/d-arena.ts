import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DArena } from "../target/types/d_arena";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  airdropIfNeeded,
  DURATIONS,
  getDuelPda,
  getEscrowPda,
  getNonce,
  logTransactionResult,
  streakWindow,
} from "./helper/helper";
import { SYSTEM_PROGRAM } from "./helper/constant";
import { expect } from "chai";

describe("d-arena", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.dArena as Program<DArena>;
  const conn = provider.connection;

  // Wallets
  const creator = Keypair.generate();
  const opponent = Keypair.generate();

  // Shared state across tests
  let duelPda: PublicKey;
  let escrowPda: PublicKey;
  const duelNonce = new anchor.BN(1);
  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

  // Timestamps
  const now = Math.floor(Date.now() / 1000);
  const { startTime, endTime } = streakWindow(DURATIONS.oneWeek);

  before(async () => {
    console.log(" Program :", program.programId.toBase58());

    await airdropIfNeeded(conn, creator.publicKey, 0.01 * LAMPORTS_PER_SOL);
    await airdropIfNeeded(conn, opponent.publicKey, 0.02 * LAMPORTS_PER_SOL);

    [duelPda] = getDuelPda(program, creator.publicKey, duelNonce);
    [escrowPda] = getEscrowPda(program, duelPda);

    console.log("  Creator  :", creator.publicKey.toBase58());
    console.log("  Opponent :", opponent.publicKey.toBase58());
    console.log("  Duel PDA :", duelPda.toBase58());
    console.log("  Escrow   :", escrowPda.toBase58(), "\n");
  });

  it("  Creates a 7-day duel", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);

    const { startTime: start, endTime: end } = streakWindow(DURATIONS.oneWeek);

    const tx = await program.methods
      .createDuel(nonce, stakeAmount, start, end)
      .accounts({
        creator: creator.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([creator])
      .rpc({ commitment: "confirmed" });

    const duel = await program.account.duel.fetch(duelPda);
    const escrowInfo = await conn.getAccountInfo(escrowPda);
    const rentMin = await conn.getMinimumBalanceForRentExemption(0);
    const duration = duel.endTs.sub(duel.startTs).toNumber();

    expect(duel.endTs.toString()).to.equal(end.toString(), "end_ts mismatch");

    expect(duration).to.be.at.least(
      DURATIONS.oneWeek - 1,
      "duration should be at least 7 days"
    );

    const escrowBalance = await conn.getBalance(escrowPda);
    expect(escrowBalance).to.be.at.least(
      rentMin,
      "escrow is NOT rent-exempt will be garbage collected for long duels!"
    );
    expect(escrowInfo).to.not.be.null;
    expect(escrowInfo!.owner.toBase58()).to.equal(
      SYSTEM_PROGRAM.toBase58(),
      "escrow owner should be the program"
    );
    expect(escrowInfo!.data.length).to.equal(0, "escrow should have 0 bytes");
    expect(escrowBalance).to.be.at.least(
      stakeAmount.toNumber(),
      "escrow missing stake lamports"
    );

    logTransactionResult(
      `  7-day duel | duration: ${duration / DURATIONS.oneDay} days`,
      tx
    );
  });
});
