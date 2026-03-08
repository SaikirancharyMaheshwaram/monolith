import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import bs58 from "bs58";
import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  type SimulatedTransactionResponse,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { clearToken } from "./token";
import { useWalletStore } from "@/stores/use-wallet-store";

const APP_IDENTITY = {
  name: "SolScan",
  uri: "https://solscan.io",
  icon: "favicon.ico",
};

const D_ARENA_PROGRAM_ID = new PublicKey(
  "EJUzdHnJDy9QEVpWCYcbFoZzXbQWanzKLYJdAYkrqJNM",
);
const CREATE_DUEL_DISCRIMINATOR = Buffer.from([49, 28, 93, 11, 75, 242, 69, 165]);
const JOIN_DUEL_DISCRIMINATOR = Buffer.from([7, 247, 76, 103, 101, 139, 254, 61]);
const DUEL_SEED = Buffer.from("duel");
const ESCROW_SEED = Buffer.from("escrow");
const DUEL_DURATION_SECONDS = 7 * 24 * 60 * 60;
const CREATE_DUEL_MIN_START_OFFSET_SECONDS = 60;
const DUEL_ACCOUNT_SPACE = 157;
const DEFAULT_FEE_LAMPORTS = 10_000;

type CreateOnChainDuelInput = {
  stakeAmountSol: number;
  startTimeMs: number;
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

type WalletHook = {
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  sending: boolean;
  connect: () => Promise<PublicKey>;
  disconnect: () => void;
  getBalance: () => Promise<number>;
  sendSOL: (toAddress: string, amountSOL: number) => Promise<string>;
  createDuel: (input: CreateOnChainDuelInput) => Promise<CreateOnChainDuelResult>;
  joinDuel: (input: JoinOnChainDuelInput) => Promise<JoinOnChainDuelResult>;
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

  const errText = simulation.err ? JSON.stringify(simulation.err) : "Transaction simulation failed";
  return logs ? `${errText}\n${logs}` : errText;
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

  const authTokenRef = useRef<string | null>(null);

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
      if (authTokenRef.current) {
        try {
          const reauth = await wallet.reauthorize({
            auth_token: authTokenRef.current,
            identity: APP_IDENTITY,
          });
          authTokenRef.current = reauth.auth_token;
          return reauth;
        } catch (error) {
          if (isWalletRequestDeclined(error)) throw error;
          authTokenRef.current = null;
        }
      }

      const auth = await wallet.authorize({
        chain: `solana:${cluster}`,
        identity: APP_IDENTITY,
        ...(address ? { addresses: [address] } : {}),
      });
      authTokenRef.current = auth.auth_token;
      return auth;
    },
    [cluster],
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
  }, [cluster, setStoredPublicKey]);

  const disconnect = useCallback(() => {
    setStoredPublicKey(null);
    authTokenRef.current = null;
    useWalletStore.getState().setStatus("public");
    void clearToken();
  }, [setStoredPublicKey]);

  const getBalance = useCallback(async () => {
    if (!publicKey) return 0;
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [publicKey, connection]);

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
    async ({ stakeAmountSol, startTimeMs, duelNonce }: CreateOnChainDuelInput) => {
      if (!publicKey) throw new Error("Wallet not connected");
      if (stakeAmountSol <= 0) throw new Error("Stake amount must be greater than zero");

      const nonce = duelNonce ?? generateDuelNonce();
      const stakeLamports = Math.round(stakeAmountSol * LAMPORTS_PER_SOL);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const requestedStartSeconds = Math.floor(startTimeMs / 1000);
      const startTimeSeconds = Math.max(
        requestedStartSeconds,
        nowSeconds + CREATE_DUEL_MIN_START_OFFSET_SECONDS,
      );
      const endTimeSeconds = startTimeSeconds + DUEL_DURATION_SECONDS;
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
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: instructionData,
      });

      setSending(true);
      try {
        const transaction = new Transaction().add(instruction);
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;
        const [balanceLamports, duelRentLamports, escrowRentLamports, simulation] = await Promise.all([
          connection.getBalance(publicKey, "confirmed"),
          connection.getMinimumBalanceForRentExemption(DUEL_ACCOUNT_SPACE, "confirmed"),
          connection.getMinimumBalanceForRentExemption(0, "confirmed"),
          connection.simulateTransaction(transaction),
        ]);

        const minimumNeededLamports =
          stakeLamports + duelRentLamports + escrowRentLamports + DEFAULT_FEE_LAMPORTS;
        if (balanceLamports < minimumNeededLamports) {
          throw new Error(
            `Insufficient balance. Need at least ${(minimumNeededLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL including rent and fees, wallet has ${(balanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL.`,
          );
        }

        if (simulation.value.err) {
          console.error("createDuel simulation logs", simulation.value.logs ?? []);
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
      const escrowPublicKey = escrowAddress ? new PublicKey(escrowAddress) : derivedEscrow;

      if (!escrowPublicKey.equals(derivedEscrow)) {
        throw new Error("Escrow address does not match duel PDA");
      }

      const instruction = new TransactionInstruction({
        programId: D_ARENA_PROGRAM_ID,
        keys: [
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: duelPublicKey, isSigner: false, isWritable: true },
          { pubkey: escrowPublicKey, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data: JOIN_DUEL_DISCRIMINATOR,
      });

      setSending(true);
      try {
        const transaction = new Transaction().add(instruction);
        const latestBlockhash = await connection.getLatestBlockhash("confirmed");
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = publicKey;

        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          console.error("joinDuel simulation logs", simulation.value.logs ?? []);
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
    connection,
  };
}
