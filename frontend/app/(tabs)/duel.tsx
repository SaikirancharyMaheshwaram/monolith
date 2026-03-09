import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  formatDuelStatus,
  formatStartTime,
  getDuelDescription,
  getDuelTitle,
} from "@/lib/duel-copy";
import { DuelWithParticipants, getParticipantLabel, toDuelId } from "@/lib/duel-view";
import { useWallet } from "@/lib/use-wallet";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const QUICK_STAKES = [0.1, 0.5, 1, 2];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type PickerState = { field: "start" | "end"; mode: "date" | "time" } | null;

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
  const defaultStart = new Date(Date.now() + HOUR_MS);
  const defaultEnd = new Date(defaultStart.getTime() + 7 * DAY_MS);
  const [stakeInput, setStakeInput] = useState("1");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(defaultEnd);
  const [duelTitle, setDuelTitle] = useState("");
  const [duelDescription, setDuelDescription] = useState("");
  const [picker, setPicker] = useState<PickerState>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinInviteLoading, setJoinInviteLoading] = useState(false);
  const [manualDuelId, setManualDuelId] = useState(
    typeof params.duelId === "string" ? params.duelId : "",
  );
  const [resolvedInviteId, setResolvedInviteId] = useState<Id<"duels"> | null>(
    toDuelId(params.duelId),
  );
  const [readChecked, setReadChecked] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);

  const createFriendDuel = useMutation(
    api.duels.createFriendDuel.createFriendDuel,
  );
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
  ) as DuelWithParticipants | null | undefined;

  useEffect(() => {
    const nextInviteId = manualDuelId.trim()
      ? toDuelId(manualDuelId)
      : toDuelId(params.duelId);
    setResolvedInviteId(nextInviteId);
  }, [manualDuelId, params.duelId]);

  const activeDuels = (duels ?? []).filter((d) => d.status === "ACTIVE");
  const openDuels = (duels ?? []).filter((d) => d.status === "OPEN");
  const historyDuels = (duels ?? []).filter(
    (d) =>
      d.status === "COMPLETED" ||
      d.status === "RESOLVED" ||
      d.status === "CANCELLED",
  );

  const canJoinInvite = useMemo(() => {
    if (!user || !inviteDuel) return false;
    if (inviteDuel.status !== "OPEN") return false;
    if (inviteDuel.player1 === user._id) return false;
    return true;
  }, [inviteDuel, user]);

  const inviteOnchainDuelAddress = inviteDuel?.onchainDuelAddress;
  const inviteOnchainEscrowAddress = inviteDuel?.onchainEscrowAddress;
  const stakeAmount = Number.parseFloat(stakeInput);
  const typedInviteId = manualDuelId.trim();
  const hasInviteInput = typedInviteId.length > 0;
  const hasValidInviteFormat = !hasInviteInput || !!toDuelId(typedInviteId);

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

  const updateDatePart = (
    field: "start" | "end",
    mode: "date" | "time",
    nextValue: Date,
  ) => {
    const source = field === "start" ? startAt : endAt;
    const merged = new Date(source);

    if (mode === "date") {
      merged.setFullYear(
        nextValue.getFullYear(),
        nextValue.getMonth(),
        nextValue.getDate(),
      );
    } else {
      merged.setHours(nextValue.getHours(), nextValue.getMinutes(), 0, 0);
    }

    if (field === "start") {
      setStartAt(merged);
      if (endAt <= merged) {
        setEndAt(new Date(merged.getTime() + DAY_MS));
      }
      return;
    }

    setEndAt(merged);
  };

  const handlePickerChange = (
    event: DateTimePickerEvent,
    selectedValue?: Date,
  ) => {
    const currentPicker = picker;
    setPicker(null);

    if (!currentPicker || event.type === "dismissed" || !selectedValue) {
      return;
    }

    updateDatePart(currentPicker.field, currentPicker.mode, selectedValue);
  };

  const handleCreateInvite = async () => {
    if (!walletAddress) return;
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      openFeedback(
        "error",
        "Invalid stake",
        "Enter a custom SOL amount greater than zero.",
      );
      return;
    }
    if (startAt.getTime() <= Date.now()) {
      openFeedback(
        "error",
        "Invalid start time",
        "Choose a start date and time in the future.",
      );
      return;
    }
    if (endAt.getTime() <= startAt.getTime()) {
      openFeedback(
        "error",
        "Invalid end time",
        "End date and time must be after the start.",
      );
      return;
    }

    setCreateLoading(true);
    const startTime = startAt.getTime();
    const endTime = endAt.getTime();
    let onChainDuel: Awaited<ReturnType<typeof wallet.createDuel>> | null =
      null;
    try {
      onChainDuel = await wallet.createDuel({
        stakeAmountSol: stakeAmount,
        startTimeMs: startTime,
        endTimeMs: endTime,
      });

      const duelId = await createFriendDuel({
        player1: walletAddress,
        stakeAmount,
        startTime,
        endTime,
        title: duelTitle.trim() || undefined,
        description: duelDescription.trim() || undefined,
        onchainDuelAddress: onChainDuel.duelAddress,
        onchainEscrowAddress: onChainDuel.escrowAddress,
        onchainProgramId: onChainDuel.programId,
        onchainTxSignature: onChainDuel.signature,
        onchainNonce: onChainDuel.duelNonce,
      });

      setShowCreateModal(false);
      setStakeInput("1");
      const nextStart = new Date(Date.now() + HOUR_MS);
      setStartAt(nextStart);
      setEndAt(new Date(nextStart.getTime() + 7 * DAY_MS));
      setDuelTitle("");
      setDuelDescription("");
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
      openFeedback(
        "error",
        "Contract Required",
        "Read and confirm the duel contract before joining.",
      );
      return;
    }
    if (!inviteOnchainDuelAddress) {
      openFeedback(
        "error",
        "Join Failed",
        "This duel is missing on-chain metadata.",
      );
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

  const handleCancelOpen = async (duel: DuelWithParticipants) => {
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
      openFeedback(
        "success",
        "Duel Cancelled",
        "The duel was cancelled on-chain and in Convex.",
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Cancel Failed",
        error?.message ?? "Could not cancel duel.",
      );
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.header}>DUEL BOARD LOCKED</Text>
          <Text style={styles.sub}>
            Connect wallet to create or join friend duels.
          </Text>
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
          <View style={styles.heroGlowSecondary} />
          <Text style={styles.sectionLabel}>Duel Board</Text>
          <Text style={styles.heroEyebrow}>Friend duels</Text>
          <Text style={styles.heroTitle}>Forge, scan, and enter each battle from one board.</Text>
          <Text style={styles.heroText}>
            Shared links open safely, invalid ids stay inside the radar card,
            and every listed duel can jump straight into its own battle view.
          </Text>
          <View style={styles.heroMetrics}>
            <HeroMetric label="Live" value={String(activeDuels.length).padStart(2, "0")} />
            <HeroMetric label="Open" value={String(openDuels.length).padStart(2, "0")} />
            <HeroMetric label="History" value={String(historyDuels.length).padStart(2, "0")} />
          </View>
          <View style={styles.heroActionRow}>
            <GateButton label="Create Challenge" onPress={() => setShowCreateModal(true)} />
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
          <Text style={styles.hint}>
            Paste a shared duel id. Only well-formed ids are queried, so broken links never crash the join flow.
          </Text>
        </SystemWindow>

        {resolvedInviteId && inviteDuel ? (
          <SystemWindow style={styles.inviteWindow}>
            <Text style={styles.sectionLabel}>Live Invite</Text>
            <Text style={styles.inviteTitle}>{getDuelTitle(inviteDuel)}</Text>
            <Text style={styles.meta}>{getDuelDescription(inviteDuel)}</Text>
            <View style={styles.inviteStats}>
              <InviteStat label="Creator" value={getParticipantLabel(inviteDuel, "player1")} />
              <InviteStat label="Rival" value={getParticipantLabel(inviteDuel, "player2")} />
              <InviteStat label="Stake" value={`${inviteDuel.stakeAmount} SOL`} />
              <InviteStat label="State" value={formatDuelStatus(inviteDuel.status as any)} />
            </View>
            <Text style={styles.meta}>
              Starts: {formatStartTime(inviteDuel.startTime)}
            </Text>
            <Text style={styles.meta}>
              Ends: {formatStartTime(inviteDuel.endTime)}
            </Text>
            <Text style={styles.meta}>
              Status: {formatDuelStatus(inviteDuel.status as any)}
            </Text>
            <Text style={styles.meta}>
              On-chain duel:{" "}
              {inviteDuel.onchainDuelAddress ? "Attached" : "Missing"}
            </Text>
            <View style={styles.actionStack}>
              <GateButton
                label="Review Contract"
                onPress={() => setShowContractModal(true)}
                disabled={!canJoinInvite}
              />
              <GateButton
                label="Open Battle Detail"
                variant="ghost"
                onPress={() =>
                  router.push(
                    `/(tabs)/battle?duelId=${encodeURIComponent(String(inviteDuel._id))}` as any,
                  )
                }
              />
            </View>
          </SystemWindow>
        ) : hasInviteInput ? (
          <SystemWindow>
            <Text style={styles.sectionLabel}>Invite Radar</Text>
            <Text style={styles.empty}>
              {hasValidInviteFormat
                ? "No duel found for that id yet."
                : "That duel id format looks invalid. Use the full id from the shared link."}
            </Text>
          </SystemWindow>
        ) : null}

        <Section title="Your Active Gates" emptyText="No active gate running.">
          {activeDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              onPrimaryLabel="Enter PvP"
              onPrimaryPress={() =>
                router.push(
                  `/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any,
                )
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
                router.push(
                  `/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any,
                )
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
            <Text style={styles.modalLabel}>Duel title</Text>
            <TextInput
              value={duelTitle}
              onChangeText={setDuelTitle}
              placeholder="Example: No Sugar Sprint"
              placeholderTextColor={C.slate600}
              style={styles.input}
            />
            <Text style={styles.modalLabel}>Duel description</Text>
            <TextInput
              value={duelDescription}
              onChangeText={setDuelDescription}
              placeholder="What both players are trying to do and why it matters"
              placeholderTextColor={C.slate600}
              multiline
              style={[styles.input, styles.textarea]}
            />
            <Text style={styles.modalLabel}>Stake (SOL)</Text>
            <TextInput
              value={stakeInput}
              onChangeText={setStakeInput}
              placeholder="1.25"
              placeholderTextColor={C.slate600}
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <View style={styles.chipRow}>
              {QUICK_STAKES.map((value) => (
                <Chip
                  key={value}
                  label={`${value} SOL`}
                  selected={Number(stakeInput) === value}
                  onPress={() => setStakeInput(String(value))}
                />
              ))}
            </View>
            <Text style={styles.modalLabel}>Start date and time</Text>
            <View style={styles.scheduleGrid}>
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => setPicker({ field: "start", mode: "date" })}
              >
                <Text style={styles.scheduleLabel}>Date</Text>
                <Text style={styles.scheduleValue}>
                  {startAt.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => setPicker({ field: "start", mode: "time" })}
              >
                <Text style={styles.scheduleLabel}>Time</Text>
                <Text style={styles.scheduleValue}>
                  {startAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>End date and time</Text>
            <View style={styles.scheduleGrid}>
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => setPicker({ field: "end", mode: "date" })}
              >
                <Text style={styles.scheduleLabel}>Date</Text>
                <Text style={styles.scheduleValue}>
                  {endAt.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.scheduleButton}
                onPress={() => setPicker({ field: "end", mode: "time" })}
              >
                <Text style={styles.scheduleLabel}>Time</Text>
                <Text style={styles.scheduleValue}>
                  {endAt.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.hint}>
              Start is when daily check-ins begin. End is the final cutoff for
              scoring the duel.
            </Text>
            <View style={styles.actionStack}>
              <GateButton
                label={createLoading ? "Forging..." : "Create Invite"}
                onPress={handleCreateInvite}
                disabled={createLoading}
              />
              <GateButton
                label="Close"
                variant="ghost"
                onPress={() => setShowCreateModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      {picker ? (
        <DateTimePicker
          value={picker.field === "start" ? startAt : endAt}
          mode={picker.mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          minimumDate={
            picker.field === "start" ? new Date(Date.now() + 60_000) : startAt
          }
          onChange={handlePickerChange}
        />
      ) : null}

      <Modal transparent visible={showContractModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Join Contract</Text>
            <Text style={styles.contractText}>
              Stake joins on-chain. Daily proof stays off-chain. Once resolved,
              settlement moves the final split.
            </Text>
            <TouchableOpacity
              style={styles.checkRow}
              onPress={() => setReadChecked((v) => !v)}
            >
              <View
                style={[styles.checkBox, readChecked && styles.checkBoxActive]}
              />
              <Text style={styles.checkText}>
                I understand the duel flow and accept the stake rules.
              </Text>
            </TouchableOpacity>
            <View style={styles.actionStack}>
              <GateButton
                label={joinInviteLoading ? "Joining..." : "Join Gate"}
                onPress={handleJoinInvite}
                disabled={!readChecked || !canJoinInvite || joinInviteLoading}
              />
              <GateButton
                label="Back"
                variant="ghost"
                onPress={() => setShowContractModal(false)}
              />
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
      {count === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <View style={styles.list}>{children}</View>
      )}
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
  duel: DuelWithParticipants;
  onPrimaryLabel: string;
  onPrimaryPress: () => void;
  onSecondaryLabel?: string;
  onSecondaryPress?: () => void;
  compact?: boolean;
}) {
  const statusTone =
    duel.status === "ACTIVE"
      ? styles.statusActive
      : duel.status === "OPEN"
        ? styles.statusOpen
        : styles.statusMuted;

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{getDuelTitle(duel)}</Text>
        <View style={styles.statusBadge}>
          <Text style={[styles.status, statusTone]}>{formatDuelStatus(duel.status as any)}</Text>
        </View>
      </View>
      <Text style={styles.cardDescription}>{getDuelDescription(duel)}</Text>
      <View style={styles.cardStats}>
        <InviteStat label="Stake" value={`${duel.stakeAmount} SOL`} />
        <InviteStat label="Creator" value={getParticipantLabel(duel, "player1")} />
        <InviteStat label="Rival" value={getParticipantLabel(duel, "player2")} />
        <InviteStat label="Start" value={formatStartTime(duel.startTime)} />
      </View>
      <Text style={styles.meta}>End: {formatStartTime(duel.endTime)}</Text>
      <Text style={styles.meta}>Duel ID: {String(duel._id)}</Text>
      <View style={styles.inlineActions}>
        <TouchableOpacity onPress={onPrimaryPress} style={styles.inlineButton}>
          <Text style={styles.inlineButtonText}>{onPrimaryLabel}</Text>
        </TouchableOpacity>
        {onSecondaryLabel && onSecondaryPress ? (
          <TouchableOpacity
            onPress={onSecondaryPress}
            style={styles.inlineButtonDanger}
          >
            <Text style={styles.inlineButtonText}>{onSecondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroMetricCard}>
      <Text style={styles.heroMetricValue}>{value}</Text>
      <Text style={styles.heroMetricLabel}>{label}</Text>
    </View>
  );
}

function InviteStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.inviteStatCard}>
      <Text style={styles.inviteStatLabel}>{label}</Text>
      <Text style={styles.inviteStatValue}>{value}</Text>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
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
  heroGlowSecondary: {
    position: "absolute",
    left: -28,
    bottom: -36,
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,183,3,0.12)",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  heroEyebrow: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
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
  heroMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroMetricCard: {
    flex: 1,
    minHeight: 74,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "space-between",
  },
  heroMetricValue: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  heroMetricLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
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
  inviteStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginVertical: 14,
  },
  inviteStatCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  inviteStatLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    marginBottom: 6,
  },
  inviteStatValue: {
    color: C.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
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
  textarea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  scheduleGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 6,
  },
  scheduleButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    padding: 12,
    gap: 4,
  },
  scheduleLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  scheduleValue: {
    color: C.white,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  hint: { color: C.slate500, fontSize: 12, lineHeight: 18, marginTop: 10 },
  meta: { color: C.slate400, fontSize: 12, lineHeight: 18 },
  list: { gap: 10 },
  empty: { color: C.slate600, fontStyle: "italic", fontSize: 12 },
  card: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 20,
    padding: 16,
    gap: 10,
  },
  compactCard: { opacity: 0.82 },
  cardTitle: {
    color: C.white,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
  },
  cardDescription: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  cardStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  status: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
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
  },
  checkBoxActive: { borderColor: C.mana, backgroundColor: C.mana },
  checkText: { flex: 1, color: C.slate400, fontSize: 12, lineHeight: 18 },
  actionStack: { gap: 10, marginTop: 8 },
});
