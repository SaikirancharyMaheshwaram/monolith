import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { useWalletStore } from "@/stores/use-wallet-store";
import { useWallet } from "@/lib/use-wallet";
import { getToken } from "@/lib/token";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ThemedText } from "@/components/themed-text";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const status = useWalletStore((s) => s.status);
  const setStatus = useWalletStore((s) => s.setStatus);
  const router = useRouter();

  const wallet = useWallet();

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Discipline Arena</Text>

      <Text>Status: {status}</Text>

      <Text>Wallet: {wallet.publicKey?.toBase58() ?? "Not Connected"}</Text>

      <View style={{ height: 20 }} />

      <Button
        title={wallet.connected ? "Disconnect Wallet" : "Connect Wallet"}
        onPress={wallet.connected ? wallet.disconnect : wallet.connect}
      />

      <Text style={{ height: 20 }} />

      <Button title="Create Duel" onPress={() => router.push("/create")} />
      <View style={{ height: 20 }} />
      {/*<Button title="Join Duel" onPress={() => router.push("/join")} />
      <View style={{ height: 20 }} />
      <Button title="Open Duel" onPress={() => router.push("/duel")} />*/}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    marginBottom: 20,
  },
});

// import { Image } from "expo-image";
// import { Platform, StyleSheet, Text, View } from "react-native";

// import { HelloWave } from "@/components/hello-wave";
// import ParallaxScrollView from "@/components/parallax-scroll-view";
// import { Text } from "@/components/themed-text";
// import { ThemedView } from "@/components/themed-view";
// import { Link } from "expo-router";
// import { api } from "@/convex/_generated/api";
// import { useQuery } from "convex/react";
// import { SafeAreaView } from "react-native-safe-area-context";
// import { useWalletStore } from "@/stores/use-wallet-store";
// import { useWallet } from "@/lib/use-wallet";
// import { ConnectButton } from "@/components/ConnectButton";
// export default function HomeScreen() {
//   const isDevnet = useWalletStore((s) => s.isDevnet);
//   const status = useWalletStore((s) => s.status);

//   const RPC = isDevnet
//     ? "https://api.devnet.solana.com"
//     : "https://api.mainnet-beta.solana.com";
//   const wallet = useWallet();

//   return (
//     <SafeAreaView style={{ paddingHorizontal: 10 }}>
//       <ThemedText>Status:{status}</ThemedText>
//       {isDevnet && (
//         <ThemedView>
//           <ThemedText>🔧 DEVNET</ThemedText>
//           <ConnectButton
//             connected={wallet.connected}
//             connecting={wallet.connecting}
//             publicKey={wallet.publicKey?.toBase58() ?? null}
//             onConnect={wallet.connect}
//             onDisconnect={wallet.disconnect}
//           />
//         </ThemedView>
//       )}
//     </SafeAreaView>
//   );
// }

// const styles = StyleSheet.create({
//   titleContainer: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: 8,
//   },
//   stepContainer: {
//     gap: 8,
//     marginBottom: 8,
//   },
//   reactLogo: {
//     height: 178,
//     width: 290,
//     bottom: 0,
//     left: 0,
//     position: "absolute",
//   },
// });
