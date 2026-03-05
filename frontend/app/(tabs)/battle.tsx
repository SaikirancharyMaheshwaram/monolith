import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function BattleScreen() {
  const wallet = useWallet();
  const params = useLocalSearchParams<{ duelId?: string }>();

  const [journal, setJournal] = useState("");
  const [selectedDuelId, setSelectedDuelId] = useState<Id<"duels"> | null>(
    typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : null,
  );
  const [submitLoading, setSubmitLoading] = useState(false);

  const submitCompletion = useMutation(api.submissions.submitCompletion.submitCompletion);

  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );

  const activeDuels = useQuery(
    api.duels.getActiveDuels.getActiveDuels,
    user ? { userId: user._id } : "skip",
  );

  const selectedDuel = useMemo(() => {
    if (!selectedDuelId || !activeDuels) return null;
    return activeDuels.find((d) => d._id === selectedDuelId) ?? null;
  }, [activeDuels, selectedDuelId]);

  const handleCheckIn = async () => {
    if (!selectedDuelId || !user) {
      Alert.alert("Select duel", "Choose an active duel before check-in.");
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await submitCompletion({
        duelId: selectedDuelId,
        player: user._id,
      });

      Alert.alert(
        "Check-in submitted",
        result?.message ? `${result.message} (Day ${result.dayNumber})` : `Day ${result.dayNumber} recorded`,
      );
      // Journal is intentionally local-only for test UX.
      setJournal("");
    } catch (error: any) {
      Alert.alert("Submit failed", error?.message ?? "Could not submit completion.");
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>BATTLE CONSOLE</Text>
          <Text style={styles.sub}>Connect wallet to check in.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow>
          <Text style={styles.sectionLabel}>BATTLE CHECK-IN</Text>
          <Text style={styles.sub}>Submit your daily completion for active gates.</Text>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>ACTIVE DUELS</Text>
          <View style={styles.duelList}>
            {(activeDuels ?? []).map((duel) => {
              const selected = duel._id === selectedDuelId;
              return (
                <TouchableOpacity
                  key={duel._id}
                  style={[styles.duelItem, selected && styles.duelItemSelected]}
                  onPress={() => setSelectedDuelId(duel._id)}
                >
                  <Text style={styles.duelTitle}>DUEL {String(duel._id).slice(0, 8)}...</Text>
                  <Text style={styles.duelMeta}>Stake: {duel.stakeAmount} SOL</Text>
                </TouchableOpacity>
              );
            })}
            {(activeDuels ?? []).length === 0 && <Text style={styles.sub}>No active duels.</Text>}
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>QUEST JOURNAL (LOCAL TEST)</Text>
          <TextInput
            value={journal}
            onChangeText={setJournal}
            style={styles.journalInput}
            multiline
            placeholder="Write what you completed today..."
            placeholderTextColor={C.slate600}
          />
          <Text style={styles.journalHint}>This note is not sent to backend and not stored.</Text>
        </SystemWindow>

        <SystemWindow style={styles.submitBox}>
          <Text style={styles.sectionLabel}>SUBMIT ACTION</Text>
          <Text style={styles.sub}>
            {selectedDuel ? `Selected duel: ${String(selectedDuel._id).slice(0, 10)}...` : "No duel selected"}
          </Text>
          <View style={{ marginTop: 10 }}>
            <GateButton
              label={submitLoading ? "Submitting..." : "Submit Completion"}
              onPress={handleCheckIn}
              disabled={submitLoading || !selectedDuelId || !user}
            />
          </View>
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 12, paddingBottom: 44 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  title: {
    color: C.mana,
    fontFamily: "monospace",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sub: {
    color: C.slate400,
    fontSize: 12,
    lineHeight: 18,
  },
  duelList: { gap: 8 },
  duelItem: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 6,
    padding: 10,
  },
  duelItemSelected: {
    borderColor: C.mana,
    backgroundColor: C.manaDim,
  },
  duelTitle: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    marginBottom: 4,
  },
  duelMeta: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 11,
  },
  journalInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.02)",
    color: C.white,
    padding: 12,
    textAlignVertical: "top",
  },
  journalHint: {
    marginTop: 8,
    color: C.slate500,
    fontSize: 11,
    fontStyle: "italic",
  },
  submitBox: {
    borderColor: C.green,
    backgroundColor: "rgba(0,255,163,0.08)",
  },
});
