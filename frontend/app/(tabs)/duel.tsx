import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useMemo, useState } from "react";
import {
  Alert,
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
const FLOW_RAIL = [
  { title: "Escrow", body: "Create and join move SOL on-chain and lock custody." },
  { title: "Daily loop", body: "Check-ins and strikes live off-chain for speed." },
  { title: "Resolution", body: "Once resolved, the frontend enables the settlement moment." },
];

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
  const [manualDuelId, setManualDuelId] = useState("");
  const [resolvedInviteId, setResolvedInviteId] = useState<Id<"duels"> | null>(
    typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : null,
  );
  const [readChecked, setReadChecked] = useState(false);

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
  const inviteOnchainDuelAddress = (inviteDuel as any)?.onchainDuelAddress as string | undefined;
  const inviteOnchainEscrowAddress = (inviteDuel as any)?.onchainEscrowAddress as string | undefined;

  const handleCreateInvite = async () => {
    if (!walletAddress) return;

    setCreateLoading(true);
    const startTime = Date.now() + startInMins * 60 * 1000;
    let onChainDuel:
      | Awaited<ReturnType<typeof wallet.createDuel>>
      | null = null;
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
      } as any);

      setShowCreateModal(false);
      Alert.alert(
        "Duel created",
        `On-chain duel ${onChainDuel.duelAddress.slice(0, 8)}... confirmed.`,
      );
      await shareInviteLink(String(duelId));
    } catch (error: any) {
      const message =
        onChainDuel
          ? `On-chain duel was created at ${onChainDuel.duelAddress}, but the backend record failed. Tx: ${onChainDuel.signature}`
          : (error?.message ?? "Could not create duel invite");
      Alert.alert("Create failed", message);
    } finally {
      setCreateLoading(false);
    }
  };

  const shareInviteLink = async (duelId: string) => {
    const inviteUrl = Linking.createURL("/duel", { queryParams: { duelId } });
    await Share.share({
      message: `Join my friend duel gate: ${inviteUrl}`,
      url: inviteUrl,
    });
  };

  const handleResolveManualInvite = () => {
    const id = manualDuelId.trim();
    if (!id) return;
    setResolvedInviteId(id as Id<"duels">);
  };

  const handleJoinInvite = async () => {
    if (!user || !inviteDuel || !canJoinInvite) return;
    if (!readChecked) {
      Alert.alert("Read Contract", "Please read and confirm the contract first.");
      return;
    }
    if (!inviteOnchainDuelAddress) {
      Alert.alert("Join failed", "This duel is missing on-chain metadata. Recreate the invite.");
      return;
    }

    setJoinInviteLoading(true);
    let onChainJoin:
      | Awaited<ReturnType<typeof wallet.joinDuel>>
      | null = null;
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
      Alert.alert("Gate joined", "You have joined this duel.");
    } catch (error: any) {
      const message =
        onChainJoin
          ? `On-chain join succeeded for ${onChainJoin.duelAddress}, but backend activation failed. Tx: ${onChainJoin.signature}`
          : (error?.message ?? "Could not join duel");
      Alert.alert("Join failed", message);
    } finally {
      setJoinInviteLoading(false);
    }
  };

  const handleCancelOpen = async (duel: Doc<"duels">) => {
    if (!user) return;
    try {
      await cancelOpenDuel({ duelId: duel._id, caller: user._id });
      Alert.alert("Gate cancelled", "Open duel cancelled.");
    } catch (error: any) {
      Alert.alert("Cancel failed", error?.message ?? "Could not cancel duel");
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
          <View style={styles.rowBetween}>
            <View style={styles.heroCopy}>
              <Text style={styles.sectionLabel}>Duel Board</Text>
              <Text style={styles.heroTitle}>Run the full duel loop from one screen.</Text>
              <Text style={styles.heroText}>
                Invite a friend, monitor live gates, and move from resolution to settlement without losing the game feel.
              </Text>
            </View>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>{activeDuels.length} ACTIVE</Text>
            </View>
          </View>
          <View style={styles.heroActionRow}>
            <GateButton label="Invite Friend" onPress={() => setShowCreateModal(true)} />
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>Open by Duel ID</Text>
          <TextInput
            value={manualDuelId}
            onChangeText={setManualDuelId}
            placeholder="paste duel id"
            placeholderTextColor={C.slate600}
            autoCapitalize="none"
            style={styles.input}
          />
          <GateButton label="Load Invite" onPress={handleResolveManualInvite} />
          <Text style={styles.hint}>Deep links land here automatically. Manual load helps during testing.</Text>
        </SystemWindow>

        <SystemWindow style={styles.flowWindow}>
          <Text style={styles.sectionLabel}>Game Rail</Text>
          <View style={styles.railList}>
            {FLOW_RAIL.map((item) => (
              <View key={item.title} style={styles.railCard}>
                <Text style={styles.railTitle}>{item.title}</Text>
                <Text style={styles.railBody}>{item.body}</Text>
              </View>
            ))}
          </View>
        </SystemWindow>

        {resolvedInviteId && inviteDuel && (
          <SystemWindow style={styles.inviteWindow}>
            <Text style={styles.sectionLabel}>Friend Invite Found</Text>
            <Text style={styles.inviteTitle}>{inviteDuel.stakeAmount} SOL challenge</Text>
            <Text style={styles.meta}>Starts: {inviteDuel.startTime ? new Date(inviteDuel.startTime).toLocaleString() : "TBD"}</Text>
            <Text style={styles.meta}>Status: {inviteDuel.status}</Text>
            <Text style={styles.meta}>Duel ID</Text>
            <Text style={styles.selectableId} selectable>
              {String(inviteDuel._id)}
            </Text>

            <View style={styles.topActions}>
              <GateButton
                label="Review Contract"
                onPress={() => setShowContractModal(true)}
                disabled={!canJoinInvite}
              />
            </View>

            {!canJoinInvite ? (
              <Text style={styles.inviteHint}>
                {inviteDuel.status !== "OPEN"
                  ? "This invite is no longer open."
                  : inviteDuel.player1 === user._id
                    ? "This is your own invite. Share it with your friend."
                    : "Invite unavailable."}
              </Text>
            ) : null}
          </SystemWindow>
        )}

        <Section title="Active Gates" emptyText="No active gate running.">
          {activeDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              mineId={user._id}
              onShare={shareInviteLink}
              onEnterBattle={() =>
                router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any)
              }
            />
          ))}
        </Section>

        <Section title="Open Invites" emptyText="No open invites.">
          {openDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              mineId={user._id}
              onShare={shareInviteLink}
              onCancel={handleCancelOpen}
            />
          ))}
        </Section>

        <Section title="Duel History" emptyText="No completed duels yet.">
          {historyDuels.map((duel) => (
            <DuelCard key={duel._id} duel={duel} mineId={user._id} onShare={shareInviteLink} compact />
          ))}
        </Section>
      </ScrollView>

      <Modal transparent visible={showCreateModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forge Invite Gate</Text>

            <Text style={styles.modalLabel}>Stake</Text>
            <View style={styles.chipRow}>
              {STAKES.map((value) => {
                const selected = value === stakeAmount;
                return (
                  <Chip
                    key={value}
                    label={`${value} SOL`}
                    selected={selected}
                    onPress={() => setStakeAmount(value)}
                  />
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Starts in</Text>
            <View style={styles.chipRow}>
              {START_MINUTES.map((value) => {
                const selected = value === startInMins;
                return (
                  <Chip
                    key={value}
                    label={`${value}m`}
                    selected={selected}
                    onPress={() => setStartInMins(value)}
                  />
                );
              })}
            </View>

            <View style={styles.summaryStrip}>
              <Text style={styles.summaryTitle}>What happens next</Text>
              <Text style={styles.summaryText}>Create locks escrow on-chain. Your friend joins. Daily streaks stay off-chain until settlement.</Text>
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
            <Text style={styles.modalTitle}>Self Contract</Text>
            <Text style={styles.contractText}>
              Join a 7-day discipline duel. Stakes are already secured on-chain, daily proof is tracked off-chain, and settlement only unlocks after resolution.
            </Text>
            {inviteDuel ? (
              <View style={styles.contractMetaWrap}>
                <Text style={styles.modalLabel}>Stake: {inviteDuel.stakeAmount} SOL</Text>
                <Text style={styles.modalLabel}>Duration: 7 Days</Text>
                <Text style={styles.modalLabel}>Mode: FRIEND DUEL</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.checkRow} onPress={() => setReadChecked((v) => !v)}>
              <View style={[styles.checkBox, readChecked && styles.checkBoxActive]} />
              <Text style={styles.checkText}>I understand the rules and accept the payout path.</Text>
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
  mineId,
  onShare,
  onCancel,
  onEnterBattle,
  compact,
}: {
  duel: Doc<"duels">;
  mineId: Doc<"users">["_id"];
  onShare: (duelId: string) => Promise<void>;
  onCancel?: (duel: Doc<"duels">) => Promise<void>;
  onEnterBattle?: () => void;
  compact?: boolean;
}) {
  const isCreator = duel.player1 === mineId;
  const showInviteActions = duel.status === "OPEN" && isCreator;
  const statusTone = duel.status === "ACTIVE" ? styles.statusActive : duel.status === "OPEN" ? styles.statusOpen : styles.statusMuted;

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{duel.mode} GATE</Text>
        <Text style={[styles.status, statusTone]}>{duel.status}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Stake: {duel.stakeAmount} SOL</Text>
        <Text style={styles.meta}>Start: {duel.startTime ? new Date(duel.startTime).toLocaleString() : "TBD"}</Text>
      </View>

      <Text style={styles.meta}>Duel ID</Text>
      <Text style={styles.selectableId} selectable>
        {String(duel._id)}
      </Text>

      {showInviteActions ? (
        <View style={styles.inlineActions}>
          <TouchableOpacity onPress={() => void onShare(String(duel._id))} style={styles.inlineButton}>
            <Text style={styles.inlineButtonText}>Share Invite</Text>
          </TouchableOpacity>

          {onCancel ? (
            <TouchableOpacity onPress={() => void onCancel(duel)} style={styles.inlineButtonDanger}>
              <Text style={styles.inlineButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {duel.status === "ACTIVE" && onEnterBattle ? (
        <View style={styles.inlineActions}>
          <TouchableOpacity onPress={onEnterBattle} style={styles.inlineButton}>
            <Text style={styles.inlineButtonText}>Enter Battle</Text>
          </TouchableOpacity>
        </View>
      ) : null}
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
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 16,
    gap: 14,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: C.bg,
  },
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
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    color: C.white,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  heroText: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 20,
  },
  heroActionRow: {
    marginTop: 16,
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
    marginBottom: 10,
    fontSize: 14,
  },
  hint: {
    color: C.slate500,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 10,
  },
  livePill: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.manaDim,
  },
  livePillText: {
    color: C.mana,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  flowWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  railList: {
    gap: 10,
  },
  railCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  railTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  railBody: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
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
  selectableId: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    paddingVertical: 4,
  },
  inviteHint: {
    color: C.slate500,
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
  },
  topActions: {
    marginTop: 12,
  },
  list: {
    gap: 10,
  },
  empty: {
    color: C.slate600,
    fontStyle: "italic",
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  compactCard: {
    opacity: 0.82,
  },
  cardTitle: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1,
  },
  status: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  statusActive: {
    color: C.success,
  },
  statusOpen: {
    color: C.mana,
  },
  statusMuted: {
    color: C.slate400,
  },
  metaRow: {
    gap: 4,
  },
  meta: {
    color: C.slate400,
    fontSize: 12,
    lineHeight: 18,
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
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
  modalTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
  },
  modalLabel: {
    color: C.slate400,
    fontSize: 11,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  contractText: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
  },
  contractMetaWrap: {
    gap: 4,
    marginTop: 4,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  checkBox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: C.slate500,
    borderRadius: 5,
    backgroundColor: "transparent",
  },
  checkBoxActive: {
    borderColor: C.mana,
    backgroundColor: C.mana,
  },
  checkText: {
    flex: 1,
    color: C.slate400,
    fontSize: 12,
    lineHeight: 18,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  chipSelected: {
    borderColor: C.mana,
    backgroundColor: C.manaDim,
  },
  chipText: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
  },
  chipTextSelected: {
    color: C.white,
  },
  summaryStrip: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,138,31,0.08)",
    borderWidth: 1,
    borderColor: C.manaBorder,
    gap: 4,
  },
  summaryTitle: {
    color: C.mana,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  summaryText: {
    color: C.white,
    fontSize: 13,
    lineHeight: 19,
  },
  actionStack: {
    gap: 10,
  },
});
