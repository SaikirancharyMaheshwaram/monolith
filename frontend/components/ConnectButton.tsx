import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C } from "./lobby-theme";

interface Props {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  onConnect: () => Promise<unknown> | unknown;
  onDisconnect: () => void;
}

export function ConnectButton({
  connected,
  connecting,
  publicKey,
  onConnect,
  onDisconnect,
}: Props) {
  const handleConnectPress = () => {
    Promise.resolve(onConnect()).catch((error) => {
      console.error("Wallet connect action failed:", error);
    });
  };

  if (connecting) {
    return (
      <View style={[styles.button, styles.connecting]}>
        <ActivityIndicator size="small" color={C.white} />
        <Text style={styles.buttonText}>Connecting...</Text>
      </View>
    );
  }

  if (connected && publicKey) {
    return (
      <TouchableOpacity
        style={[styles.button, styles.connected]}
        onPress={onDisconnect}
      >
        <Ionicons name="wallet" size={18} color={C.success} />
        <Text style={styles.connectedText}>
          {publicKey.slice(0, 4)}...{publicKey.slice(-4)}
        </Text>
        <Ionicons name="close-circle-outline" size={16} color={C.slate500} />
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, styles.disconnected]}
      onPress={handleConnectPress}
    >
      <Ionicons name="wallet-outline" size={18} color="#fff" />
      <Text style={styles.buttonText}>Connect Wallet</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  disconnected: {
    backgroundColor: C.mana,
    borderWidth: 1,
    borderColor: "#ffc56d",
  },
  connected: {
    backgroundColor: "rgba(255,210,111,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,210,111,0.4)",
  },
  connecting: {
    backgroundColor: C.slate700,
  },
  buttonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
  connectedText: {
    color: C.success,
    fontSize: 13,
    fontWeight: "600",
    fontFamily: "monospace",
  },
});
