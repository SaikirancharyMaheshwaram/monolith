import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DArena } from "../target/types/d_arena";
import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  airdropIfNeeded,
  DURATIONS,
  expectAnchorError,
  getConfigPda,
  getDuelPda,
  getEscrowPda,
  getNonce,
  logTransactionResult,
  streakWindow,
} from "./helper/helper";
import { SYSTEM_PROGRAM } from "./helper/constant";
import { expect } from "chai";

describe("createDuel", () => {
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
  let programDataAddress: PublicKey;
  let configPda: PublicKey;
  const duelNonce = new anchor.BN(1);
  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);
  const serverKP = Keypair.generate();
  const treasury = new PublicKey("treynHHxg2ftG3Hzn5dypVZX593Yss6uU54puVE614D");
  // Timestamps
  const now = Math.floor(Date.now() / 1000);
  const { startTime, endTime } = streakWindow(DURATIONS.oneWeek);

  before(async () => {
    console.log(" Program :", program.programId.toBase58());

    await airdropIfNeeded(conn, creator.publicKey, 0.01 * LAMPORTS_PER_SOL);
    await airdropIfNeeded(conn, opponent.publicKey, 0.02 * LAMPORTS_PER_SOL);

    [duelPda] = getDuelPda(program, creator.publicKey, duelNonce);

    [escrowPda] = getEscrowPda(program, duelPda);
    [configPda] = getConfigPda(program, duelPda);

    [programDataAddress] = PublicKey.findProgramAddressSync(
      [program.programId.toBytes()],
      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111") // BPF loader
    );
    console.log("  Creator  :", creator.publicKey.toBase58());
    console.log("  Opponent :", opponent.publicKey.toBase58());
    console.log("  Duel PDA :", duelPda.toBase58());
    console.log("  Escrow   :", escrowPda.toBase58(), "\n");
  });

  it("Fails when non-upgrade-authority tries to initialize", async () => {
    const notOwner = Keypair.generate();
    await airdropIfNeeded(conn, notOwner.publicKey, 2 * LAMPORTS_PER_SOL);

    const [programDataAddress] = PublicKey.findProgramAddressSync(
      [program.programId.toBytes()],
      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
    );

    await expectAnchorError(
      program.methods
        .initialzeConfig(
          Array.from(serverKP.publicKey.toBytes()),
          treasury,
          500
        )
        .accounts({
          admin: notOwner.publicKey, // NOT upgrade authority
          config: configPda,
          systemProgram: SYSTEM_PROGRAM,
          thisProgram: program.programId,
          programData: programDataAddress,
        })
        .signers([notOwner])
        .rpc(),
      "UpgradeAuthorityMismatch"
    );
  });

  it("Initializes config — only upgrade authority", async () => {
    const tx = await program.methods
      .initialzeConfig(
        Array.from(serverKP.publicKey.toBytes()),
        treasury,
        500 // 5% fee
      )
      .accounts({
        admin: provider.wallet.publicKey, // must be upgrade authority
        config: configPda,
        systemProgram: SYSTEM_PROGRAM,
        thisProgram: program.programId,
        programData: programDataAddress,
      })
      .rpc({ commitment: "confirmed" });

    const config = await program.account.config.fetch(configPda);
    expect(config.admin.toBase58()).to.equal(
      provider.wallet.publicKey.toBase58()
    );

    logTransactionResult("initialize config", tx);
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

  it("  Creates a 30-day (monthly streak)  duel", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);

    const { startTime: start, endTime: end } = streakWindow(DURATIONS.oneMonth);

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
      DURATIONS.oneMonth,
      "duration should be 30 days"
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
      `  30-day duel | duration: ${duration / DURATIONS.oneDay} days`,
      tx
    );
  });

  it("  Creates a 365-day (max duration) duel", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);

    const { startTime: start, endTime: end } = streakWindow(DURATIONS.oneYear);

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
      DURATIONS.oneMonth,
      "duration should be 365 days"
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
      `  365-days duel | duration: ${duration / DURATIONS.oneYear} days`,
      tx
    );
  });

  it("Fails when stake_amount is 0", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime: start, endTime: end } = streakWindow(DURATIONS.oneWeek);

    await expectAnchorError(
      program.methods
        .createDuel(nonce, new anchor.BN(0), start, end)
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "StakeTooSmall"
    );
  });
  it("Fails when duration is 1 hour", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime: start, endTime: end } = streakWindow(DURATIONS.oneHour);

    await expectAnchorError(
      program.methods
        .createDuel(nonce, stakeAmount, start, end)
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "DurationTooShort"
    );
  });
  it("Fails when duration exceeds 365 days", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime: start, endTime: end } = streakWindow(
      DURATIONS.oneYear + 1
    );

    await expectAnchorError(
      program.methods
        .createDuel(nonce, stakeAmount, start, end)
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "DurationTooLong"
    );
  });

  it("Fails when end_time <= start_time", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime: start, endTime: end } = streakWindow(DURATIONS.oneWeek);

    await expectAnchorError(
      program.methods
        .createDuel(nonce, stakeAmount, end, start) // swapped
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "InvalidTimeRange"
    );
  });
});
describe("joinDuel", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.dArena as Program<DArena>;
  const conn = provider.connection;

  const creator = Keypair.generate();
  const opponent = Keypair.generate();

  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

  before(async () => {
    console.log("  Program :", program.programId.toBase58());

    await airdropIfNeeded(conn, creator.publicKey, 5 * LAMPORTS_PER_SOL);
    await airdropIfNeeded(conn, opponent.publicKey, 5 * LAMPORTS_PER_SOL);
  });

  async function createFreshDuel(
    staker = creator,
    stake = stakeAmount,
    duration = DURATIONS.oneWeek
  ): Promise<{
    duelPda: PublicKey;
    escrowPda: PublicKey;
    nonce: anchor.BN;
  }> {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, staker.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime, endTime } = streakWindow(duration);

    await program.methods
      .createDuel(nonce, stake, startTime, endTime)
      .accounts({
        creator: staker.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([staker])
      .rpc({ commitment: "confirmed" });

    return { duelPda, escrowPda, nonce };
  }

  it("Opponent joins duel — state transitions to Active", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    const escrowBefore = await conn.getBalance(escrowPda);
    const opponentBefore = await conn.getBalance(opponent.publicKey);

    const tx = await program.methods
      .joinDuel()
      .accounts({
        opponent: opponent.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([opponent])
      .rpc({ commitment: "confirmed" });

    logTransactionResult("joined week duel", tx);

    const duel = await program.account.duel.fetch(duelPda);
    const escrowAfter = await conn.getBalance(escrowPda);

    //  Duel state
    expect(duel.status.active).to.not.be.undefined;
    expect(duel.opponent).to.not.be.null;
    expect(duel.opponent!.toBase58()).to.equal(
      opponent.publicKey.toBase58(),
      "opponent pubkey mismatch"
    );

    //  Escrow received exact stake
    expect(escrowAfter - escrowBefore).to.equal(
      stakeAmount.toNumber(),
      "escrow should have increased by exactly one stake"
    );

    // Escrow holds exactly 2x stake
    expect(escrowAfter).to.be.at.least(
      stakeAmount.toNumber() * 2,
      "escrow should hold 2x stake after both players joined"
    );

    console.log(`  escrow total  : ${escrowAfter / LAMPORTS_PER_SOL} SOL`);
  });

  it("Opponent joins a 30-day duel", async () => {
    const { duelPda, escrowPda } = await createFreshDuel(
      creator,
      stakeAmount,
      DURATIONS.oneMonth
    );

    const tx = await program.methods
      .joinDuel()
      .accounts({
        opponent: opponent.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([opponent])
      .rpc({ commitment: "confirmed" });

    const duel = await program.account.duel.fetch(duelPda);
    expect(duel.status.active).to.not.be.undefined;
    expect(duel.opponent!.toBase58()).to.equal(opponent.publicKey.toBase58());
    logTransactionResult("30-day duel joined", tx);
  });

  it("Fails when creator joins own duel", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    await expectAnchorError(
      program.methods
        .joinDuel()
        .accounts({
          opponent: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "CannotJoinOwnDuel"
    );
  });

  it("Fails when duel already has opponent (AlreadyJoined)", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    await program.methods
      .joinDuel()
      .accounts({
        opponent: opponent.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([opponent])
      .rpc({ commitment: "confirmed" });

    const thirdParty = Keypair.generate();
    await airdropIfNeeded(conn, thirdParty.publicKey, 2 * LAMPORTS_PER_SOL);

    await expectAnchorError(
      program.methods
        .joinDuel()
        .accounts({
          opponent: thirdParty.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([thirdParty])
        .rpc(),
      "AlreadyJoined"
    );
  });
});

describe("cancelDuel", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.dArena as Program<DArena>;
  const conn = provider.connection;

  const creator = Keypair.generate();
  const opponent = Keypair.generate();

  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

  before(async () => {
    await airdropIfNeeded(conn, creator.publicKey, 5 * LAMPORTS_PER_SOL);
    await airdropIfNeeded(conn, opponent.publicKey, 5 * LAMPORTS_PER_SOL);
  });

  async function createFreshDuel(
    staker = creator,
    stake = stakeAmount,
    duration = DURATIONS.oneWeek
  ): Promise<{ duelPda: PublicKey; escrowPda: PublicKey }> {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, staker.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime, endTime } = streakWindow(duration);

    await program.methods
      .createDuel(nonce, stake, startTime, endTime)
      .accounts({
        creator: staker.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([staker])
      .rpc({ commitment: "confirmed" });

    return { duelPda, escrowPda };
  }

  it("Creator cancels after start_ts — receives full refund", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);

    const now = Math.floor(Date.now() / 1000);
    const startTime = new anchor.BN(now - 10); // start_ts in the past
    const endTime = new anchor.BN(now + DURATIONS.oneWeek); // valid end_ts

    await new Promise((r) => setTimeout(r, 4000));

    await program.methods
      .createDuel(nonce, stakeAmount, startTime, endTime)
      .accounts({
        creator: creator.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([creator])
      .rpc({ commitment: "confirmed" });

    const escrowBefore = await conn.getBalance(escrowPda);

    const tx = await program.methods
      .cancelDuel()
      .accounts({
        creator: creator.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([creator])
      .rpc({ commitment: "confirmed" });

    const duel = await program.account.duel.fetch(duelPda);
    const escrowAfter = await conn.getBalance(escrowPda);

    expect(duel.status.cancelled).to.not.be.undefined;

    expect(escrowAfter).to.equal(
      escrowBefore - stakeAmount.toNumber(),
      "escrow should have lost exactly the stake amount"
    );

    logTransactionResult("cancel duel — full refund", tx);
    console.log(`  refund: ${stakeAmount.toNumber() / LAMPORTS_PER_SOL} SOL`);
  });

  it("Fails when cancelling too early (before start_ts)", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    await expectAnchorError(
      program.methods
        .cancelDuel()
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "CancelTooEarly"
    );
  });

  it("Fails when duel is already Active (opponent joined)", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    // Opponent joins → Active
    await program.methods
      .joinDuel()
      .accounts({
        opponent: opponent.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([opponent])
      .rpc({ commitment: "confirmed" });

    await expectAnchorError(
      program.methods
        .cancelDuel()
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "NotPending"
    );
  });

  it(" Fails when non-creator tries to cancel", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);

    const now = Math.floor(Date.now() / 1000);
    const startTime = new anchor.BN(now - 10);
    const endTime = new anchor.BN(now + DURATIONS.oneWeek);

    await program.methods
      .createDuel(nonce, stakeAmount, startTime, endTime)
      .accounts({
        creator: creator.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([creator])
      .rpc({ commitment: "confirmed" });

    await expectAnchorError(
      program.methods
        .cancelDuel()
        .accounts({
          creator: opponent.publicKey, // opponent tries to cancel creator's duel
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([opponent])
        .rpc(),
      "NotOwner"
    );
  });

  it("Fails when duel already cancelled (double cancel)", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, creator.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);

    const now = Math.floor(Date.now() / 1000);
    const startTime = new anchor.BN(now - 10);
    const endTime = new anchor.BN(now + DURATIONS.oneWeek);

    await program.methods
      .createDuel(nonce, stakeAmount, startTime, endTime)
      .accounts({
        creator: creator.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([creator])
      .rpc({ commitment: "confirmed" });

    // First cancel succeeds
    await program.methods
      .cancelDuel()
      .accounts({
        creator: creator.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([creator])
      .rpc({ commitment: "confirmed" });

    // Second cancel must fail
    await expectAnchorError(
      program.methods
        .cancelDuel()
        .accounts({
          creator: creator.publicKey,
          duel: duelPda,
          escrow: escrowPda,
          systemProgram: SYSTEM_PROGRAM,
        })
        .signers([creator])
        .rpc(),
      "NotPending"
    );
  });
});
