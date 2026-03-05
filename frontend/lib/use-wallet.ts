import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import {
  transact,
  Web3MobileWallet,
} from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import bs58 from "bs58";
import { clearToken, saveToken } from "./token";
import { useWalletStore } from "@/stores/use-wallet-store";

const APP_IDENTITY = {
  name: "SolScan",
  uri: "https://solscan.io",
  icon: "favicon.ico",
};

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

export function useWallet() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const isDevnet = useWalletStore((s) => s.isDevnet);
  const authTokenRef = useRef<string | null>(null);
  const connectingRef = useRef(false);

  const cluster = isDevnet ? "devnet" : "mainnet-beta";
  const requestNonce = useMutation(api.auth.requestNonce);
  const verifyWallet = useMutation(api.auth.verifyWallet);
  const user = useQuery(api.users.getUserByWallet.getUserByWallet, {
    walletAddress: publicKey?.toString() ?? "",
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
          // Token can expire; fallback to fresh authorize below.
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
    if (publicKey) {
      if (user) {
        useWalletStore.getState().setStatus("authenticated");
      } else {
        useWalletStore.getState().setStatus("onboarding");
      }
    }
  }, [publicKey, user]);

  const connect = useCallback(async () => {
    setConnecting(true);
    try {
      const authResult = await transact(async (wallet: Web3MobileWallet) => {
        // This opens Phantom, shows an "Authorize" dialog
        // User taps "Approve" → we get their public key
        const result = await wallet.authorize({
          chain: `solana:${cluster}`,
          identity: APP_IDENTITY,
        });
        return result;
      });

      // authResult.accounts[0].address is a base64 public key
      const pubkey = new PublicKey(
        Buffer.from(authResult.accounts[0].address, "base64"),
      );
      setPublicKey(pubkey);

      // setStatus("connected");
      useWalletStore.getState().setPublicKey(pubkey);
      return pubkey;
    } catch (error: any) {
      console.error("Connect failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster]);
  // ============================================
  // DISCONNECT
  // ============================================
  const disconnect = useCallback(() => {
    setPublicKey(null);
    authTokenRef.current = null;
    useWalletStore.getState().setStatus("public");
    void clearToken();
  }, []);

  // ============================================
  // GET BALANCE
  // ============================================
  const getBalance = useCallback(async () => {
    if (!publicKey) return 0;
    const balance = await connection.getBalance(publicKey);
    return balance / LAMPORTS_PER_SOL;
  }, [publicKey, connection]);

  // ============================================
  // SEND SOL — Build, sign, and send a transaction
  // ============================================
  const sendSOL = useCallback(
    async (toAddress: string, amountSOL: number) => {
      if (!publicKey) throw new Error("Wallet not connected");

      setSending(true);
      try {
        // Step 1: Build the transaction
        const toPublicKey = new PublicKey(toAddress);
        const transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: toPublicKey,
            lamports: Math.round(amountSOL * LAMPORTS_PER_SOL),
          }),
        );

        // Step 2: Get recent blockhash (needed for transaction)
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Step 3: Send to Phantom for signing + submission
        const txSignature = await transact(async (wallet: Web3MobileWallet) => {
          await authorizeWalletSession(wallet, publicKey.toBase58());

          // Sign and send — Phantom shows the transaction details
          // User approves → Phantom signs → sends to network
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

  return {
    publicKey,
    connected: !!publicKey,
    connecting,
    sending,
    connect,
    disconnect,
    getBalance,
    sendSOL,

    connection,
  };
}
