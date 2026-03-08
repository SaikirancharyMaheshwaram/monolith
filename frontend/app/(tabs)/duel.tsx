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
      });

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

    setJoinInviteLoading(true);
    try {
      await joinFriendDuel({
        duelId: inviteDuel._id,
        player2: user._id,
      });
      setShowContractModal(false);
      Alert.alert("Gate joined", "You have joined this duel.");
    } catch (error: any) {
      Alert.alert("Join failed", error?.message ?? "Could not join duel");
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
          <Text style={styles.header}>DUEL TERMINAL</Text>
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
        <SystemWindow>
          <Text style={styles.sectionLabel}>JOIN BY DUEL ID</Text>
          <TextInput
            value={manualDuelId}
            onChangeText={setManualDuelId}
            placeholder="paste duel id"
            placeholderTextColor={C.slate600}
            autoCapitalize="none"
            style={styles.input}
          />
          <View style={styles.actionStack}>
            <GateButton label="Load Invite" onPress={handleResolveManualInvite} />
          </View>
          <Text style={styles.hint}>Invite links also auto-open here via deep link.</Text>
        </SystemWindow>

        {resolvedInviteId && inviteDuel && (
          <SystemWindow style={styles.inviteWindow}>
            <Text style={styles.sectionLabel}>FRIEND INVITE FOUND</Text>
            <Text style={styles.meta}>Duel ID:</Text>
            <Text style={styles.selectableId} selectable>
              {String(inviteDuel._id)}
            </Text>
            <Text style={styles.hint}>Long press duel id to copy.</Text>
            <Text style={styles.meta}>Stake: {inviteDuel.stakeAmount} SOL</Text>
            <Text style={styles.meta}>
              Duration: 7 days
            </Text>
            <Text style={styles.meta}>
              Starts: {inviteDuel.startTime ? new Date(inviteDuel.startTime).toLocaleString() : "TBD"}
            </Text>
            <Text style={styles.meta}>Status: {inviteDuel.status}</Text>

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

        <SystemWindow>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionLabel}>DUEL TERMINAL</Text>
              <Text style={styles.sub}>{user.username} • {user.tier}</Text>
            </View>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>{activeDuels.length} ACTIVE</Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <GateButton label="Invite Friend" onPress={() => setShowCreateModal(true)} />
          </View>
        </SystemWindow>

        <Section title="ACTIVE GATES" emptyText="No active gate running.">
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

        <Section title="OPEN INVITES" emptyText="No open invites.">
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

        <Section title="DUEL HISTORY" emptyText="No completed duels yet.">
          {historyDuels.map((duel) => (
            <DuelCard key={duel._id} duel={duel} mineId={user._id} onShare={shareInviteLink} compact />
          ))}
        </Section>
      </ScrollView>

      <Modal transparent visible={showCreateModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>FORGE INVITE GATE</Text>

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
            <Text style={styles.modalTitle}>SELF CONTRACT</Text>
            <Text style={styles.contractText}>
              By joining this gate, you commit to a 7-day discipline challenge. Missing daily proof may cost your stake.
              Resolution is backend-authoritative.
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
              <Text style={styles.checkText}>I have read and accept this contract.</Text>
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

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{duel.mode} GATE</Text>
        <Text style={[styles.status, duel.status === "ACTIVE" && styles.statusActive]}>{duel.status}</Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Stake: {duel.stakeAmount} SOL</Text>
        <Text style={styles.meta}>Start: {duel.startTime ? new Date(duel.startTime).toLocaleString() : "TBD"}</Text>
      </View>

      <Text style={styles.meta}>Duel ID:</Text>
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
    gap: 12,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
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
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.02)",
    color: C.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    fontFamily: "monospace",
    fontSize: 12,
  },
  hint: {
    color: C.slate500,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 6,
  },
  livePill: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.manaDim,
  },
  livePillText: {
    color: C.mana,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  inviteWindow: {
    borderColor: C.green,
    backgroundColor: "rgba(0,255,163,0.08)",
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
    fontSize: 11,
    fontStyle: "italic",
  },
  topActions: {
    marginTop: 10,
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
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  compactCard: {
    opacity: 0.8,
  },
  cardTitle: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1,
  },
  status: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
  },
  statusActive: {
    color: C.green,
  },
  metaRow: {
    gap: 4,
  },
  meta: {
    color: C.slate400,
    fontSize: 11,
    fontFamily: "monospace",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  inlineButton: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    backgroundColor: C.manaDim,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  inlineButtonDanger: {
    borderWidth: 1,
    borderColor: C.purpleBorder,
    backgroundColor: C.purpleDim,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  inlineButtonText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "rgba(6,15,28,0.98)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.manaBorder,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    color: C.mana,
    fontSize: 12,
    fontFamily: "monospace",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
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
    fontSize: 12,
    lineHeight: 19,
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
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: C.slate500,
    borderRadius: 3,
    backgroundColor: "transparent",
  },
  checkBoxActive: {
    borderColor: C.mana,
    backgroundColor: C.mana,
  },
  checkText: {
    flex: 1,
    color: C.slate400,
    fontSize: 11,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.slate700,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
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
    color: C.mana,
  },
  actionStack: {
    gap: 10,
  },
});
