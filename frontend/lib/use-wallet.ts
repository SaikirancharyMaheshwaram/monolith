import { useState, useCallback } from "react";
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
import { useWalletStore } from "@/stores/use-wallet-store";
import { ConvexReactClient, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import bs58 from "bs58";
import { saveToken } from "./token";

const APP_IDENTITY = {
  name: "SolScan",
  uri: "https://solscan.io",
  icon: "favicon.ico",
};

export function useWallet() {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [sending, setSending] = useState(false);
  const isDevnet = useWalletStore((s) => s.isDevnet);

  const cluster = isDevnet ? "devnet" : "mainnet-beta";
  const requestNonce = useMutation(api.auth.requestNonce);
  const verifyWallet = useMutation(api.auth.verifyWallet);
  const connection = new Connection(clusterApiUrl(cluster), "confirmed");

  // ============================================
  // CONNECT — Ask Phantom to authorize our app
  // ============================================
  // const connect = useCallback(async () => {
  //   setConnecting(true);
  //   try {
  //     const authResult = await transact(async (wallet: Web3MobileWallet) => {
  //       // This opens Phantom, shows an "Authorize" dialog
  //       // User taps "Approve" → we get their public key
  //       const result = await wallet.authorize({
  //         chain: `solana:${cluster}`,
  //         identity: APP_IDENTITY,
  //       });
  //       return result;
  //     });

  //     // authResult.accounts[0].address is a base64 public key
  //     const pubkey = new PublicKey(
  //       Buffer.from(authResult.accounts[0].address, "base64"),
  //     );
  //     setPublicKey(pubkey);
  //     await loginWithBackend(pubkey);
  //     return pubkey;
  //   } catch (error: any) {
  //     console.error("Connect failed:", error);
  //     throw error;
  //   } finally {
  //     setConnecting(false);
  //   }
  // }, [cluster]);

  const connect = useCallback(async () => {
    setConnecting(true);

    try {
      // ------------------------------------------
      // 1️⃣ First transact session → AUTHORIZE
      // ------------------------------------------
      // Mobile Wallet Adapter sessions are NOT persistent.
      // Each transact call is isolated.
      // So we must authorize inside each transact block.
      const authResult = await transact(async (wallet: Web3MobileWallet) => {
        return await wallet.authorize({
          chain: `solana:${cluster}`,
          identity: APP_IDENTITY,
        });
      });

      const pubkey = new PublicKey(
        Buffer.from(authResult.accounts[0].address, "base64"),
      );

      setPublicKey(pubkey);

      const walletAddress = pubkey.toBase58();

      // ------------------------------------------
      // 2️⃣ Request nonce (OUTSIDE transact)
      // ------------------------------------------
      // NEVER call backend inside transact.
      // Keep transact short and wallet-only.
      const nonce = await requestNonce({ walletAddress });

      const message = `Discipline Arena Login\nNonce: ${nonce}`;
      const encodedMessage = new TextEncoder().encode(message);

      // ------------------------------------------
      // 3️⃣ Second transact session → AUTHORIZE + SIGN
      // ------------------------------------------
      // auth_token is valid ONLY within a transact session.
      // So we must re-authorize before signing.
      const signatures = await transact(async (wallet: Web3MobileWallet) => {
        await wallet.authorize({
          chain: `solana:${cluster}`,
          identity: APP_IDENTITY,
        });

        return await wallet.signMessages({
          addresses: [walletAddress],
          payloads: [encodedMessage],
        });
      });

      // signatures[0] is Uint8Array
      const signatureBase58 = bs58.encode(signatures[0]);

      // ------------------------------------------
      // 4️⃣ Verify signature with backend
      // ------------------------------------------
      const { token } = await verifyWallet({
        walletAddress,
        nonce,
        signature: signatureBase58,
      });

      // ------------------------------------------
      // 5️⃣ Store JWT securely
      // ------------------------------------------
      await saveToken(token);

      // ------------------------------------------
      // 6️⃣ Update authentication state
      // ------------------------------------------
      useWalletStore.getState().setAuthenticated(true);

      return pubkey;
    } catch (error) {
      console.error("Connect/Login failed:", error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [cluster, requestNonce, verifyWallet]);

  // const loginWithBackend = async (pubkey: PublicKey) => {
  //   const walletAddress = pubkey.toBase58();

  //   // 1️⃣ Request nonce
  //   const nonce = await requestNonce({
  //     walletAddress,
  //   });

  //   // 2️⃣ Construct EXACT same message backend verifies
  //   const message = `Discipline Arena Login\nNonce: ${nonce}`;
  //   const encodedMessage = new TextEncoder().encode(message);

  //   // 3️⃣ Ask wallet to sign
  //   const signatures = await transact(async (wallet: Web3MobileWallet) => {
  //     await wallet.authorize({
  //       chain: `solana:${cluster}`,
  //       identity: {
  //         name: "Discipline Arena",
  //         uri: "https://disciplinearena.app",
  //         icon: "favicon.ico",
  //       },
  //     });

  //     return await wallet.signMessages({
  //       addresses: [walletAddress], // required
  //       payloads: [encodedMessage], // required
  //     });
  //   });

  //   // 4️⃣ signatures[0] is Uint8Array
  //   const signatureBase58 = bs58.encode(signatures[0]);

  //   // 5️⃣ Send to backend
  //   const { token } = await verifyWallet({
  //     walletAddress,
  //     nonce,
  //     signature: signatureBase58,
  //   });

  //   // 6️⃣ Store token securely
  //   await saveToken(token);

  //   // 7️⃣ Update Zustand auth state
  //   useWalletStore.getState().setAuthenticated(true);

  //   return token;
  // };

  // ============================================
  // DISCONNECT
  // ============================================
  const disconnect = useCallback(() => {
    setPublicKey(null);
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
          // Re-authorize (Phantom needs this each session)
          await wallet.authorize({
            chain: `solana:${cluster}`,
            identity: APP_IDENTITY,
          });

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
    [publicKey, connection, cluster],
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
    // loginWithBackend,
  };
}
