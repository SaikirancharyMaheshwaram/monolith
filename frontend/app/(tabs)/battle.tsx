import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type FeedbackState = {
  visible: boolean;
  tone: "success" | "error";
  title: string;
  message: string;
};

const EMPTY_FEEDBACK: FeedbackState = {
  visible: false,
  tone: "success",
  title: "",
  message: "",
};

export default function BattleScreen() {
  const wallet = useWallet();
  const params = useLocalSearchParams<{ duelId?: string }>();

  const [journal, setJournal] = useState("");
  const [selectedDuelId, setSelectedDuelId] = useState<Id<"duels"> | null>(
    typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : null,
  );
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);

  const submitCompletion = useMutation(api.submissions.submitCompletion.submitCompletion);
  const prepareSettlement = useMutation(api.duels.prepareSettlement.prepareSettlement);
  const finalizeSettlement = useMutation(api.duels.finalizeSettlement.finalizeSettlement);
  const programConfig = useQuery(api.duels.getProgramConfig.getProgramConfig, {});

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const duels = useQuery(
    api.duels.getUserDuels.getUserDuels,
    user ? { userId: user._id } : "skip",
  );
  const selectedDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    selectedDuelId ? { id: selectedDuelId } : "skip",
  );

  useEffect(() => {
    if (!selectedDuelId && duels?.[0]) {
      setSelectedDuelId(duels[0]._id);
    }
  }, [duels, selectedDuelId]);

  const duelStatus = selectedDuel?.status ?? "NONE";
  const isActive = duelStatus === "ACTIVE";
  const isResolved = duelStatus === "RESOLVED" || duelStatus === "COMPLETED";
  const hasOnchainMetadata = !!selectedDuel?.onchainDuelAddress;

  const matchupTitle = useMemo(() => {
    if (!selectedDuel) return "No duel selected";
    return `${selectedDuel.stakeAmount} SOL stake duel`;
  }, [selectedDuel]);

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const handleCheckIn = async () => {
    if (!selectedDuelId || !user || !isActive) {
      openFeedback("error", "Check-in blocked", "Only active duels accept daily completion.");
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await submitCompletion({
        duelId: selectedDuelId,
        player: user._id,
      });
      setJournal("");
      openFeedback(
        "success",
        "Check-in Submitted",
        result?.message
          ? `${result.message} (Day ${result.dayNumber})`
          : `Day ${result.dayNumber} recorded.`,
      );
    } catch (error: any) {
      openFeedback("error", "Submit Failed", error?.message ?? "Could not submit completion.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedDuel || !selectedDuelId || !walletAddress) {
      openFeedback("error", "Settle Failed", "Choose a duel before settling.");
      return;
    }
    if (!hasOnchainMetadata) {
      openFeedback("error", "Settle Failed", "This duel is missing on-chain metadata.");
      return;
    }

    setSettleLoading(true);
    let onChainSettlement: Awaited<ReturnType<typeof wallet.settleDuel>> | null = null;
    try {
      const context = await wallet.getDuelSettlementContext(selectedDuel.onchainDuelAddress!);
      const prepared = await prepareSettlement({
        duelId: selectedDuelId,
        callerWallet: walletAddress,
        onchainDuelId: context.duelId,
        settlementNonce: context.settlementNonce,
      });
      onChainSettlement = await wallet.settleDuel({
        duelAddress: selectedDuel.onchainDuelAddress!,
        resultByte: prepared.resultByte,
        message: prepared.message,
        signature: prepared.signature,
      });
      await finalizeSettlement({
        duelId: selectedDuelId,
        settlementTxSignature: onChainSettlement.signature,
      });
      openFeedback(
        "success",
        "Settlement Complete",
        prepared.winnerWallet
          ? `Winner: ${prepared.winnerWallet}`
          : `Outcome: ${prepared.outcome}`,
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Settle Failed",
        onChainSettlement
          ? `On-chain settlement succeeded, but backend finalization failed. Tx: ${onChainSettlement.signature}`
          : (error?.message ?? "Could not settle duel."),
      );
    } finally {
      setSettleLoading(false);
    }
  };

  const handleInitializeConfig = async () => {
    if (!programConfig) {
      openFeedback("error", "Initialize Failed", "Backend signer config is not loaded yet.");
      return;
    }
    if (!treasuryAddress.trim()) {
      openFeedback("error", "Initialize Failed", "Enter a treasury wallet address first.");
      return;
    }

    setConfigLoading(true);
    try {
      const result = await wallet.initializeProgramConfig({
        backendPubkey: programConfig.backendPubkey,
        treasuryAddress: treasuryAddress.trim(),
        feeBps: programConfig.feeBps,
      });
      openFeedback("success", "Config Initialized", `Config PDA ${result.configAddress} created on-chain.`);
    } catch (error: any) {
      openFeedback("error", "Initialize Failed", error?.message ?? "Could not initialize on-chain config.");
    } finally {
      setConfigLoading(false);
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>BATTLE ARENA</Text>
          <Text style={styles.sub}>Connect wallet to enter PvP duel view.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <Text style={styles.sectionLabel}>PvP Match</Text>
          <Text style={styles.heroTitle}>{matchupTitle}</Text>
          <Text style={styles.heroSub}>
            Active duels allow daily completion. Once resolved, check-ins disappear and settlement becomes the only action.
          </Text>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>Your Duel Queue</Text>
          <View style={styles.duelList}>
            {(duels ?? []).map((duel) => {
              const selected = duel._id === selectedDuelId;
              return (
                <TouchableOpacity
                  key={duel._id}
                  style={[styles.duelCard, selected && styles.duelCardSelected]}
                  onPress={() => setSelectedDuelId(duel._id)}
                >
                  <Text style={styles.duelTitle}>{duel.mode} • {duel.status}</Text>
                  <Text style={styles.duelMeta}>Stake: {duel.stakeAmount} SOL</Text>
                </TouchableOpacity>
              );
            })}
            {(duels ?? []).length === 0 ? <Text style={styles.empty}>No duels found.</Text> : null}
          </View>
        </SystemWindow>

        <SystemWindow style={styles.matchCard}>
          <Text style={styles.sectionLabel}>Match State</Text>
          <View style={styles.vsRow}>
            <FighterCard label="You" value={user?.username ?? "Hunter"} />
            <Text style={styles.vsText}>VS</Text>
            <FighterCard label="Rival" value={selectedDuel?.player2 ? String(selectedDuel.player2).slice(0, 6) : "Waiting"} />
          </View>
          <View style={styles.statusLine}>
            <Text style={styles.statusKey}>Status</Text>
            <Text style={styles.statusValue}>{duelStatus}</Text>
          </View>
          <View style={styles.statusLine}>
            <Text style={styles.statusKey}>On-chain</Text>
            <Text style={styles.statusValue}>{hasOnchainMetadata ? "Ready" : "Missing metadata"}</Text>
          </View>
        </SystemWindow>

        {isActive ? (
          <>
            <SystemWindow>
              <Text style={styles.sectionLabel}>Daily Completion</Text>
              <TextInput
                value={journal}
                onChangeText={setJournal}
                style={styles.journalInput}
                multiline
                placeholder="Write what you completed today..."
                placeholderTextColor={C.slate600}
              />
              <Text style={styles.journalHint}>This note is local-only. The actual check-in is the button below.</Text>
              <View style={styles.actionStack}>
                <GateButton
                  label={submitLoading ? "Submitting..." : "Submit Completion"}
                  onPress={handleCheckIn}
                  disabled={submitLoading || !selectedDuelId || !user}
                />
              </View>
            </SystemWindow>

            <SystemWindow style={styles.configCard}>
              <Text style={styles.sectionLabel}>Settlement Config</Text>
              <Text style={styles.configCopy}>Run once with the upgrade authority wallet before first settlement on this cluster.</Text>
              <TextInput
                value={treasuryAddress}
                onChangeText={setTreasuryAddress}
                style={styles.treasuryInput}
                placeholder="Treasury wallet address"
                placeholderTextColor={C.slate600}
                autoCapitalize="none"
              />
              <Text style={styles.journalHint}>Backend signer: {programConfig?.backendPubkey ?? "loading..."}</Text>
              <View style={styles.actionStack}>
                <GateButton
                  label={configLoading ? "Initializing..." : "Initialize Config"}
                  onPress={handleInitializeConfig}
                  disabled={configLoading || !wallet.connected}
                />
              </View>
            </SystemWindow>
          </>
        ) : null}

        {isResolved ? (
          <SystemWindow style={styles.resolvedCard}>
            <Text style={styles.sectionLabel}>Resolved Duel</Text>
            <Text style={styles.heroSub}>
              This duel is no longer accepting completions. If the backend has resolved the outcome, run the on-chain settlement now.
            </Text>
            <View style={styles.actionStack}>
              <GateButton
                label={settleLoading ? "Settling..." : "Settle On-chain"}
                onPress={handleSettle}
                disabled={settleLoading || !selectedDuelId || !selectedDuel || !hasOnchainMetadata}
              />
            </View>
          </SystemWindow>
        ) : null}

        {!isActive && !isResolved ? (
          <SystemWindow>
            <Text style={styles.sectionLabel}>Match Control</Text>
            <Text style={styles.heroSub}>Pick a duel from the queue to see whether it is still live or already resolved.</Text>
          </SystemWindow>
        ) : null}
      </ScrollView>

      <FeedbackModal
        visible={feedback.visible}
        tone={feedback.tone}
        title={feedback.title}
        message={feedback.message}
        onClose={() => setFeedback(EMPTY_FEEDBACK)}
      />
    </SafeAreaView>
  );
}

function FighterCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.fighterCard}>
      <Text style={styles.fighterLabel}>{label}</Text>
      <Text style={styles.fighterValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  title: {
    color: C.mana,
    fontFamily: "monospace",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sub: { color: C.slate400, fontSize: 12, marginTop: 4, textTransform: "uppercase", fontFamily: "monospace" },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: "rgba(42,20,8,0.96)",
  },
  heroGlow: {
    position: "absolute",
    top: -28,
    right: -36,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,31,0.16)",
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  heroTitle: { color: C.white, fontSize: 28, lineHeight: 34, fontWeight: "800", marginBottom: 10 },
  heroSub: { color: C.slate400, fontSize: 14, lineHeight: 21 },
  duelList: { gap: 10 },
  duelCard: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
  },
  duelCardSelected: {
    borderColor: C.manaBorder,
    backgroundColor: C.manaDim,
  },
  duelTitle: { color: C.white, fontWeight: "700", marginBottom: 4 },
  duelMeta: { color: C.slate400, fontSize: 12 },
  empty: { color: C.slate600, fontStyle: "italic", fontSize: 12 },
  matchCard: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  vsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  fighterCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  fighterLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  fighterValue: { color: C.white, fontSize: 18, fontWeight: "800" },
  vsText: { color: C.mana, fontFamily: "monospace", fontSize: 18, fontWeight: "800" },
  statusLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statusKey: { color: C.slate400, fontSize: 12 },
  statusValue: { color: C.white, fontFamily: "monospace", fontSize: 12 },
  journalInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    color: C.white,
    padding: 12,
    textAlignVertical: "top",
  },
  journalHint: { marginTop: 8, color: C.slate500, fontSize: 11, fontStyle: "italic" },
  treasuryInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    color: C.white,
    padding: 12,
  },
  actionStack: { gap: 10, marginTop: 12 },
  configCard: {
    borderColor: C.glassBorder,
  },
  configCopy: { color: C.slate400, fontSize: 13, lineHeight: 19 },
  resolvedCard: {
    borderColor: C.success,
    backgroundColor: "rgba(255,210,111,0.08)",
  },
});
