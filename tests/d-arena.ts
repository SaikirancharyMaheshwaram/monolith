import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { DArena } from "../target/types/d_arena";
import nacl from "tweetnacl";
import {
  ComputeBudgetProgram,
  Ed25519Program,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  fundIfNeeded,
  buildMessage,
  DURATIONS,
  expectAnchorError,
  getConfigPda,
  getDuelPda,
  getEscrowPda,
  getNonce,
  getVaultPda,
  logTransactionResult,
  streakWindow,
  shouldFail,
} from "./helper/helper";
import { SYSTEM_PROGRAM, UserResult, UserResultByte } from "./helper/constant";
import { expect } from "chai";
import fs, { readFileSync } from "fs";

const kpPath = "wallet.json";
export const SERVER_KEYPAIR = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync(kpPath, "utf8")))
);
console.log("SERVER_KEYPAIR:", SERVER_KEYPAIR.publicKey.toBase58());
const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);

const program = anchor.workspace.dArena as Program<DArena>;
const conn = provider.connection;

const creator = Keypair.generate();

const opponent = Keypair.generate();

const TREASURY = new PublicKey("treynHHxg2ftG3Hzn5dypVZX593Yss6uU54puVE614D");

let configPda: PublicKey;
let programDataAddress: PublicKey;
let creatorVault: PublicKey;
let opponentVault: PublicKey;

before(async () => {
  console.log("Program :", program.programId.toBase58());
  console.log("Creator :", creator.publicKey.toBase58());
  console.log("Opponent:", opponent.publicKey.toBase58());

  // await fundIfNeeded(
  //   conn,
  //   creator.publicKey,
  //   0.05 * LAMPORTS_PER_SOL,
  //   provider
  // );
  // await fundIfNeeded(
  //   conn,
  //   opponent.publicKey,
  //   0.05 * LAMPORTS_PER_SOL,
  //   provider
  // );

  [configPda] = getConfigPda(program);
  [creatorVault] = getVaultPda(program, creator.publicKey);
  [opponentVault] = getVaultPda(program, opponent.publicKey);

  [programDataAddress] = PublicKey.findProgramAddressSync(
    [program.programId.toBytes()],
    new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  );
});

// ----------------------------- createDuel -----------------------------
describe("createDuel", () => {
  const duelNonce = getNonce();
  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

  it("Fails when non-upgrade-authority tries to initialize", async () => {
    const notOwner = Keypair.generate();
    // await fundIfNeeded(
    //   conn,
    //   notOwner.publicKey,
    //   0.01 * LAMPORTS_PER_SOL,
    //   provider
    // );

    await expectAnchorError(
      program.methods
        .initialzeConfig(
          Array.from(SERVER_KEYPAIR.publicKey.toBytes()),
          TREASURY,
          500
        )
        .accounts({
          admin: notOwner.publicKey,
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
        Array.from(SERVER_KEYPAIR.publicKey.toBytes()),
        TREASURY,
        500
      )
      .accounts({
        admin: provider.wallet.publicKey,
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

  it("Creates a 7-day duel", async () => {
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
    const escrowBalance = await conn.getBalance(escrowPda);

    expect(duel.endTs.toString()).to.equal(end.toString(), "end_ts mismatch");
    expect(duration).to.be.at.least(DURATIONS.oneWeek - 1);
    expect(escrowBalance).to.be.at.least(rentMin);
    expect(escrowInfo).to.not.be.null;
    expect(escrowInfo!.owner.toBase58()).to.equal(SYSTEM_PROGRAM.toBase58());
    expect(escrowInfo!.data.length).to.equal(0);
    expect(escrowBalance).to.be.at.least(stakeAmount.toNumber());

    logTransactionResult(
      `7-day duel | ${duration / DURATIONS.oneDay} days`,
      tx
    );
  });

  it("Creates a 30-day (monthly streak) duel", async () => {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, opponent.publicKey, nonce);
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
      .signers([opponent])
      .rpc({ commitment: "confirmed" });

    const duel = await program.account.duel.fetch(duelPda);
    const escrowInfo = await conn.getAccountInfo(escrowPda);
    const rentMin = await conn.getMinimumBalanceForRentExemption(0);
    const duration = duel.endTs.sub(duel.startTs).toNumber();
    const escrowBalance = await conn.getBalance(escrowPda);

    expect(duel.endTs.toString()).to.equal(end.toString(), "end_ts mismatch");
    expect(duration).to.be.at.least(DURATIONS.oneMonth);
    expect(escrowBalance).to.be.at.least(rentMin);
    expect(escrowInfo).to.not.be.null;
    expect(escrowInfo!.owner.toBase58()).to.equal(SYSTEM_PROGRAM.toBase58());
    expect(escrowInfo!.data.length).to.equal(0);
    expect(escrowBalance).to.be.at.least(stakeAmount.toNumber());

    logTransactionResult(
      `30-day duel | ${duration / DURATIONS.oneDay} days`,
      tx
    );
  });

  it("Creates a 365-day (max duration) duel", async () => {
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
    const escrowBalance = await conn.getBalance(escrowPda);

    expect(duel.endTs.toString()).to.equal(end.toString(), "end_ts mismatch");
    expect(duration).to.be.at.least(DURATIONS.oneYear - 1);
    expect(escrowBalance).to.be.at.least(rentMin);
    expect(escrowInfo).to.not.be.null;
    expect(escrowInfo!.owner.toBase58()).to.equal(SYSTEM_PROGRAM.toBase58());
    expect(escrowInfo!.data.length).to.equal(0);
    expect(escrowBalance).to.be.at.least(stakeAmount.toNumber());

    logTransactionResult(
      `365-day duel | ${duration / DURATIONS.oneDay} days`,
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
        .createDuel(nonce, stakeAmount, end, start)
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

// ----------------------------- joinDuel -----------------------------
describe("joinDuel", () => {
  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

  async function createFreshDuel(
    staker = creator,
    stake = stakeAmount,
    duration = DURATIONS.oneWeek
  ): Promise<{ duelPda: PublicKey; escrowPda: PublicKey; nonce: anchor.BN }> {
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

    expect(duel.status.active).to.not.be.undefined;
    expect(duel.opponent).to.not.be.null;
    expect(duel.opponent!.toBase58()).to.equal(opponent.publicKey.toBase58());
    expect(escrowAfter - escrowBefore).to.equal(stakeAmount.toNumber());
    expect(escrowAfter).to.be.at.least(stakeAmount.toNumber() * 2);
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
    // await fundIfNeeded(
    //   conn,
    //   thirdParty.publicKey,
    //   0.01 * LAMPORTS_PER_SOL,
    //   provider
    // );

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

// ----------------------------- cancelDuel -----------------------------
describe("cancelDuel", () => {
  const stakeAmount = new anchor.BN(0.1 * LAMPORTS_PER_SOL);

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
    expect(escrowAfter).to.equal(escrowBefore - stakeAmount.toNumber());

    logTransactionResult("cancel duel — full refund", tx);
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

  it("Fails when non-creator tries to cancel", async () => {
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
          creator: opponent.publicKey,
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

// ----------------------------- settleDuel -----------------------------
describe("settleDuel", () => {
  const stakeAmount = new anchor.BN(0.05 * LAMPORTS_PER_SOL);

  async function createFreshDuel(
    staker = creator,
    stake = stakeAmount,
    duration = DURATIONS.oneWeek
  ): Promise<{ duelPda: PublicKey; escrowPda: PublicKey }> {
    const nonce = getNonce();
    const [duelPda] = getDuelPda(program, staker.publicKey, nonce);
    const [escrowPda] = getEscrowPda(program, duelPda);
    const { startTime, endTime } = streakWindow(duration);

    const createTx = await program.methods
      .createDuel(nonce, stake, startTime, endTime)
      .accounts({
        creator: staker.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([staker])
      .rpc({ commitment: "confirmed" });

    const joinTx = await program.methods
      .joinDuel()
      .accounts({
        opponent: opponent.publicKey,
        duel: duelPda,
        escrow: escrowPda,
        systemProgram: SYSTEM_PROGRAM,
      })
      .signers([opponent])
      .rpc({ commitment: "confirmed" });

    logTransactionResult("created duel:", createTx);
    logTransactionResult("joined duel:", joinTx);
    return { duelPda, escrowPda };
  }
  // HELPER: Build settleDuel instruction
  async function buildSettleIx(
    user: Keypair,
    duelPda: PublicKey,
    escrowPda: PublicKey,
    resultEnum: any, // e.g., { winner: {} }
    resultByte: number // e.g., 0 for Winner
  ): Promise<{
    settleIx: TransactionInstruction;
    message: Buffer;
    ed25519Ix: TransactionInstruction;
  }> {
    const duel = await program.account.duel.fetch(duelPda);
    const duelId = new anchor.BN(duel.duelId);
    const nonce = new anchor.BN(duel.settlementNonce);

    // Build message: [duel_id LE][user_pubkey][result_u8][nonce LE]
    const message = buildMessage(duelId, user.publicKey, resultByte, nonce);

    // Sign with server key
    const signature = nacl.sign.detached(message, SERVER_KEYPAIR.secretKey);

    // Ed25519 verification instruction
    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: SERVER_KEYPAIR.publicKey.toBytes(),
      message,
      signature,
    });

    // SettleDuel instruction
    const settleIx = await program.methods
      .settleDuel(resultEnum as any)
      .accounts({
        user: user.publicKey,
        duel: duelPda,
        config: configPda,
        escrow: escrowPda,
        creatorAccount: creator.publicKey,
        opponentAccount: opponent.publicKey,
        creatorVault,
        opponentVault,
        treasury: TREASURY,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SYSTEM_PROGRAM,
      })
      .instruction();

    return { settleIx, message, ed25519Ix };
  }

  it("Creator wins — 70/25/5 split correct", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    const total = stakeAmount.toNumber() * 2;

    const expectedWinner = Math.floor((total * 7000) / 10000); // 70%
    const expectedLoser = Math.floor((total * 2500) / 10000); // 25%
    const expectedTreas = Math.floor((total * 500) / 10000); // 5%

    console.log("─── Expected Distribution ───");
    console.log(`  Total pot : ${total / LAMPORTS_PER_SOL} SOL`);
    console.log(`  Winner 70%: ${expectedWinner / LAMPORTS_PER_SOL} SOL`);
    console.log(`  Loser  25%: ${expectedLoser / LAMPORTS_PER_SOL} SOL`);
    console.log(`  Treasury5%: ${expectedTreas / LAMPORTS_PER_SOL} SOL`);

    const creatorBefore = await conn.getBalance(creator.publicKey);
    const treasuryBefore = await conn.getBalance(TREASURY);
    const escrowBefore = await conn.getBalance(escrowPda);

    const { settleIx, ed25519Ix } = await buildSettleIx(
      creator,
      duelPda,
      escrowPda,
      { winner: {} },
      0 // Winner enum index
    );

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix)
      .add(settleIx);

    let txSig = await sendAndConfirmTransaction(conn, tx, [creator]);

    logTransactionResult("settle tx", txSig);

    //  Fetch state AFTER settle
    const duelAcc = await program.account.duel.fetch(duelPda);
    const opponentVaultAcc = await program.account.redemptionVault.fetch(
      opponentVault
    );
    const creatorAfter = await conn.getBalance(creator.publicKey);
    const treasuryAfter = await conn.getBalance(TREASURY);
    const escrowAfter = await conn.getBalance(escrowPda);

    console.log("─── Actual Balances ───");
    console.log(`  creator  before: ${creatorBefore / LAMPORTS_PER_SOL} SOL`);
    console.log(`  creator  after : ${creatorAfter / LAMPORTS_PER_SOL} SOL`);
    console.log(
      `  creator  gained: ${
        (creatorAfter - creatorBefore) / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log(`  treasury before: ${treasuryBefore / LAMPORTS_PER_SOL} SOL`);
    console.log(`  treasury after : ${treasuryAfter / LAMPORTS_PER_SOL} SOL`);
    console.log(
      `  treasury gained: ${
        (treasuryAfter - treasuryBefore) / LAMPORTS_PER_SOL
      } SOL`
    );
    console.log(`  escrow   before: ${escrowBefore / LAMPORTS_PER_SOL} SOL`);
    console.log(`  escrow   after : ${escrowAfter / LAMPORTS_PER_SOL} SOL`);
    console.log(
      `  vault    locked: ${
        opponentVaultAcc.lockedLamports.toNumber() / LAMPORTS_PER_SOL
      } SOL`
    );
    // Status must be Settled
    expect(duelAcc.status.settled).to.not.be.undefined;

    // Winner must be creator
    expect(duelAcc.winner!.toBase58()).to.equal(
      creator.publicKey.toBase58(),
      "winner should be creator"
    );

    // Nonce must have incremented
    expect(duelAcc.settlementNonce.toNumber()).to.equal(1, "nonce should be 1");

    //  OPPONENT REDEMPTION VAULT — locked 25%
    // Vault owner must be opponent
    expect(opponentVaultAcc.owner.toBase58()).to.equal(
      opponent.publicKey.toBase58(),
      "vault owner should be opponent"
    );

    // Vault must be locked
    expect(opponentVaultAcc.isLocked).to.be.true;

    //  TREASURY — received 5%

    expect(treasuryAfter - treasuryBefore).to.equal(
      expectedTreas,
      `treasury should receive ${expectedTreas / LAMPORTS_PER_SOL} SOL (5%)`
    );

    // Escrow lost exactly total (winner + loser + treasury)
    expect(escrowBefore - escrowAfter).to.equal(
      total,
      "escrow should be drained by exactly total pot"
    );

    // Escrow should be empty (or just rent exempt minimum)
    expect(escrowAfter).to.equal(0, "escrow should be fully drained");
  });

  it("Opponent wins — 70/25/5 split correct", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();
    const duel = await program.account.duel.fetch(duelPda);
    const total = duel.stakedAmount.toNumber() * 2;
    const expectedWinner = Math.floor((total * 7000) / 10000);
    const expectedLoser = Math.floor((total * 2500) / 10000);
    const expectedTreas = Math.floor((total * 500) / 10000);

    const opponentBefore = await conn.getBalance(opponent.publicKey);
    const treasuryBefore = await conn.getBalance(TREASURY);
    const escrowBefore = await conn.getBalance(escrowPda);

    // Opponent calls settleDuel with Winner result
    const { settleIx, ed25519Ix } = await buildSettleIx(
      opponent, // opponent is the caller
      duelPda,
      escrowPda,
      { winner: {} },
      0 // Winner enum index
    );

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix)
      .add(settleIx);

    const txSig = await sendAndConfirmTransaction(conn, tx, [opponent]);
    logTransactionResult("settle tx", txSig);

    const duelAcc = await program.account.duel.fetch(duelPda);
    expect(duelAcc.status.settled).to.not.be.undefined;
    expect(duelAcc.winner!.toBase58()).to.equal(
      opponent.publicKey.toBase58(),
      "winner should be opponent"
    );

    // Opponent received 70% directly to wallet
    const opponentAfter = await conn.getBalance(opponent.publicKey);
    expect(opponentAfter - opponentBefore).to.be.at.least(
      expectedWinner - 10000, // buffer for fees
      "opponent should receive 70% of pot"
    );

    // Creator's 25% locked in creator vault
    const creatorVaultAcc = await program.account.redemptionVault.fetch(
      creatorVault
    );
    expect(creatorVaultAcc.isLocked).to.be.true;
    expect(creatorVaultAcc.lockedLamports.toNumber()).to.equal(expectedLoser);

    // Treasury received 5%
    const treasuryAfter = await conn.getBalance(TREASURY);
    expect(treasuryAfter - treasuryBefore).to.equal(expectedTreas);

    console.log(
      `Opponent won: gained ${
        (opponentAfter - opponentBefore) / LAMPORTS_PER_SOL
      } SOL`
    );
  });

  it(" Draw — both get 50% refund, no fees", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();
    const duel = await program.account.duel.fetch(duelPda);
    const total = duel.stakedAmount.toNumber() * 2;
    const eachRefund = Math.floor((total * 5000) / 10000); // 50% each

    const creatorBefore = await conn.getBalance(creator.publicKey);
    const opponentBefore = await conn.getBalance(opponent.publicKey);
    const escrowBefore = await conn.getBalance(escrowPda);

    // Creator calls settleDuel with Draw result
    const { settleIx, ed25519Ix } = await buildSettleIx(
      creator,
      duelPda,
      escrowPda,
      { draw: {} },
      2 // Draw enum index
    );

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix)
      .add(settleIx);

    const txSig = await sendAndConfirmTransaction(conn, tx, [creator]);
    logTransactionResult("settled tx:", txSig);

    const duelAcc = await program.account.duel.fetch(duelPda);
    expect(duelAcc.status.settled).to.not.be.undefined;

    // Both received ~50% back to their wallets
    const creatorAfter = await conn.getBalance(creator.publicKey);
    const opponentAfter = await conn.getBalance(opponent.publicKey);

    expect(creatorAfter - creatorBefore).to.be.at.least(
      eachRefund - 10000,
      "creator should receive ~50% refund"
    );
    expect(opponentAfter - opponentBefore).to.be.at.least(
      eachRefund - 10000,
      "opponent should receive ~50% refund"
    );

    // Treasury should NOT receive fees on draw
    const treasuryAfter = await conn.getBalance(TREASURY);
    expect(treasuryAfter).to.equal(
      await conn.getBalance(TREASURY), // unchanged
      "treasury should not receive fees on draw"
    );

    // Escrow drained
    const escrowAfter = await conn.getBalance(escrowPda);
    expect(escrowBefore - escrowAfter).to.equal(total);

    console.log(` Draw: both refunded ${eachRefund / LAMPORTS_PER_SOL} SOL`);
  });

  it(" BothLost — both get 50% locked in redemption vaults", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();
    const duel = await program.account.duel.fetch(duelPda);
    const total = duel.stakedAmount.toNumber() * 2;

    const escrowBefore = await conn.getBalance(escrowPda);

    // Creator calls settleDuel with BothLost result
    const { settleIx, ed25519Ix } = await buildSettleIx(
      creator,
      duelPda,
      escrowPda,
      { bothLost: {} },
      3
    );

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix)
      .add(settleIx);

    const txSig = await sendAndConfirmTransaction(conn, tx, [creator]);
    logTransactionResult("settle tx:", txSig);

    const duelAcc = await program.account.duel.fetch(duelPda);
    expect(duelAcc.status.settled).to.not.be.undefined;

    // Both vaults locked with 50% each
    const creatorVaultAcc = await program.account.redemptionVault.fetch(
      creatorVault
    );
    const opponentVaultAcc = await program.account.redemptionVault.fetch(
      opponentVault
    );

    expect(creatorVaultAcc.isLocked).to.be.true;
    expect(creatorVaultAcc.owner.toBase58()).to.equal(
      creator.publicKey.toBase58()
    );

    expect(opponentVaultAcc.isLocked).to.be.true;
    expect(opponentVaultAcc.owner.toBase58()).to.equal(
      opponent.publicKey.toBase58()
    );

    // Escrow drained
    const escrowAfter = await conn.getBalance(escrowPda);
    expect(escrowBefore - escrowAfter).to.equal(total);
  });

  it("Fails when signature from wrong server key", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();
    const duel = await program.account.duel.fetch(duelPda);
    const duelId = new anchor.BN(duel.duelId);
    const nonce = new anchor.BN(duel.settlementNonce);

    // Build message correctly
    const message = buildMessage(
      duelId,
      creator.publicKey,
      UserResult[0], // Winner
      nonce
    );

    // Sign with WRONG key (not SERVER_KEYPAIR)
    const wrongKeypair = Keypair.generate();
    const signature = nacl.sign.detached(message, wrongKeypair.secretKey);

    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: wrongKeypair.publicKey.toBytes(), // Wrong pubkey
      message,
      signature,
    });

    const settleIx = await program.methods
      .settleDuel({ winner: {} } as any)
      .accounts({
        user: creator.publicKey,
        duel: duelPda,
        config: configPda,
        escrow: escrowPda,
        creatorAccount: creator.publicKey,
        opponentAccount: opponent.publicKey,
        creatorVault,
        opponentVault,
        treasury: TREASURY,
        instructionsSysvar: SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: SYSTEM_PROGRAM,
      })
      .instruction();

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix)
      .add(settleIx);

    // Should fail with InvalidSignature
    await shouldFail(
      sendAndConfirmTransaction(conn, tx, [creator]),
      "InvalidSignature"
    );
  });

  it("Fails when settling already-settled duel (replay)", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();

    // First settle succeeds
    const { settleIx: settleIx1, ed25519Ix: ed25519Ix1 } = await buildSettleIx(
      creator,
      duelPda,
      escrowPda,
      { winner: {} },
      0
    );

    const tx1 = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix1)
      .add(settleIx1);

    await sendAndConfirmTransaction(conn, tx1, [creator]);

    // Verify duel is settled
    const duelAcc = await program.account.duel.fetch(duelPda);
    expect(duelAcc.status.settled).to.not.be.undefined;

    // Try to settle again with SAME nonce (replay attack)
    const { settleIx: settleIx2, ed25519Ix: ed25519Ix2 } = await buildSettleIx(
      creator,
      duelPda,
      escrowPda,
      { winner: {} },
      0 // Same nonce, should fail
    );

    const tx2 = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix2)
      .add(settleIx2);

    // Should fail with NotActive or similar
    await shouldFail(
      sendAndConfirmTransaction(conn, tx2, [creator]),
      "NotActive"
    );
  });
});
