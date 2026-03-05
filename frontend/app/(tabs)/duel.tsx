import {
  View,
  Text,
  Button,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWalletStore } from "@/stores/use-wallet-store";
import { SafeAreaView } from "react-native-safe-area-context";

// Helper: format time remaining
const formatTimeRemaining = (endTime?: number) => {
  if (!endTime) return "—";
  const now = Date.now();
  const remaining = endTime - now;
  if (remaining <= 0) return "Ended";

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
};

// Helper: get status badge styles
const getStatusStyle = (status: string) => {
  const styles: Record<string, { bg: string; text: string }> = {
    CREATED: { bg: "#e0e7ff", text: "#3730a3" },
    OPEN: { bg: "#fef3c7", text: "#92400e" },
    ACTIVE: { bg: "#dcfce7", text: "#166534" },
    COMPLETED: { bg: "#f3e8ff", text: "#6b21a8" },
    RESOLVED: { bg: "#dbeafe", text: "#1e40af" },
    CANCELLED: { bg: "#fee2e2", text: "#991b1b" },
  };
  return styles[status] || { bg: "#f3f4f6", text: "#374151" };
};

export default function DuelScreen() {
  const submitCompletion = useMutation(
    api.duels.submitCompletion.submitCompletion,
  );
  const computeOutcome = useMutation(api.duels.computeOutcome.computeOutcome);
  const cancelDuel = useMutation(api.duels.cancelOpenDuel.cancelOpenDuel);

  const duelId = "jh717jr3y0tb8h0pw41m0cz5xs82b52y" as Id<"duels">;
  const walletAddress = useWalletStore((s) => s.publicKey);

  // Fetch user & duel in parallel
  const user = useQuery(api.users.getUserByWallet.getUserByWallet, {
    walletAddress: walletAddress?.toString()!,
  });
  const duel = useQuery(api.duels.getDuelById.getDuelById, { id: duelId }); // ✅ You'll need this query

  // Loading states
  if (user === undefined || duel === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.loadingText}>Loading duel…</Text>
      </View>
    );
  }

  if (user === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>User not found</Text>
        <Text style={styles.hint}>Please connect your wallet</Text>
      </View>
    );
  }

  if (duel === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Duel not found</Text>
        <Text style={styles.hint}>This duel may have been deleted</Text>
      </View>
    );
  }

  // Compute derived state
  const isPlayer = duel.player1 === user._id || duel.player2 === user._id;
  const canSubmit =
    duel.status === "ACTIVE" &&
    isPlayer &&
    Date.now() < (duel.endTime ?? 0) + 2 * 60 * 1000; // grace window

  const canResolve =
    duel.status === "COMPLETED" || Date.now() >= (duel.endTime ?? 0);

  const canCancel = duel.status === "OPEN" && duel.player1 === user._id; // Only creator can cancel open duels

  // Mutation handlers with error handling
  const handleComplete = async () => {
    try {
      const result = await submitCompletion({
        duelId,
        player: user._id,
      });
      if (result?.message) {
        Alert.alert("ℹ️ Info", result.message);
      } else {
        Alert.alert("✅ Success", "Submission recorded!");
      }
    } catch (err: any) {
      Alert.alert("❌ Error", err.message || "Failed to submit");
    }
  };

  const handleResolve = async () => {
    if (!canResolve) {
      Alert.alert("⏳ Not Ready", "Duel must end before resolution");
      return;
    }
    try {
      await computeOutcome({ duelId });
      Alert.alert("✅ Resolved", "Duel outcome computed");
    } catch (err: any) {
      Alert.alert("❌ Error", err.message || "Failed to resolve");
    }
  };

  const handleCancel = async () => {
    if (!canCancel) {
      Alert.alert(
        "⚠️ Cannot Cancel",
        "Only open duels can be cancelled by their creator",
      );
      return;
    }
    Alert.alert(
      "Confirm Cancel",
      "Are you sure? This action cannot be undone.",
      [
        { text: "Keep Duel", style: "cancel" },
        {
          text: "Cancel Duel",
          style: "destructive",
          onPress: async () => {
            try {
              await cancelDuel({ duelId, caller: user._id });
              Alert.alert("✅ Cancelled", "Duel has been cancelled");
            } catch (err: any) {
              Alert.alert("❌ Error", err.message || "Failed to cancel");
            }
          },
        },
      ],
    );
  };

  const statusStyle = getStatusStyle(duel.status);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Duel</Text>
        <View style={[styles.badge, { backgroundColor: statusStyle.bg }]}>
          <Text style={[styles.badgeText, { color: statusStyle.text }]}>
            {duel.status}
          </Text>
        </View>
      </View>

      {/* Duel Details */}
      <View style={styles.card}>
        <DetailRow
          label="Time Remaining"
          value={formatTimeRemaining(duel.endTime)}
        />
        <DetailRow label="Stake" value={`${duel.stakeAmount} tokens`} />
        <DetailRow label="Mode" value={duel.mode} />
        <DetailRow
          label="Players"
          value={duel.player2 ? "2/2" : "1/2 (waiting)"}
        />
      </View>

      {/* Action Buttons - Conditionally Rendered */}
      <View style={styles.actions}>
        {canSubmit && (
          <Button
            title="✅ Submit Completion"
            onPress={handleComplete}
            disabled={!canSubmit}
          />
        )}

        {canResolve && (
          <Button
            title="🏁 Resolve Duel"
            onPress={handleResolve}
            color="#7c3aed"
          />
        )}

        {canCancel && (
          <Button
            title="🗑️ Cancel Duel"
            onPress={handleCancel}
            color="#dc2626"
          />
        )}

        {/* Disabled state hints */}
        {!canSubmit && duel.status === "ACTIVE" && isPlayer && (
          <Text style={styles.hint}>⏱️ Submission window closed</Text>
        )}
        {!canResolve && duel.status === "ACTIVE" && (
          <Text style={styles.hint}>⏳ Wait for duel to end to resolve</Text>
        )}
        {!canCancel && duel.status === "OPEN" && duel.player1 !== user._id && (
          <Text style={styles.hint}>🔒 Only the creator can cancel</Text>
        )}
      </View>

      {/* Debug info (remove in production) */}
      {__DEV__ && (
        <View style={styles.debug}>
          <Text style={styles.debugText}>Duel ID: {duelId}</Text>
          <Text style={styles.debugText}>Status: {duel.status}</Text>
          <Text style={styles.debugText}>
            End Time: {new Date(duel.endTime ?? 0).toLocaleString()}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

// Subcomponent for detail rows
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flex: 1, backgroundColor: "#fff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "bold" },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  label: { color: "#6b7280", fontSize: 14 },
  value: { fontWeight: "500", fontSize: 14 },
  actions: { gap: 12 },
  hint: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    fontStyle: "italic",
    marginTop: 4,
  },
  loadingText: { marginTop: 12, color: "#6b7280" },
  errorText: { fontSize: 18, fontWeight: "600", color: "#dc2626" },
  debug: {
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  debugText: { fontSize: 10, color: "#9ca3af", fontFamily: "monospace" },
});
