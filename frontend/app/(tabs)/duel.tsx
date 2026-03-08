import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STAKES = [0.1, 0.5, 1, 2];
const START_MINUTES = [10, 30, 60, 120];

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

export default function DuelHubScreen() {
  const wallet = useWallet();
  const router = useRouter();
  const params = useLocalSearchParams<{ duelId?: string }>();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(STAKES[2]);
  const [startInMins, setStartInMins] = useState(START_MINUTES[1]);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinInviteLoading, setJoinInviteLoading] = useState(false);
  const [manualDuelId, setManualDuelId] = useState(
    typeof params.duelId === "string" ? params.duelId : "",
  );
  const [resolvedInviteId, setResolvedInviteId] = useState<Id<"duels"> | null>(
    typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : null,
  );
  const [readChecked, setReadChecked] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);

  const createFriendDuel = useMutation(api.duels.createFriendDuel.createFriendDuel);
  const cancelOpenDuel = useMutation(api.duels.cancelOpenDuel.cancelOpenDuel);
  const joinFriendDuel = useMutation(api.duels.joinFriendDuel.joinFriendDuel);

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const duels = useQuery(
    api.duels.getUserDuels.getUserDuels,
    user ? { userId: user._id } : "skip",
  );
  const inviteDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    resolvedInviteId ? { id: resolvedInviteId } : "skip",
  );

  useEffect(() => {
    if (!manualDuelId.trim()) {
      setResolvedInviteId(
        typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : null,
      );
      return;
    }

    if (manualDuelId.trim().length > 8) {
      setResolvedInviteId(manualDuelId.trim() as Id<"duels">);
    }
  }, [manualDuelId, params.duelId]);

  const activeDuels = (duels ?? []).filter((d) => d.status === "ACTIVE");
  const openDuels = (duels ?? []).filter((d) => d.status === "OPEN");
  const historyDuels = (duels ?? []).filter(
    (d) => d.status === "COMPLETED" || d.status === "RESOLVED" || d.status === "CANCELLED",
  );

  const canJoinInvite = useMemo(() => {
    if (!user || !inviteDuel) return false;
    if (inviteDuel.status !== "OPEN") return false;
    if (inviteDuel.player1 === user._id) return false;
    return true;
  }, [inviteDuel, user]);

  const inviteOnchainDuelAddress = inviteDuel?.onchainDuelAddress;
  const inviteOnchainEscrowAddress = inviteDuel?.onchainEscrowAddress;

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const shareInviteLink = async (duelId: string) => {
    const inviteUrl = Linking.createURL("/duel", { queryParams: { duelId } });
    await Share.share({
      message: `Join my friend duel gate: ${inviteUrl}`,
      url: inviteUrl,
    });
  };

  const handleCreateInvite = async () => {
    if (!walletAddress) return;

    setCreateLoading(true);
    const startTime = Date.now() + startInMins * 60 * 1000;
    let onChainDuel: Awaited<ReturnType<typeof wallet.createDuel>> | null = null;
    try {
      onChainDuel = await wallet.createDuel({
        stakeAmountSol: stakeAmount,
        startTimeMs: startTime,
      });

      const duelId = await createFriendDuel({
        player1: walletAddress,
        stakeAmount,
        startTime,
        onchainDuelAddress: onChainDuel.duelAddress,
        onchainEscrowAddress: onChainDuel.escrowAddress,
        onchainProgramId: onChainDuel.programId,
        onchainTxSignature: onChainDuel.signature,
        onchainNonce: onChainDuel.duelNonce,
      });

      setShowCreateModal(false);
      openFeedback(
        "success",
        "Invite Forged",
        `Duel ${String(duelId)} is live and the on-chain escrow has been created.`,
      );
      await shareInviteLink(String(duelId));
    } catch (error: any) {
      openFeedback(
        "error",
        "Create Failed",
        onChainDuel
          ? `On-chain duel ${onChainDuel.duelAddress} was created but Convex save failed. Tx: ${onChainDuel.signature}`
          : (error?.message ?? "Could not create duel invite."),
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoinInvite = async () => {
    if (!user || !inviteDuel || !canJoinInvite) return;
    if (!readChecked) {
      openFeedback("error", "Contract Required", "Read and confirm the duel contract before joining.");
      return;
    }
    if (!inviteOnchainDuelAddress) {
      openFeedback("error", "Join Failed", "This duel is missing on-chain metadata.");
      return;
    }

    setJoinInviteLoading(true);
    let onChainJoin: Awaited<ReturnType<typeof wallet.joinDuel>> | null = null;
    try {
      onChainJoin = await wallet.joinDuel({
        duelAddress: inviteOnchainDuelAddress,
        escrowAddress: inviteOnchainEscrowAddress,
      });
      await joinFriendDuel({
        duelId: inviteDuel._id,
        player2: user._id,
      });
      setShowContractModal(false);
      openFeedback(
        "success",
        "Gate Joined",
        `You are now live in duel ${onChainJoin.duelAddress.slice(0, 8)}...`,
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Join Failed",
        onChainJoin
          ? `On-chain join succeeded, but backend activation failed. Tx: ${onChainJoin.signature}`
          : (error?.message ?? "Could not join duel."),
      );
    } finally {
      setJoinInviteLoading(false);
    }
  };

  const handleCancelOpen = async (duel: Doc<"duels">) => {
    if (!user) return;
    try {
      if (!duel.onchainDuelAddress) {
        throw new Error("On-chain duel metadata is missing.");
      }

      await wallet.cancelDuel({
        duelAddress: duel.onchainDuelAddress,
        escrowAddress: duel.onchainEscrowAddress,
      });
      await cancelOpenDuel({ duelId: duel._id, caller: user._id });
      openFeedback("success", "Duel Cancelled", "The duel was cancelled on-chain and in Convex.");
    } catch (error: any) {
      openFeedback("error", "Cancel Failed", error?.message ?? "Could not cancel duel.");
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.header}>DUEL BOARD LOCKED</Text>
          <Text style={styles.sub}>Connect wallet to create or join friend duels.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user === undefined || duels === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.header}>SYNCING DUEL LOGS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.header}>NO HUNTER PROFILE</Text>
          <Text style={styles.sub}>Complete registration on Home first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <Text style={styles.sectionLabel}>Duel Board</Text>
          <Text style={styles.heroTitle}>Fast join flow, cleaner cards, no more paste-then-load friction.</Text>
          <Text style={styles.heroText}>
            Shared links auto-open the invite. Manual ids resolve as you type, and every duel card now carries its own next action.
          </Text>
          <View style={styles.heroActionRow}>
            <GateButton label="Forge Invite" onPress={() => setShowCreateModal(true)} />
          </View>
        </SystemWindow>

        <SystemWindow style={styles.lookupWindow}>
          <Text style={styles.sectionLabel}>Invite Radar</Text>
          <TextInput
            value={manualDuelId}
            onChangeText={setManualDuelId}
            placeholder="Paste duel id or open a shared link"
            placeholderTextColor={C.slate600}
            autoCapitalize="none"
            style={styles.input}
          />
          <Text style={styles.hint}>The invite card below updates automatically as soon as a valid duel id is present.</Text>
        </SystemWindow>

        {resolvedInviteId && inviteDuel ? (
          <SystemWindow style={styles.inviteWindow}>
            <Text style={styles.sectionLabel}>Live Invite</Text>
            <Text style={styles.inviteTitle}>{inviteDuel.stakeAmount} SOL friend duel</Text>
            <Text style={styles.meta}>Starts: {inviteDuel.startTime ? new Date(inviteDuel.startTime).toLocaleString() : "TBD"}</Text>
            <Text style={styles.meta}>Status: {inviteDuel.status}</Text>
            <Text style={styles.meta}>On-chain duel: {inviteDuel.onchainDuelAddress ? "Attached" : "Missing"}</Text>
            <View style={styles.actionStack}>
              <GateButton
                label="Review Contract"
                onPress={() => setShowContractModal(true)}
                disabled={!canJoinInvite}
              />
            </View>
          </SystemWindow>
        ) : manualDuelId.trim() ? (
          <SystemWindow>
            <Text style={styles.sectionLabel}>Invite Radar</Text>
            <Text style={styles.empty}>No duel found for that id yet.</Text>
          </SystemWindow>
        ) : null}

        <Section title="Your Active Gates" emptyText="No active gate running.">
          {activeDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              onPrimaryLabel="Enter PvP"
              onPrimaryPress={() =>
                router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any)
              }
            />
          ))}
        </Section>

        <Section title="Your Open Invites" emptyText="No open invites waiting.">
          {openDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              onPrimaryLabel="Share Invite"
              onPrimaryPress={() => void shareInviteLink(String(duel._id))}
              onSecondaryLabel="Cancel Duel"
              onSecondaryPress={() => void handleCancelOpen(duel)}
            />
          ))}
        </Section>

        <Section title="History" emptyText="No completed duels yet.">
          {historyDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              onPrimaryLabel="View PvP"
              onPrimaryPress={() =>
                router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any)
              }
              compact
            />
          ))}
        </Section>
      </ScrollView>

      <Modal transparent visible={showCreateModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forge Invite Gate</Text>
            <Text style={styles.modalLabel}>Stake</Text>
            <View style={styles.chipRow}>
              {STAKES.map((value) => (
                <Chip
                  key={value}
                  label={`${value} SOL`}
                  selected={value === stakeAmount}
                  onPress={() => setStakeAmount(value)}
                />
              ))}
            </View>
            <Text style={styles.modalLabel}>Starts in</Text>
            <View style={styles.chipRow}>
              {START_MINUTES.map((value) => (
                <Chip
                  key={value}
                  label={`${value}m`}
                  selected={value === startInMins}
                  onPress={() => setStartInMins(value)}
                />
              ))}
            </View>
            <View style={styles.actionStack}>
              <GateButton
                label={createLoading ? "Forging..." : "Create Invite"}
                onPress={handleCreateInvite}
                disabled={createLoading}
              />
              <GateButton label="Close" variant="ghost" onPress={() => setShowCreateModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showContractModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join Contract</Text>
            <Text style={styles.contractText}>
              Stake joins on-chain. Daily proof stays off-chain. Once resolved, settlement moves the final split.
            </Text>
            <TouchableOpacity style={styles.checkRow} onPress={() => setReadChecked((v) => !v)}>
              <View style={[styles.checkBox, readChecked && styles.checkBoxActive]} />
              <Text style={styles.checkText}>I understand the duel flow and accept the stake rules.</Text>
            </TouchableOpacity>
            <View style={styles.actionStack}>
              <GateButton
                label={joinInviteLoading ? "Joining..." : "Join Gate"}
                onPress={handleJoinInvite}
                disabled={!readChecked || !canJoinInvite || joinInviteLoading}
              />
              <GateButton label="Back" variant="ghost" onPress={() => setShowContractModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

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

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;
  return (
    <SystemWindow>
      <Text style={styles.sectionLabel}>{title}</Text>
      {count === 0 ? <Text style={styles.empty}>{emptyText}</Text> : <View style={styles.list}>{children}</View>}
    </SystemWindow>
  );
}

function DuelCard({
  duel,
  onPrimaryLabel,
  onPrimaryPress,
  onSecondaryLabel,
  onSecondaryPress,
  compact,
}: {
  duel: Doc<"duels">;
  onPrimaryLabel: string;
  onPrimaryPress: () => void;
  onSecondaryLabel?: string;
  onSecondaryPress?: () => void;
  compact?: boolean;
}) {
  const statusTone =
    duel.status === "ACTIVE" ? styles.statusActive : duel.status === "OPEN" ? styles.statusOpen : styles.statusMuted;

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{duel.mode} GATE</Text>
        <Text style={[styles.status, statusTone]}>{duel.status}</Text>
      </View>
      <Text style={styles.meta}>Stake: {duel.stakeAmount} SOL</Text>
      <Text style={styles.meta}>Start: {duel.startTime ? new Date(duel.startTime).toLocaleString() : "TBD"}</Text>
      <Text style={styles.meta}>Duel ID: {String(duel._id)}</Text>
      <View style={styles.inlineActions}>
        <TouchableOpacity onPress={onPrimaryPress} style={styles.inlineButton}>
          <Text style={styles.inlineButtonText}>{onPrimaryLabel}</Text>
        </TouchableOpacity>
        {onSecondaryLabel && onSecondaryPress ? (
          <TouchableOpacity onPress={onSecondaryPress} style={styles.inlineButtonDanger}>
            <Text style={styles.inlineButtonText}>{onSecondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  header: {
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: 2,
    color: C.mana,
    textTransform: "uppercase",
  },
  sub: {
    color: C.slate500,
    marginTop: 8,
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
    textAlign: "center",
  },
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
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroTitle: {
    color: C.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 10,
  },
  heroText: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 20,
  },
  heroActionRow: {
    marginTop: 16,
  },
  lookupWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  inviteWindow: {
    borderColor: C.success,
    backgroundColor: "rgba(255,210,111,0.08)",
  },
  inviteTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    color: C.white,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  hint: { color: C.slate500, fontSize: 12, lineHeight: 18, marginTop: 10 },
  meta: { color: C.slate400, fontSize: 12, lineHeight: 18 },
  list: { gap: 10 },
  empty: { color: C.slate600, fontStyle: "italic", fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  compactCard: { opacity: 0.82 },
  cardTitle: { color: C.white, fontFamily: "monospace", fontSize: 11, letterSpacing: 1 },
  status: { fontFamily: "monospace", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" },
  statusActive: { color: C.success },
  statusOpen: { color: C.mana },
  statusMuted: { color: C.slate400 },
  inlineActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  inlineButton: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    backgroundColor: C.manaDim,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  inlineButtonDanger: {
    borderWidth: 1,
    borderColor: "rgba(255,107,26,0.4)",
    backgroundColor: "rgba(255,107,26,0.12)",
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  inlineButtonText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(11,6,3,0.88)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "rgba(35,19,9,0.98)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.manaBorder,
    padding: 18,
    gap: 10,
  },
  modalTitle: { color: C.white, fontSize: 22, fontWeight: "800" },
  modalLabel: {
    color: C.slate400,
    fontSize: 11,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 6 },
  chip: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipSelected: { borderColor: C.mana, backgroundColor: C.manaDim },
  chipText: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
  },
  chipTextSelected: { color: C.white },
  contractText: { color: C.slate400, fontSize: 13, lineHeight: 20 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: C.slate500,
    borderRadius: 5,
  },
  checkBoxActive: { borderColor: C.mana, backgroundColor: C.mana },
  checkText: { flex: 1, color: C.slate400, fontSize: 12, lineHeight: 18 },
  actionStack: { gap: 10, marginTop: 8 },
});
