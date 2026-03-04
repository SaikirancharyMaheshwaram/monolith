import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, StyleSheet, Alert } from "react-native";
import { useWalletStore } from "@/stores/use-wallet-store";
import { useWallet } from "@/lib/use-wallet";
import { getToken } from "@/lib/token";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function HomeScreen() {
  const status = useWalletStore((s) => s.status);
  const setStatus = useWalletStore((s) => s.setStatus);

  const wallet = useWallet();

  const testProtected = useMutation(api.test.protectedTest);

  const handleProtectedAction = async () => {
    try {
      // 1️⃣ Not connected
      if (!wallet.connected) {
        Alert.alert("Wallet not connected", "Connecting...");
        await wallet.connect();
        return;
      }

      // 2️⃣ Connected but not authenticated
      if (status !== "authenticated") {
        Alert.alert("Signing Required", "Signing in...");
        await wallet.signInWithWallet();
        return;
      }

      // 3️⃣ Authenticated → Call protected mutation
      const token = await getToken();

      if (!token) {
        throw new Error("No token found");
      }

      const result = await testProtected({ token });

      console.log("Protected Result:", result);

      Alert.alert(
        "Success",
        `User: ${result.userId}\nWallet: ${result.wallet}`
      );
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", err.message || "Something failed");
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Discipline Arena</Text>

      <Text>Status: {status}</Text>

      <Text>
        Wallet: {wallet.publicKey?.toBase58() ?? "Not Connected"}
      </Text>

      <View style={{ height: 20 }} />

      <Button
        title={
          wallet.connected
            ? "Disconnect Wallet"
            : "Connect Wallet"
        }
        onPress={
          wallet.connected
            ? wallet.disconnect
            : wallet.connect
        }
      />

      <View style={{ height: 20 }} />

      <Button
        title="Create Duel (Protected Test)"
        onPress={handleProtectedAction}
      />
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
// import { ThemedText } from "@/components/themed-text";
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
