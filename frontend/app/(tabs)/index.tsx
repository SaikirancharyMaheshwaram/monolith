import { Image } from "expo-image";
import { Platform, StyleSheet, Text, View } from "react-native";

import { HelloWave } from "@/components/hello-wave";
import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Link } from "expo-router";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useWalletStore } from "@/stores/use-wallet-store";
import { useWallet } from "@/lib/use-wallet";
import { ConnectButton } from "@/components/ConnectButton";
export default function HomeScreen() {
  const isDevnet = useWalletStore((s) => s.isDevnet);

  const RPC = isDevnet
    ? "https://api.devnet.solana.com"
    : "https://api.mainnet-beta.solana.com";
  const wallet = useWallet();

  return (
    <SafeAreaView style={{ paddingHorizontal: 10 }}>
      <ThemedText>Hello</ThemedText>
      {isDevnet && (
        <ThemedView>
          <ThemedText>🔧 DEVNET</ThemedText>
          <ConnectButton
            connected={wallet.connected}
            connecting={wallet.connecting}
            publicKey={wallet.publicKey?.toBase58() ?? null}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </ThemedView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
});
