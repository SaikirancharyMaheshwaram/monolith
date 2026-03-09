import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import bs58 from "bs58";
import { Buffer } from "buffer";
import {
  ComputeBudgetProgram,
  Connection,
  Ed25519Program,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type SimulatedTransactionResponse,
  SystemProgram,
  LAMPORTS_PER_SOL,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  clusterApiUrl,
} from "@solana/web3.js";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { clearToken } from "./token";
import { useArenaStore } from "@/stores/arenaStore";
import { useDuelStore } from "@/stores/duelStore";
import { useUserStore } from "@/stores/userStore";
import { useWalletStore } from "@/stores/use-wallet-store";

const APP_IDENTITY = {
  name: "Strivoiz",
  uri: "https://strivioz.vercel.app",
  icon: "favicon.ico",
};

const D_ARENA_PROGRAM_ID = new PublicKey(
  "EJUzdHnJDy9QEVpWCYcbFoZzXbQWanzKLYJdAYkrqJNM",
);
const CREATE_DUEL_DISCRIMINATOR = Buffer.from([
  49, 28, 93, 11, 75, 242, 69, 165,
]);
const JOIN_DUEL_DISCRIMINATOR = Buffer.from([
  7, 247, 76, 103, 101, 139, 254, 61,
]);
const SETTLE_DUEL_DISCRIMINATOR = Buffer.from([
  148, 90, 251, 130, 217, 144, 190, 239,
]);
const INITIALIZE_CONFIG_DISCRIMINATOR = Buffer.from([
  241, 255, 79, 111, 223, 206, 48, 120,
]);
const CANCEL_DUEL_DISCRIMINATOR = Buffer.from([
  83, 124, 224, 237, 235, 44, 38, 57,
]);
const REDEEM_VAULT_DISCRIMINATOR = Buffer.from([
  132, 70, 193, 151, 97, 115, 180, 195,
]);
const REDEMPTION_VAULT_ACCOUNT_DISCRIMINATOR = Buffer.from([
  76, 171, 19, 58, 196, 239, 84, 140,
]);
const DUEL_SEED = Buffer.from("duel");
const ESCROW_SEED = Buffer.from("escrow");
const CONFIG_SEED = Buffer.from("config");
const VAULT_SEED = Buffer.from("vault");
const BPF_UPGRADEABLE_LOADER_PROGRAM_ID = new PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111",
);
const DEFAULT_DUEL_DURATION_SECONDS = 7 * 24 * 60 * 60;
const CREATE_DUEL_MIN_START_OFFSET_SECONDS = 60;
const DUEL_ACCOUNT_SPACE = 157;
const DEFAULT_FEE_LAMPORTS = 10_000;

type CreateOnChainDuelInput = {
  stakeAmountSol: number;
  startTimeMs: number;
  endTimeMs?: number;
  duelNonce?: number;
};

type CreateOnChainDuelResult = {
  signature: string;
  duelNonce: string;
  duelAddress: string;
  escrowAddress: string;
  programId: string;
  startTimeSeconds: string;
  endTimeSeconds: string;
  stakeLamports: string;
};

type JoinOnChainDuelInput = {
  duelAddress: string;
  escrowAddress?: string;
};

type JoinOnChainDuelResult = {
  signature: string;
  duelAddress: string;
  escrowAddress: string;
  programId: string;
};

type CancelOnChainDuelInput = {
  duelAddress: string;
  escrowAddress?: string;
};

type CancelOnChainDuelResult = {
  signature: string;
  duelAddress: string;
  escrowAddress: string;
  programId: string;
};

type DuelSettlementContext = {
  duelId: number;
  settlementNonce: number;
};

type SettleOnChainDuelInput = {
  duelAddress: string;
  resultByte: number;
  message: string;
  signature: string;
};

type SettleOnChainDuelResult = {
  signature: string;
  duelAddress: string;
  programId: string;
};

type InitializeProgramConfigInput = {
  backendPubkey: string;
  treasuryAddress: string;
  feeBps: number;
};

type InitializeProgramConfigResult = {
  signature: string;
  configAddress: string;
  programId: string;
};

type RedemptionVaultInfo = {
  vaultAddress: string;
  exists: boolean;
  owner: string | null;
  isLocked: boolean;
  lockedLamports: number;
  balanceSol: number;
  accountLamports: number;
};

type WalletHook = {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  sending: boolean;
  connect: () => Promise<PublicKey>;
  disconnect: () => void;
  getBalance: () => Promise<number>;
  sendSOL: (toAddress: string, amountSOL: number) => Promise<string>;
  createDuel: (
    input: CreateOnChainDuelInput,
  ) => Promise<CreateOnChainDuelResult>;
  joinDuel: (input: JoinOnChainDuelInput) => Promise<JoinOnChainDuelResult>;
  cancelDuel: (
    input: CancelOnChainDuelInput,
  ) => Promise<CancelOnChainDuelResult>;
  initializeProgramConfig: (
    input: InitializeProgramConfigInput,
  ) => Promise<InitializeProgramConfigResult>;
  getDuelSettlementContext: (
    duelAddress: string,
  ) => Promise<DuelSettlementContext>;
  settleDuel: (
    input: SettleOnChainDuelInput,
  ) => Promise<SettleOnChainDuelResult>;
  getRedemptionVaultInfo: () => Promise<RedemptionVaultInfo>;
  redeemVault: () => Promise<{
    signature: string;
    vaultAddress: string;
    redeemedLamports: number;
    redeemedSol: number;
  }>;
  connection: Connection;
};

function writeUInt64LE(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Invalid unsigned 64-bit value");
  }

  const buffer = Buffer.alloc(8);
  let remainder = Math.floor(value);

  for (let i = 0; i < 8; i += 1) {
    buffer[i] = remainder & 0xff;
    remainder = Math.floor(remainder / 256);
  }

  return buffer;
}

function normalizeSignature(signature: Uint8Array | string) {
  return typeof signature === "string" ? signature : bs58.encode(signature);
}

function generateDuelNonce() {
  const randomPart = Math.floor(Math.random() * 1_000);
  return Date.now() * 1_000 + randomPart;
}

function formatSimulationError(simulation: SimulatedTransactionResponse) {
  const logs = simulation.logs?.join("\n");

  if (typeof simulation.err === "string") {
    return logs ? `${simulation.err}\n${logs}` : simulation.err;
  }

  const errText = simulation.err
    ? JSON.stringify(simulation.err)
    : "Transaction simulation failed";
  return logs ? `${errText}\n${logs}` : errText;
}

function describeSettlementSimulationFailure(
  simulation: SimulatedTransactionResponse,
) {
  const raw = formatSimulationError(simulation);
  const err = simulation.err;

  if (
    err &&
    typeof err === "object" &&
    "InstructionError" in err &&
    Array.isArray((err as { InstructionError?: unknown }).InstructionError)
  ) {
    const [ixIndex] = (err as { InstructionError: [number, unknown] })
      .InstructionError;

    if (ixIndex === 1) {
      return [
        "Settlement signature verification failed before the duel program executed.",
        "This usually means the on-chain config backend pubkey does not match BACKEND_SIGNER_SECRET_KEY, or the signed settlement message bytes differ from what the program expects.",
        raw,
      ].join("\n");
    }

    if (ixIndex === 2) {
      return [
        "The duel program rejected the settle instruction after signature verification passed.",
        raw,
      ].join("\n");
    }
  }

  return raw;
}

function readUInt64LE(bytes: Uint8Array, offset: number) {
  let value = 0;
  let multiplier = 1;

  for (let i = 0; i < 8; i += 1) {
    value += bytes[offset + i] * multiplier;
    multiplier *= 256;
  }

  return value;
}

function readPublicKey(bytes: Uint8Array, offset: number) {
  return new PublicKey(bytes.slice(offset, offset + 32));
}

function parseDuelAccountData(data: Buffer) {
  let offset = 8;
  const duelId = readUInt64LE(data, offset);
  offset += 8;
  const creator = readPublicKey(data, offset);
  offset += 32;

  const opponentOption = data[offset];
  offset += 1;
  const opponent = opponentOption === 1 ? readPublicKey(data, offset) : null;
  offset += 32;

  offset += 8; // staked_amount
  offset += 1; // status enum
  offset += 8; // created_ts
  offset += 8; // start_ts
  offset += 8; // end_ts

  const winnerOption = data[offset];
  offset += 1;
  const winner = winnerOption === 1 ? readPublicKey(data, offset) : null;
  offset += 32;

  const settlementNonce = readUInt64LE(data, offset);

  return {
    duelId,
    creator,
    opponent,
    winner,
    settlementNonce,
  };
}

function parseConfigAccountData(data: Buffer) {
  let offset = 8;
  offset += 32; // admin
  offset += 32; // server authority
  const treasury = readPublicKey(data, offset);
  offset += 32;
  const backendPubkey = Uint8Array.from(data.slice(offset, offset + 32));

  return {
    treasury,
    backendPubkey,
  };
}

function parseRedemptionVaultAccountData(data: Buffer) {
  if (data.length < 49) {
    throw new Error("Invalid redemption vault account size");
  }

  const discriminator = data.subarray(0, 8);
  const matchesDiscriminator =
    discriminator.length === REDEMPTION_VAULT_ACCOUNT_DISCRIMINATOR.length &&
    discriminator.every(
      (byte, index) => byte === REDEMPTION_VAULT_ACCOUNT_DISCRIMINATOR[index],
    );
  if (!matchesDiscriminator) {
    throw new Error("Invalid redemption vault discriminator");
  }

  let offset = 8;
  const owner = readPublicKey(data, offset);
  offset += 32;
  const lockedLamports = readUInt64LE(data, offset);
  offset += 8;
  const isLocked = data[offset] === 1;

  return {
    owner,
    lockedLamports,
    isLocked,
  };
}

function isWalletRequestDeclined(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const err = error as { code?: number | string; message?: string };
  const code = typeof err.code === "string" ? Number(err.code) : err.code;
  if (code === -3) return true;

  const message = err.message?.toLowerCase() ?? "";
  return (
    message.includes("request declined") ||
    message.includes("request rejected") ||
    message.includes("user rejected")
  );
}

export function useWallet(): WalletHook {
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);

  const isDevnet = useWalletStore((s) => s.isDevnet);
  const storedPublicKey = useWalletStore((s) => s.publicKey);
  const setStoredPublicKey = useWalletStore((s) => s.setPublicKey);
  const storedAuthToken = useWalletStore((s) => s.authToken);
  const setStoredAuthToken = useWalletStore((s) => s.setAuthToken);
  const previousWalletRef = useRef<string | null>(null);

  const cluster = isDevnet ? "devnet" : "mainnet-beta";

  const publicKey = useMemo(() => {
    if (!storedPublicKey) return null;
    try {
      return new PublicKey(storedPublicKey);
    } catch {
      return null;
    }
  }, [storedPublicKey]);

  const user = useQuery(api.users.getUserByWallet.getUserByWallet, {
    walletAddress: storedPublicKey ?? "",
  });

  const connection = useMemo(
    () => new Connection(clusterApiUrl(cluster), "confirmed"),
    [cluster],
  );

  const authorizeWalletSession = useCallback(
    async (wallet: Web3MobileWallet, address?: string) => {
      if (storedAuthToken) {
        try {
          const reauth = await wallet.reauthorize({
            auth_token: storedAuthToken,
            identity: APP_IDENTITY,
          });
          setStoredAuthToken(reauth.auth_token);
          return reauth;
        } catch (error) {
          if (isWalletRequestDeclined(error)) throw error;
          setStoredAuthToken(null);
        }
      }

      const auth = await wallet.authorize({
        chain: `solana:${cluster}`,
        identity: APP_IDENTITY,
        ...(address ? { addresses: [address] } : {}),
      });
      setStoredAuthToken(auth.auth_token);
      return auth;
    },
    [cluster, setStoredAuthToken, storedAuthToken],
  );

  useEffect(() => {
    if (!storedPublicKey) {
      useWalletStore.getState().setStatus("public");
      return;
    }

    if (user) {
      useWalletStore.getState().setStatus("authenticated");
    } else if (user === null) {
      useWalletStore.getState().setStatus("onboarding");
    }
  }, [storedPublicKey, user]);

  useEffect(() => {
    const previousWallet = previousWalletRef.current;
    if (previousWallet !== storedPublicKey) {
      useUserStore.getState().reset();
      useDuelStore.getState().reset();
      useArenaStore.getState().reset();
      if (previousWallet && previousWallet !== storedPublicKey) {
        setStoredAuthToken(null);
      }
      previousWalletRef.current = storedPublicKey;
    }
  }, [setStoredAuthToken, storedPublicKey]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const authResult = await transact(async (wallet: Web3MobileWallet) => {
        const result = await wallet.authorize({
          chain: `solana:${cluster}`,
          identity: APP_IDENTITY,
        });
        return result;
      });

      setStoredAuthToken(authResult.auth_token);

      const pubkey = new PublicKey(
        Buffer.from(authResult.accounts[0].address, "base64"),
      );

      setStoredPublicKey(pubkey.toBase58());
      return pubkey;
    } catch (error: any) {
      console.error("Connect failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster, setStoredAuthToken, setStoredPublicKey]);

  const disconnect = useCallback(() => {
    setStoredPublicKey(null);
    setStoredAuthToken(null);
    useWalletStore.getState().setStatus("public");
    void clearToken();
  }, [setStoredAuthToken, setStoredPublicKey]);

  const getBalance = useCallback(async () => {
    if (!publicKey) return 0;
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [publicKey, connection]);

  const getRedemptionVaultInfo = useCallback(async () => {
    if (!publicKey) throw new Error("Wallet not connected");

    const [vaultPublicKey] = PublicKey.findProgramAddressSync(
      [VAULT_SEED, publicKey.toBuffer()],
      D_ARENA_PROGRAM_ID,
    );

    const accountInfo = await connection.getAccountInfo(vaultPublicKey, "confirmed");
    if (!accountInfo) {
      return {
        vaultAddress: vaultPublicKey.toBase58(),
        exists: false,
        owner: null,
        isLocked: false,
        lockedLamports: 0,
        balanceSol: 0,
        accountLamports: 0,
      };
    }

    const vault = parseRedemptionVaultAccountData(Buffer.from(accountInfo.data));
    return {
      vaultAddress: vaultPublicKey.toBase58(),
      exists: true,
      owner: vault.owner.toBase58(),
      isLocked: vault.isLocked,
      lockedLamports: vault.lockedLamports,
      balanceSol: vault.lockedLamports / LAMPORTS_PER_SOL,
      accountLamports: accountInfo.lamports,
    };
  }, [connection, publicKey]);

  const redeemVault = useCallback(async () => {
    if (!publicKey) throw new Error("Wallet not connected");

    const vault = await getRedemptionVaultInfo();
    if (!vault.exists) throw new Error("Redemption vault not found");

    const vaultPublicKey = new PublicKey(vault.vaultAddress);
    const instruction = new TransactionInstruction({
      programId: D_ARENA_PROGRAM_ID,
      keys: [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultPublicKey, isSigner: false, isWritable: true },
        {
          pubkey: SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
      ],
      data: REDEEM_VAULT_DISCRIMINATOR,
    });

    setSending(true);
    try {
      const transaction = new Transaction().add(instruction);
      const latestBlockhash =
        await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = publicKey;

      const simulation = await connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        console.error("redeemVault simulation logs", simulation.value.logs ?? []);
        throw new Error(formatSimulationError(simulation.value));
      }

      const txSignature = await transact(async (wallet: Web3MobileWallet) => {
        await authorizeWalletSession(wallet, publicKey.toBase58());
        const signatures = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });
        return normalizeSignature(signatures[0]);
      });

      await connection.confirmTransaction(
        {
          signature: txSignature,
          blockhash: latestBlockhash.blockhash,
          lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        },
        "confirmed",
      );

      return {
        signature: txSignature,
        vaultAddress: vault.vaultAddress,
        redeemedLamports: vault.lockedLamports,
        redeemedSol: vault.balanceSol,
      };
    } finally {
      setSending(false);
    }
  }, [authorizeWalletSession, connection, getRedemptionVaultInfo, publicKey]);

  const sendSOL = useCallback(
    async (toAddress: string, amountSOL: number) => {
      if (!publicKey) throw new Error("Wallet not connected");

      setSending(true);
      try {
        const toPublicKey = new PublicKey(toAddress);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPublicKey,
            lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
          }),
        );

        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const txSignature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());

          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });

          return signatures[0];
        });

        return txSignature;
      } finally {
        setSending(false);
      }
    },
    [authorizeWalletSession, publicKey, connection],
  );

  const createDuel = useCallback(
    async ({
      stakeAmountSol,
      startTimeMs,
      endTimeMs,
      duelNonce,
    }: CreateOnChainDuelInput) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (stakeAmountSol <= 0)
        throw new Error("Stake amount must be greater than zero");

      const nonce = duelNonce ?? generateDuelNonce();
      const stakeLamports = Math.round(stakeAmountSol * LAMPORTS_PER_SOL);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const requestedStartSeconds = Math.floor(startTimeMs / 1000);
      const startTimeSeconds = Math.max(
        requestedStartSeconds,
        nowSeconds + CREATE_DUEL_MIN_START_OFFSET_SECONDS,
      );
      const requestedEndSeconds = endTimeMs
        ? Math.floor(endTimeMs / 1000)
        : startTimeSeconds + DEFAULT_DUEL_DURATION_SECONDS;
      const endTimeSeconds = Math.max(
        requestedEndSeconds,
        startTimeSeconds + 60,
      );
      if (endTimeSeconds <= startTimeSeconds) {
        throw new Error("End time must be after start time");
      }
      const duelNonceBuffer = writeUInt64LE(nonce);

      const [duelPda] = PublicKey.findProgramAddressSync(
        [DUEL_SEED, publicKey.toBuffer(), duelNonceBuffer],
        D_ARENA_PROGRAM_ID,
      );
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [ESCROW_SEED, duelPda.toBuffer()],
        D_ARENA_PROGRAM_ID,
      );

      const instructionData = Buffer.concat([
        CREATE_DUEL_DISCRIMINATOR,
        duelNonceBuffer,
        writeUInt64LE(stakeLamports),
        writeUInt64LE(startTimeSeconds),
        writeUInt64LE(endTimeSeconds),
      ]);

      const instruction = new TransactionInstruction({
        programId: D_ARENA_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: duelPda, isSigner: false, isWritable: true },
          { pubkey: escrowPda, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: instructionData,
      });

      setSending(true);
      try {
        const transaction = new Transaction().add(instruction);
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;
        const [
          balanceLamports,
          duelRentLamports,
          escrowRentLamports,
          simulation,
        ] = await Promise.all([
          connection.getBalance(publicKey, "confirmed"),
          connection.getMinimumBalanceForRentExemption(
            DUEL_ACCOUNT_SPACE,
            "confirmed",
          ),
          connection.getMinimumBalanceForRentExemption(0, "confirmed"),
          connection.simulateTransaction(transaction),
        ]);

        const minimumNeededLamports =
          stakeLamports +
          duelRentLamports +
          escrowRentLamports +
          DEFAULT_FEE_LAMPORTS;
        if (balanceLamports < minimumNeededLamports) {
          throw new Error(
            `Insufficient balance. Need at least ${(minimumNeededLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL including rent and fees, wallet has ${(balanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.`,
          );
        }

        if (simulation.value.err) {
          console.error(
            "createDuel simulation logs",
            simulation.value.logs ?? [],
          );
          throw new Error(formatSimulationError(simulation.value));
        }

        const signature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());

          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });

          return normalizeSignature(signatures[0]);
        });

        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        return {
          signature,
          duelNonce: nonce.toString(),
          duelAddress: duelPda.toBase58(),
          escrowAddress: escrowPda.toBase58(),
          programId: D_ARENA_PROGRAM_ID.toBase58(),
          startTimeSeconds: String(startTimeSeconds),
          endTimeSeconds: String(endTimeSeconds),
          stakeLamports: String(stakeLamports),
        };
      } finally {
        setSending(false);
      }
    },
    [authorizeWalletSession, connection, publicKey],
  );

  const joinDuel = useCallback(
    async ({ duelAddress, escrowAddress }: JoinOnChainDuelInput) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const duelPublicKey = new PublicKey(duelAddress);
      const derivedEscrow = PublicKey.findProgramAddressSync(
        [ESCROW_SEED, duelPublicKey.toBuffer()],
        D_ARENA_PROGRAM_ID,
      )[0];
      const escrowPublicKey = escrowAddress
        ? new PublicKey(escrowAddress)
        : derivedEscrow;

      if (!escrowPublicKey.equals(derivedEscrow)) {
        throw new Error("Escrow address does not match duel PDA");
      }

      const instruction = new TransactionInstruction({
        programId: D_ARENA_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: duelPublicKey, isSigner: false, isWritable: true },
          { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: JOIN_DUEL_DISCRIMINATOR,
      });

      setSending(true);
      try {
        const transaction = new Transaction().add(instruction);
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error(
            "joinDuel simulation logs",
            simulation.value.logs ?? [],
          );
          throw new Error(formatSimulationError(simulation.value));
        }

        const signature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());

          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });

          return normalizeSignature(signatures[0]);
        });

        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        return {
          signature,
          duelAddress: duelPublicKey.toBase58(),
          escrowAddress: escrowPublicKey.toBase58(),
          programId: D_ARENA_PROGRAM_ID.toBase58(),
        };
      } finally {
        setSending(false);
      }
    },
    [authorizeWalletSession, connection, publicKey],
  );

  const cancelDuel = useCallback(
    async ({ duelAddress, escrowAddress }: CancelOnChainDuelInput) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const duelPublicKey = new PublicKey(duelAddress);
      const derivedEscrow = PublicKey.findProgramAddressSync(
        [ESCROW_SEED, duelPublicKey.toBuffer()],
        D_ARENA_PROGRAM_ID,
      )[0];
      const escrowPublicKey = escrowAddress
        ? new PublicKey(escrowAddress)
        : derivedEscrow;

      if (!escrowPublicKey.equals(derivedEscrow)) {
        throw new Error("Escrow address does not match duel PDA");
      }

      const instruction = new TransactionInstruction({
        programId: D_ARENA_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: duelPublicKey, isSigner: false, isWritable: true },
          { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: CANCEL_DUEL_DISCRIMINATOR,
      });

      setSending(true);
      try {
        const transaction = new Transaction().add(instruction);
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("cancelDuel simulation logs", simulation.value.logs ?? []);
          throw new Error(formatSimulationError(simulation.value));
        }

        const signature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());
          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });
          return normalizeSignature(signatures[0]);
        });

        await connection.confirmTransaction(
          {
            signature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        return {
          signature,
          duelAddress: duelPublicKey.toBase58(),
          escrowAddress: escrowPublicKey.toBase58(),
          programId: D_ARENA_PROGRAM_ID.toBase58(),
        };
      } finally {
        setSending(false);
      }
    },
    [authorizeWalletSession, connection, publicKey],
  );

  const initializeProgramConfig = useCallback(
    async ({
      backendPubkey,
      treasuryAddress,
      feeBps,
    }: InitializeProgramConfigInput) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const [configPublicKey] = PublicKey.findProgramAddressSync(
        [CONFIG_SEED],
        D_ARENA_PROGRAM_ID,
      );
      const [programDataPublicKey] = PublicKey.findProgramAddressSync(
        [D_ARENA_PROGRAM_ID.toBytes()],
        BPF_UPGRADEABLE_LOADER_PROGRAM_ID,
      );

      const backendBytes = bs58.decode(backendPubkey);
      if (backendBytes.length !== 32) {
        throw new Error("Backend signer pubkey must be 32 bytes");
      }

      const feeBuffer = Buffer.alloc(2);
      feeBuffer.writeUInt16LE(feeBps, 0);

      const instruction = new TransactionInstruction({
        programId: D_ARENA_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: configPublicKey, isSigner: false, isWritable: true },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: D_ARENA_PROGRAM_ID, isSigner: false, isWritable: false },
          { pubkey: programDataPublicKey, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([
          INITIALIZE_CONFIG_DISCRIMINATOR,
          Buffer.from(backendBytes),
          new PublicKey(treasuryAddress).toBuffer(),
          feeBuffer,
        ]),
      });

      setSending(true);
      try {
        const transaction = new Transaction().add(instruction);
        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error(
            "initializeProgramConfig simulation logs",
            simulation.value.logs ?? [],
          );
          throw new Error(formatSimulationError(simulation.value));
        }

        const txSignature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());
          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });
          return normalizeSignature(signatures[0]);
        });

        await connection.confirmTransaction(
          {
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        return {
          signature: txSignature,
          configAddress: configPublicKey.toBase58(),
          programId: D_ARENA_PROGRAM_ID.toBase58(),
        };
      } finally {
        setSending(false);
      }
    },
    [authorizeWalletSession, connection, publicKey],
  );

  const getDuelSettlementContext = useCallback(
    async (duelAddress: string) => {
      const duelAccountInfo = await connection.getAccountInfo(
        new PublicKey(duelAddress),
        "confirmed",
      );
      if (!duelAccountInfo) throw new Error("On-chain duel account not found");

      const duel = parseDuelAccountData(Buffer.from(duelAccountInfo.data));
      return {
        duelId: duel.duelId,
        settlementNonce: duel.settlementNonce,
      };
    },
    [connection],
  );

  const settleDuel = useCallback(
    async ({
      duelAddress,
      resultByte,
      message,
      signature,
    }: SettleOnChainDuelInput) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const duelPublicKey = new PublicKey(duelAddress);
      const duelAccountInfo = await connection.getAccountInfo(
        duelPublicKey,
        "confirmed",
      );
      if (!duelAccountInfo) throw new Error("On-chain duel account not found");

      const duel = parseDuelAccountData(Buffer.from(duelAccountInfo.data));
      if (!duel.opponent) throw new Error("Opponent account missing on-chain");

      const [escrowPublicKey] = PublicKey.findProgramAddressSync(
        [ESCROW_SEED, duelPublicKey.toBuffer()],
        D_ARENA_PROGRAM_ID,
      );
      const [configPublicKey] = PublicKey.findProgramAddressSync(
        [CONFIG_SEED],
        D_ARENA_PROGRAM_ID,
      );
      console.log({ configPublicKey });

      const configAccountInfo = await connection.getAccountInfo(
        configPublicKey,
        "confirmed",
      );
      if (!configAccountInfo) {
        throw new Error(
          `On-chain config account not found on ${cluster}. Run initialize_config for PDA ${configPublicKey.toBase58()} on this network first.`,
        );
      }
      const config = parseConfigAccountData(
        Buffer.from(configAccountInfo.data),
      );

      const [creatorVault] = PublicKey.findProgramAddressSync(
        [VAULT_SEED, duel.creator.toBuffer()],
        D_ARENA_PROGRAM_ID,
      );
      const [opponentVault] = PublicKey.findProgramAddressSync(
        [VAULT_SEED, duel.opponent.toBuffer()],
        D_ARENA_PROGRAM_ID,
      );

      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
        publicKey: config.backendPubkey,
        message: bs58.decode(message),
        signature: bs58.decode(signature),
      });

      const settleIx = new TransactionInstruction({
        programId: D_ARENA_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: duelPublicKey, isSigner: false, isWritable: true },
          { pubkey: configPublicKey, isSigner: false, isWritable: false },
          { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
          { pubkey: duel.creator, isSigner: false, isWritable: true },
          { pubkey: duel.opponent, isSigner: false, isWritable: true },
          { pubkey: creatorVault, isSigner: false, isWritable: true },
          { pubkey: opponentVault, isSigner: false, isWritable: true },
          { pubkey: config.treasury, isSigner: false, isWritable: true },
          {
            pubkey: SYSVAR_INSTRUCTIONS_PUBKEY,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        data: Buffer.concat([
          SETTLE_DUEL_DISCRIMINATOR,
          Buffer.from([resultByte]),
        ]),
      });

      setSending(true);
      try {
        const transaction = new Transaction()
          .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
          .add(ed25519Ix)
          .add(settleIx);

        const latestBlockhash =
          await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error(
            "settleDuel simulation failed",
            {
              err: simulation.value.err,
              logs: simulation.value.logs ?? [],
              duelAddress: duelPublicKey.toBase58(),
              configAddress: configPublicKey.toBase58(),
              escrowAddress: escrowPublicKey.toBase58(),
              creatorVault: creatorVault.toBase58(),
              opponentVault: opponentVault.toBase58(),
              treasuryAddress: config.treasury.toBase58(),
            },
          );
          throw new Error(describeSettlementSimulationFailure(simulation.value));
        }

        const txSignature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());
          const signatures = await wallet.signAndSendTransactions({
            transactions: [transaction],
          });
          return normalizeSignature(signatures[0]);
        });

        await connection.confirmTransaction(
          {
            signature: txSignature,
            blockhash: latestBlockhash.blockhash,
            lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
          },
          "confirmed",
        );

        return {
          signature: txSignature,
          duelAddress: duelPublicKey.toBase58(),
          programId: D_ARENA_PROGRAM_ID.toBase58(),
        };
      } finally {
        setSending(false);
      }
    },
    [authorizeWalletSession, cluster, connection, publicKey],
  );

  return {
    publicKey,
    connected: !!storedPublicKey,
    connecting,
    sending,
    connect,
    disconnect,
    getBalance,
    sendSOL,
    createDuel,
    joinDuel,
    cancelDuel,
    initializeProgramConfig,
    getDuelSettlementContext,
    settleDuel,
    getRedemptionVaultInfo,
    redeemVault,
    connection,
  };
}
