import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import {
  formatDuelStatus,
  formatStartTime,
  getDuelDescription,
  getDuelNextAction,
  getDuelTitle,
} from "@/lib/duel-copy";
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

type DuelWithCopy = Doc<"duels"> & {
  title?: string;
  description?: string;
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
  const [submitLoading, setSubmitLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);
  const [selectedDuelId, setSelectedDuelId] = useState<Id<"duels"> | null>(
    typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : null,
  );

  const submitCompletion = useMutation(
    api.submissions.submitCompletion.submitCompletion,
  );
  const prepareSettlement = useMutation(
    api.duels.prepareSettlement.prepareSettlement,
  );
  const finalizeSettlement = useMutation(
    api.duels.finalizeSettlement.finalizeSettlement,
  );

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const duels = useQuery(
    api.duels.getUserDuels.getUserDuels,
    user ? { userId: user._id } : "skip",
  ) as DuelWithCopy[] | undefined;
  const selectedDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    selectedDuelId ? { id: selectedDuelId } : "skip",
  ) as DuelWithCopy | null | undefined;

  useEffect(() => {
    if (!selectedDuelId && duels?.[0]) {
      setSelectedDuelId(duels[0]._id);
    }
  }, [duels, selectedDuelId]);

  const activeDuels = useMemo(
    () => (duels ?? []).filter((duel) => duel.status === "ACTIVE"),
    [duels],
  );
  const openDuels = useMemo(
    () => (duels ?? []).filter((duel) => duel.status === "OPEN"),
    [duels],
  );
  const completedDuels = useMemo(
    () =>
      (duels ?? []).filter(
        (duel) =>
          duel.status === "RESOLVED" ||
          duel.status === "COMPLETED" ||
          duel.status === "CANCELLED",
      ),
    [duels],
  );

  const duelStatus = selectedDuel?.status ?? "CREATED";
  const isActive = duelStatus === "ACTIVE";
  const isResolved = duelStatus === "RESOLVED" || duelStatus === "COMPLETED";
  const hasOnchainMetadata = !!selectedDuel?.onchainDuelAddress;
  const rivalLabel = selectedDuel?.player2
    ? `#${String(selectedDuel.player2).slice(0, 6)}`
    : "Waiting for rival";

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const handleCheckIn = async () => {
    if (!selectedDuelId || !user || !isActive) {
      openFeedback(
        "error",
        "Check-in blocked",
        "Only live duels accept daily completion.",
      );
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
        "Check-in submitted",
        result?.message
          ? `${result.message} Day ${result.dayNumber} locked in.`
          : `Day ${result.dayNumber} recorded.`,
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Submit failed",
        error?.message ?? "Could not submit completion.",
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSettle = async () => {
    if (!selectedDuel || !selectedDuelId || !walletAddress) {
      openFeedback(
        "error",
        "Settle failed",
        "Choose a duel before settling.",
      );
      return;
    }

    if (!hasOnchainMetadata) {
      openFeedback(
        "error",
        "Settle failed",
        "This duel is missing on-chain metadata.",
      );
      return;
    }

    setSettleLoading(true);
    let onChainSettlement: Awaited<
      ReturnType<typeof wallet.settleDuel>
    > | null = null;

    try {
      const context = await wallet.getDuelSettlementContext(
        selectedDuel.onchainDuelAddress!,
      );
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
        "Settlement complete",
        prepared.winnerWallet
          ? `Winner: ${prepared.winnerWallet}`
          : `Outcome: ${prepared.outcome}`,
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Settle failed",
        onChainSettlement
          ? `On-chain settlement succeeded, but backend finalization failed. Tx: ${onChainSettlement.signature}`
          : (error?.message ?? "Could not settle duel."),
      );
    } finally {
      setSettleLoading(false);
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.lockTitle}>PvP Battle Board</Text>
          <Text style={styles.lockCopy}>
            Connect wallet to review live duels, open challenges, and completed
            results.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <Text style={styles.sectionLabel}>PvP Arena</Text>
          <Text style={styles.heroTitle}>
            {selectedDuel ? getDuelTitle(selectedDuel) : "Choose a duel"}
          </Text>
          <Text style={styles.heroSubtitle}>
            {selectedDuel
              ? getDuelDescription(selectedDuel)
              : "Use the sections below to jump into a live match, review an open invite, or reopen a completed record."}
          </Text>

          <View style={styles.heroBadgeRow}>
            <StatusPill status={duelStatus} />
            <InfoPill
              label={hasOnchainMetadata ? "On-chain ready" : "Metadata missing"}
            />
          </View>

          {selectedDuel ? (
            <View style={styles.heroGrid}>
              <HeroStat
                label="You"
                value={user?.username ? `@${user.username}` : "Hunter"}
              />
              <HeroStat label="Rival" value={rivalLabel} />
              <HeroStat
                label="Stake"
                value={`${selectedDuel.stakeAmount.toFixed(1)} SOL`}
              />
              <HeroStat
                label="Starts"
                value={formatStartTime(selectedDuel.startTime)}
              />
            </View>
          ) : null}
        </SystemWindow>

        <SystemWindow style={styles.focusWindow}>
          <Text style={styles.sectionLabel}>Selected Duel</Text>
          {selectedDuel ? (
            <>
              <Text style={styles.focusTitle}>{getDuelTitle(selectedDuel)}</Text>
              <Text style={styles.focusCopy}>
                {getDuelNextAction(selectedDuel)}
              </Text>

              <View style={styles.focusList}>
                <FocusRow
                  label="State"
                  value={formatDuelStatus(selectedDuel.status)}
                />
                <FocusRow label="Mode" value={selectedDuel.mode} />
                <FocusRow
                  label="Start time"
                  value={formatStartTime(selectedDuel.startTime)}
                />
                <FocusRow
                  label="Duel ID"
                  value={String(selectedDuel._id).slice(0, 12)}
                />
              </View>
            </>
          ) : (
            <Text style={styles.emptyCopy}>
              No duel is selected yet. Pick one from Active, Open, or Completed.
            </Text>
          )}
        </SystemWindow>

        <QueueSection
          title="Active Now"
          copy="These are the duels where daily proof still matters."
          duels={activeDuels}
          selectedDuelId={selectedDuelId}
          onSelect={setSelectedDuelId}
        />

        <QueueSection
          title="Open Challenges"
          copy="Created but not joined yet. These are invites, not live battles."
          duels={openDuels}
          selectedDuelId={selectedDuelId}
          onSelect={setSelectedDuelId}
        />

        <QueueSection
          title="Completed Log"
          copy="Resolved matches and cancelled runs stay here for review."
          duels={completedDuels}
          selectedDuelId={selectedDuelId}
          onSelect={setSelectedDuelId}
        />

        {isActive && selectedDuel ? (
          <SystemWindow>
            <Text style={styles.sectionLabel}>Daily Proof</Text>
            <Text style={styles.actionLead}>
              Log what you did today. The note stays local; the button sends the
              actual completion.
            </Text>
            <TextInput
              value={journal}
              onChangeText={setJournal}
              style={styles.journalInput}
              multiline
              placeholder="Example: 45 minutes workout + no sugar"
              placeholderTextColor={C.slate600}
            />
            <Text style={styles.noteHint}>
              Meaningful duel notes make your own streak easier to review later.
            </Text>
            <View style={styles.actionStack}>
              <GateButton
                label={submitLoading ? "Submitting..." : "Submit Today's Proof"}
                onPress={handleCheckIn}
                disabled={submitLoading || !selectedDuelId || !user}
              />
            </View>
          </SystemWindow>
        ) : null}

        {isResolved && selectedDuel ? (
          <SystemWindow style={styles.resolveWindow}>
            <Text style={styles.sectionLabel}>Settlement</Text>
            <Text style={styles.actionLead}>
              The duel is already decided. Settlement is the last step that
              moves the approved payout on-chain.
            </Text>
            <View style={styles.actionStack}>
              <GateButton
                label={settleLoading ? "Settling..." : "Settle On-chain"}
                onPress={handleSettle}
                disabled={
                  settleLoading ||
                  !selectedDuelId ||
                  !selectedDuel ||
                  !hasOnchainMetadata
                }
              />
            </View>
          </SystemWindow>
        ) : null}

        {!selectedDuel ? null : !isActive && !isResolved ? (
          <SystemWindow>
            <Text style={styles.sectionLabel}>What Happens Next</Text>
            <Text style={styles.actionLead}>
              {selectedDuel.status === "OPEN"
                ? "This duel is still waiting for an opponent. Share it from the duel board or wait for a rival to join."
                : "This match is scheduled. Come back when the state changes to live or resolved."}
            </Text>
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

function QueueSection({
  title,
  copy,
  duels,
  selectedDuelId,
  onSelect,
}: {
  title: string;
  copy: string;
  duels: DuelWithCopy[];
  selectedDuelId: Id<"duels"> | null;
  onSelect: (id: Id<"duels">) => void;
}) {
  return (
    <SystemWindow>
      <Text style={styles.sectionLabel}>{title}</Text>
      <Text style={styles.sectionCopy}>{copy}</Text>
      <View style={styles.queueList}>
        {duels.length === 0 ? (
          <Text style={styles.emptyCopy}>Nothing here yet.</Text>
        ) : (
          duels.map((duel) => {
            const selected = duel._id === selectedDuelId;
            return (
              <TouchableOpacity
                key={duel._id}
                style={[
                  styles.queueCard,
                  selected && styles.queueCardSelected,
                ]}
                onPress={() => onSelect(duel._id)}
              >
                <View style={styles.queueHeader}>
                  <Text style={styles.queueTitle}>{getDuelTitle(duel)}</Text>
                  <StatusPill status={duel.status} compact />
                </View>
                <Text style={styles.queueDescription}>
                  {getDuelDescription(duel)}
                </Text>
                <View style={styles.queueMetaRow}>
                  <Text style={styles.queueMeta}>
                    {duel.stakeAmount} SOL
                  </Text>
                  <Text style={styles.queueMeta}>
                    {formatStartTime(duel.startTime)}
                  </Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </SystemWindow>
  );
}

function StatusPill({
  status,
  compact,
}: {
  status: DuelWithCopy["status"];
  compact?: boolean;
}) {
  const toneStyle =
    status === "ACTIVE"
      ? styles.statusLive
      : status === "OPEN"
        ? styles.statusOpen
        : status === "CANCELLED"
          ? styles.statusDanger
          : styles.statusNeutral;

  return (
    <View style={[styles.statusPill, compact && styles.statusPillCompact, toneStyle]}>
      <Text style={styles.statusPillText}>{formatDuelStatus(status)}</Text>
    </View>
  );
}

function InfoPill({ label }: { label: string }) {
  return (
    <View style={styles.infoPill}>
      <Text style={styles.infoPillText}>{label}</Text>
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStatCard}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function FocusRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.focusRow}>
      <Text style={styles.focusLabel}>{label}</Text>
      <Text style={styles.focusValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  lockTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  lockCopy: {
    marginTop: 8,
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: C.cardAlt,
  },
  heroGlow: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.22)",
  },
  focusWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,183,3,0.08)",
  },
  resolveWindow: {
    borderColor: C.success,
    backgroundColor: C.successSoft,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  sectionCopy: {
    color: C.slate500,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  heroTitle: {
    color: C.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 10,
  },
  heroSubtitle: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
  },
  heroBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 16,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillCompact: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusOpen: {
    backgroundColor: C.manaDim,
    borderColor: C.manaBorder,
  },
  statusLive: {
    backgroundColor: C.successSoft,
    borderColor: "rgba(0,245,160,0.28)",
  },
  statusNeutral: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderColor: C.glassBorder,
  },
  statusDanger: {
    backgroundColor: C.dangerSoft,
    borderColor: "rgba(255,75,75,0.28)",
  },
  statusPillText: {
    color: C.white,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  infoPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  infoPillText: {
    color: C.slate400,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  heroGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  heroStatCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  heroStatLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroStatValue: {
    color: C.white,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  focusTitle: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  focusCopy: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
  },
  focusList: {
    marginTop: 14,
    gap: 10,
  },
  focusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  focusLabel: {
    color: C.slate500,
    fontSize: 12,
  },
  focusValue: {
    color: C.white,
    fontSize: 12,
    fontFamily: "monospace",
    flexShrink: 1,
    textAlign: "right",
  },
  queueList: {
    gap: 10,
  },
  queueCard: {
    borderRadius: 18,
    padding: 15,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.glassBorder,
    gap: 8,
  },
  queueCardSelected: {
    borderColor: C.manaBorder,
    backgroundColor: "rgba(255,107,53,0.1)",
  },
  queueHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  queueTitle: {
    flex: 1,
    color: C.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "700",
  },
  queueDescription: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  queueMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  queueMeta: {
    color: C.slate500,
    fontSize: 11,
    fontFamily: "monospace",
  },
  actionLead: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
  },
  journalInput: {
    minHeight: 120,
    marginTop: 14,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 16,
    backgroundColor: C.cardAlt,
    color: C.white,
    padding: 14,
    textAlignVertical: "top",
  },
  noteHint: {
    marginTop: 8,
    color: C.slate500,
    fontSize: 12,
    lineHeight: 18,
  },
  actionStack: {
    gap: 10,
    marginTop: 14,
  },
  emptyCopy: {
    color: C.slate500,
    fontSize: 13,
    lineHeight: 19,
  },
});
