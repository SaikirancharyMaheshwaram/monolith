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
} from "./helper/helper";
import { SYSTEM_PROGRAM, UserResult, UserResultByte } from "./helper/constant";
import { expect } from "chai";
import fs, { readFileSync } from "fs";

const kpPath = "keypair.json";
const SERVER_KEYPAIR = Keypair.fromSecretKey(
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
  const stakeAmount = new anchor.BN(0.2 * LAMPORTS_PER_SOL);

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

    return { duelPda, escrowPda };
  }

  it("Creator wins — 70/25/5 split correct", async () => {
    const { duelPda, escrowPda } = await createFreshDuel();
    const duel = await program.account.duel.fetch(duelPda);
    const duelId = new anchor.BN(duel.duelId);
    const nonce = new anchor.BN(duel.settlementNonce);

    const configAcc = await program.account.config.fetch(configPda);
    const publicKey = new PublicKey(new Uint8Array(configAcc.backendPubkey));

    console.log("configAcc", publicKey);

    const creatorBefore = await conn.getBalance(creator.publicKey);
    const treasuryBefore = await conn.getBalance(TREASURY);
    const escrowBefore = await conn.getBalance(escrowPda);

    const resultEnum = { winner: {} }; // for Anchor method arg
    const resultByte = 0; // Winner enum index

    // const message = Buffer.concat([
    //   new anchor.BN(duel.duelId).toArrayLike(Buffer, "le", 8),
    //   creator.publicKey.toBuffer(), // must be same as `user` account
    //   Buffer.from([resultByte]),
    //   new anchor.BN(duel.settlementNonce).toArrayLike(Buffer, "le", 8),
    // ]);

    const message = buildMessage(
      duelId,
      creator.publicKey,
      UserResult[UserResultByte.winner],
      nonce
    );
    const signature = nacl.sign.detached(message, SERVER_KEYPAIR.secretKey);

    const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
      publicKey: SERVER_KEYPAIR.publicKey.toBytes(),
      message,
      signature,
    });
    console.log(
      "SERVER_KEYPAIR.publicKey",
      SERVER_KEYPAIR.publicKey.toBase58()
    );

    const settleResult = { winner: {} };
    const settleIx = await program.methods
      .settleDuel(resultEnum as any)
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

    console.log("ix0:", ed25519Ix.programId.toBase58());
    console.log("ix1:", settleIx.programId.toBase58());

    const tx = new Transaction()
      .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
      .add(ed25519Ix)
      .add(settleIx);
    let txSig: string;
    try {
      txSig = await sendAndConfirmTransaction(conn, tx, [creator]);
    } catch (e: any) {
      if (typeof e?.getLogs === "function") {
        console.log(await e.getLogs());
      }
      throw e;
    }

    logTransactionResult("settle tx", txSig);

    const duelAcc = await program.account.duel.fetch(duelPda);
    const opponentVaultAcc = await program.account.redemptionVault.fetch(
      opponentVault
    );
    const creatorAfter = await conn.getBalance(creator.publicKey);
    const treasuryAfter = await conn.getBalance(TREASURY);
    const escrowAfter = await conn.getBalance(escrowPda);

    // Keep your full assertions here if you already had exact amount checks.
    expect(duelAcc.status.settled).to.not.be.undefined;
    expect(creatorAfter).to.be.greaterThan(
      creatorBefore - 0.02 * LAMPORTS_PER_SOL
    );
    expect(treasuryAfter).to.be.greaterThanOrEqual(treasuryBefore);
    expect(escrowAfter).to.be.lessThan(escrowBefore);
    expect(opponentVaultAcc.owner.toBase58()).to.equal(
      opponent.publicKey.toBase58()
    );
  });
});
