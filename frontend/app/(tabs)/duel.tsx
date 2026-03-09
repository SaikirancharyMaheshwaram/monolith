import { CharacterAvatar } from "@/components/CharacterAvatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { formatDuelStatus, getDuelDescription, getDuelTitle } from "@/lib/duel-copy";
import { DuelWithParticipants, getParticipantLabel, toDuelId } from "@/lib/duel-view";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ReactNode, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

const QUICK_STAKES = [0.1, 0.5, 1, 2];
const DURATION_OPTIONS = [7, 30, 365];
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type FeedbackState = {
  visible: boolean;
  tone: "success" | "error";
  title: string;
  message: string;
};

type SheetMode = "create" | "join" | null;

const EMPTY_FEEDBACK: FeedbackState = {
  visible: false,
  tone: "success",
  title: "",
  message: "",
};

const C = {
  bg: "#030304",
  orange: "#ff6b35",
  orangeLight: "#ff8f66",
  green: "#00d68f",
  red: "#ff3b5c",
  yellow: "#ffc107",
  purple: "#a855f7",
  white: "#ffffff",
  muted: "#555",
  mutedBright: "#8d8d96",
  surface: "rgba(12,12,16,0.85)",
  surfaceHover: "rgba(20,20,28,0.9)",
  overlay: "rgba(5,5,8,0.98)",
  border: "rgba(255,255,255,0.06)",
  borderGlow: "rgba(255,107,53,0.3)",
};

export default function DuelHubScreen() {
  const wallet = useWallet();
  const router = useRouter();
  const params = useLocalSearchParams<{ duelId?: string }>();

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [stakeInput, setStakeInput] = useState("0.5");
  const [durationDays, setDurationDays] = useState(7);
  const [duelTitle, setDuelTitle] = useState("");
  const [duelDescription, setDuelDescription] = useState("");
  const [manualDuelId, setManualDuelId] = useState(
    typeof params.duelId === "string" ? params.duelId : "",
  );
  const [resolvedInviteId, setResolvedInviteId] = useState<Id<"duels"> | null>(
    toDuelId(params.duelId),
  );
  const [readChecked, setReadChecked] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [joinInviteLoading, setJoinInviteLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);

  const createFriendDuel = useMutation(api.duels.createFriendDuel.createFriendDuel);
  const cancelOpenDuel = useMutation(api.duels.cancelOpenDuel.cancelOpenDuel);
  const joinFriendDuel = useMutation(api.duels.joinFriendDuel.joinFriendDuel);

  const meshPulse = useSharedValue(0);
  const arenaGlow = useSharedValue(0);
  useEffect(() => {
    meshPulse.value = withRepeat(
      withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    arenaGlow.value = withRepeat(
      withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [arenaGlow, meshPulse]);

  const duelBgGlow = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(meshPulse.value, [0, 1], [1, 1.2]) }],
    opacity: interpolate(meshPulse.value, [0, 1], [0.45, 0.82]),
  }));

  const meshStyle = useAnimatedStyle(() => ({
    opacity: interpolate(arenaGlow.value, [0, 1], [1, 0.82]),
    transform: [{ scale: interpolate(arenaGlow.value, [0, 1], [1, 1.05]) }],
  }));

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const duels = useQuery(
    api.duels.getUserDuels.getUserDuels,
    user ? { userId: user._id } : "skip",
  ) as DuelWithParticipants[] | undefined;
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

  useEffect(() => {
    if (params.duelId) setSheetMode("join");
  }, [params.duelId]);

  const activeDuels = (duels ?? []).filter((d) => d.status === "ACTIVE");
  const openDuels = (duels ?? []).filter((d) => d.status === "OPEN");
  const ongoingDuels = [...activeDuels, ...openDuels];
  const resolvedDuels = (duels ?? []).filter(
    (d) => d.status === "COMPLETED" || d.status === "RESOLVED" || d.status === "CANCELLED",
  );

  const canJoinInvite = useMemo(() => {
    if (!user || !inviteDuel) return false;
    if (inviteDuel.status !== "OPEN") return false;
    if (inviteDuel.player1 === user._id) return false;
    return true;
  }, [inviteDuel, user]);

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const shareInviteLink = async (duelId: string) => {
    // const inviteUrl = Linking.createURL("/duel", { queryParams: { duelId } });
    const inviteUrl = `https://strivioz.vercel.app/duel/${duelId}`;
    await Share.share({
      message: `Join my friend duel gate: ${inviteUrl}`,
      url: inviteUrl,
    });
  };

  const resetCreate = () => {
    setStakeInput("0.5");
    setDurationDays(7);
    setDuelTitle("");
    setDuelDescription("");
  };

  const handleCreateInvite = async () => {
    const stakeAmount = Number.parseFloat(stakeInput);
    if (!walletAddress) return;
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      openFeedback("error", "Invalid Stake", "Enter a valid SOL amount greater than zero.");
      return;
    }

    setCreateLoading(true);
    const startTime = Date.now() + HOUR_MS;
    const endTime = startTime + durationDays * DAY_MS;
    let onChainDuel: Awaited<ReturnType<typeof wallet.createDuel>> | null = null;

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

      setSheetMode(null);
      resetCreate();
      openFeedback(
        "success",
        "Duel Created",
        `Duel ${String(duelId)} is live and stake escrow has been locked.`,
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
      openFeedback("error", "Contract Required", "Read and confirm the stake rules before joining.");
      return;
    }
    if (!inviteDuel.onchainDuelAddress) {
      openFeedback("error", "Join Failed", "This duel is missing on-chain metadata.");
      return;
    }

    setJoinInviteLoading(true);
    let onChainJoin: Awaited<ReturnType<typeof wallet.joinDuel>> | null = null;
    try {
      onChainJoin = await wallet.joinDuel({
        duelAddress: inviteDuel.onchainDuelAddress,
        escrowAddress: inviteDuel.onchainEscrowAddress,
      });
      await joinFriendDuel({
        duelId: inviteDuel._id,
        player2: user._id,
      });
      setSheetMode(null);
      setReadChecked(false);
      openFeedback(
        "success",
        "Joined Duel",
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
      openFeedback("success", "Duel Cancelled", "The duel was cancelled on-chain and in Convex.");
    } catch (error: any) {
      openFeedback("error", "Cancel Failed", error?.message ?? "Could not cancel duel.");
    }
  };

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ArenaBackground duelBgGlow={duelBgGlow} meshStyle={meshStyle} />
        <View style={styles.centered}>
          <Text style={styles.lockTitle}>DUEL BOARD LOCKED</Text>
          <Text style={styles.lockCopy}>Connect wallet to create or join friend duels.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (user === undefined || duels === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ArenaBackground duelBgGlow={duelBgGlow} meshStyle={meshStyle} />
        <View style={styles.centered}>
          <Text style={styles.lockTitle}>SYNCING DUEL LOGS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ArenaBackground duelBgGlow={duelBgGlow} meshStyle={meshStyle} />
        <View style={styles.centered}>
          <Text style={styles.lockTitle}>NO HUNTER PROFILE</Text>
          <Text style={styles.lockCopy}>Complete registration on Home first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const stakeAmount = Number.parseFloat(stakeInput);
  const winAmount = Number.isFinite(stakeAmount) ? `${(stakeAmount * 0.7).toFixed(2)} SOL` : "--";
  const vaultAmount = Number.isFinite(stakeAmount) ? `${(stakeAmount * 0.25).toFixed(2)} SOL` : "--";
  const hasInviteInput = manualDuelId.trim().length > 0;
  const hasValidInviteFormat = !hasInviteInput || !!toDuelId(manualDuelId.trim());

  return (
    <SafeAreaView style={styles.safeArea}>
      <ArenaBackground duelBgGlow={duelBgGlow} meshStyle={meshStyle} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(420)} style={styles.headerWrap}>
          <Text style={styles.screenTitle}>The Arena</Text>
          <Text style={styles.screenSubtitle}>Select a duel to view details</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(440).delay(40)} style={styles.buttonGrid}>
          <ActionButton label="Create" primary onPress={() => setSheetMode("create")} />
          <ActionButton label="Join" onPress={() => setSheetMode("join")} />
        </Animated.View>

        <SectionTitle title="Ongoing Duels" />
        {ongoingDuels.length === 0 ? (
          <EmptyCard text="No ongoing duels yet." />
        ) : (
          ongoingDuels.map((duel, index) => (
            <Animated.View key={duel._id} entering={FadeInDown.duration(380).delay(60 + index * 35)}>
              <DuelRow
                duel={duel}
                onPress={() =>
                  router.push(`/(tabs)/duel/${encodeURIComponent(String(duel._id))}` as any)
                }
              />
              {duel.status === "OPEN" ? (
                <View style={styles.rowActionWrap}>
                  <SmallAction label="Share Invite" onPress={() => void shareInviteLink(String(duel._id))} />
                  <SmallAction danger label="Cancel Duel" onPress={() => void handleCancelOpen(duel)} />
                </View>
              ) : null}
            </Animated.View>
          ))
        )}

        <SectionTitle title="Resolved Duels" />
        {resolvedDuels.length === 0 ? (
          <EmptyCard text="No completed duels yet." />
        ) : (
          resolvedDuels.map((duel, index) => (
            <Animated.View key={duel._id} entering={FadeInDown.duration(380).delay(90 + index * 35)}>
              <DuelRow
                duel={duel}
                resolved
                onPress={() =>
                  router.push(`/(tabs)/duel/${encodeURIComponent(String(duel._id))}` as any)
                }
              />
            </Animated.View>
          ))
        )}
      </ScrollView>

      <PremiumSheet visible={sheetMode === "create"} onClose={() => !createLoading && setSheetMode(null)}>
        <Text style={styles.sheetTitle}>Create Duel</Text>
        <SheetLabel label="Stake Amount" />
        <TextInput
          value={stakeInput}
          onChangeText={setStakeInput}
          placeholder="0.5 SOL"
          placeholderTextColor={C.muted}
          keyboardType="decimal-pad"
          style={styles.input}
        />

        <SheetLabel label="Duration" />
        <View style={styles.chipGroup}>
          {DURATION_OPTIONS.map((value) => (
            <Chip
              key={value}
              label={`${value} Days`}
              selected={durationDays === value}
              onPress={() => setDurationDays(value)}
            />
          ))}
        </View>

        <View style={styles.chipGroupCompact}>
          {QUICK_STAKES.map((value) => (
            <Chip
              key={value}
              label={`${value} SOL`}
              selected={Number(stakeInput) === value}
              onPress={() => setStakeInput(String(value))}
            />
          ))}
        </View>

        <TextInput
          value={duelTitle}
          onChangeText={setDuelTitle}
          placeholder="Optional duel title"
          placeholderTextColor={C.muted}
          style={styles.input}
        />
        <TextInput
          value={duelDescription}
          onChangeText={setDuelDescription}
          placeholder="Optional duel description"
          placeholderTextColor={C.muted}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <View style={styles.previewBox}>
          <PreviewRow label="You Win (70%)" value={winAmount} success />
          <PreviewRow label="Loser Vault (25%)" value={vaultAmount} danger />
        </View>

        <TouchableOpacity
          style={[styles.primarySheetButton, createLoading && styles.disabled]}
          onPress={() => void handleCreateInvite()}
          disabled={createLoading}
        >
          <Text style={styles.primarySheetButtonText}>
            {createLoading ? "Creating..." : "Create & Lock"}
          </Text>
        </TouchableOpacity>
      </PremiumSheet>

      <PremiumSheet visible={sheetMode === "join"} onClose={() => !joinInviteLoading && setSheetMode(null)}>
        <Text style={styles.sheetTitle}>Join Duel</Text>
        <SheetLabel label="Invite Code" />
        <TextInput
          value={manualDuelId}
          onChangeText={setManualDuelId}
          placeholder="Enter Code"
          placeholderTextColor={C.muted}
          autoCapitalize="none"
          style={styles.input}
        />

        {resolvedInviteId && inviteDuel ? (
          <View style={styles.invitePreview}>
            <View style={styles.invitePreviewTop}>
              <View style={styles.inviteAvatarRow}>
                <CharacterAvatar
                  characterId={inviteDuel.player1User?.selectedCharacter}
                  label={inviteDuel.player1User?.username}
                  size={40}
                />
                <CharacterAvatar
                  characterId={inviteDuel.player2User?.selectedCharacter ?? user.selectedCharacter}
                  label={inviteDuel.player2User?.username ?? user.username}
                  size={40}
                />
              </View>
              <Text style={styles.invitePreviewStatus}>{formatDuelStatus(inviteDuel.status as any)}</Text>
            </View>
            <Text style={styles.invitePreviewTitle}>{getDuelTitle(inviteDuel)}</Text>
            <Text style={styles.invitePreviewCopy}>{getDuelDescription(inviteDuel)}</Text>
          </View>
        ) : hasInviteInput ? (
          <View style={styles.invitePreview}>
            <Text style={styles.invitePreviewTitle}>Invite lookup</Text>
            <Text style={styles.invitePreviewCopy}>
              {hasValidInviteFormat
                ? "No duel found for that id yet."
                : "That duel id format looks invalid."}
            </Text>
          </View>
        ) : null}

        <Pressable style={styles.checkRow} onPress={() => setReadChecked((v) => !v)}>
          <View style={[styles.checkbox, readChecked && styles.checkboxActive]} />
          <Text style={styles.checkText}>I understand the duel flow and accept the stake rules.</Text>
        </Pressable>

        <TouchableOpacity
          style={[
            styles.primarySheetButton,
            (!readChecked || !canJoinInvite || joinInviteLoading) && styles.disabled,
          ]}
          onPress={() => void handleJoinInvite()}
          disabled={!readChecked || !canJoinInvite || joinInviteLoading}
        >
          <Text style={styles.primarySheetButtonText}>
            {joinInviteLoading ? "Joining..." : "Join & Lock Stake"}
          </Text>
        </TouchableOpacity>
      </PremiumSheet>

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

function ArenaBackground({
  duelBgGlow,
  meshStyle,
}: {
  duelBgGlow: ReturnType<typeof useAnimatedStyle>;
  meshStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <>
      <Animated.View style={[styles.bgDuels, meshStyle]} />
      <Animated.View style={[styles.bgDuelsCore, duelBgGlow]} />
      <View style={styles.bgNoise} />
      <View style={styles.particles}>
        {Array.from({ length: 7 }).map((_, index) => (
          <FloatingParticle key={index} index={index} />
        ))}
      </View>
    </>
  );
}

function FloatingParticle({ index }: { index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 260,
      withRepeat(
        withTiming(1, { duration: 10000 + index * 500, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.35, 0.35, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [700, -100]) },
      { scale: interpolate(progress.value, [0, 1], [0, 1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        { left: `${10 + index * 13}%`, backgroundColor: index % 2 === 0 ? C.orange : C.green },
      ]}
    />
  );
}

function ActionButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.actionButton, primary ? styles.actionButtonPrimary : styles.actionButtonSecondary]} onPress={onPress}>
      <Text style={[styles.actionButtonText, !primary && styles.actionButtonTextSecondary]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

function DuelRow({
  duel,
  resolved,
  onPress,
}: {
  duel: DuelWithParticipants;
  resolved?: boolean;
  onPress: () => void;
}) {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(withTiming(1, { duration: 500 }), withTiming(0, { duration: 500 })),
      -1,
      false,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.14]) }],
  }));

  const rowTitle = formatRowTitle(duel);
  const rowCopy = resolved ? formatResolvedCopy(duel) : formatActiveCopy(duel);
  const badgeValue = resolved ? formatResolvedTag(duel) : getBadgeValue(duel);

  return (
    <TouchableOpacity style={[styles.duelRow, resolved && styles.duelRowResolved]} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.duelInfo}>
        <View style={styles.duelAvatarShell}>
          <CharacterAvatar
            characterId={duel.player1User?.selectedCharacter ?? duel.player2User?.selectedCharacter}
            label={duel.player1User?.username}
            size={48}
          />
        </View>
        <View style={styles.duelMeta}>
          <Text style={styles.duelMetaTitle}>{rowTitle}</Text>
          <Text style={[styles.duelMetaSub, resolved && styles.duelMetaSubResolved]}>{rowCopy}</Text>
        </View>
      </View>
      <View style={[styles.duelBadge, resolved && styles.duelBadgeResolved]}>
        {!resolved ? <Animated.View style={[styles.fireDot, pulseStyle]} /> : null}
        <Text style={[styles.duelBadgeText, resolved && styles.duelBadgeTextResolved]}>{badgeValue}</Text>
      </View>
    </TouchableOpacity>
  );
}

function SmallAction({
  label,
  danger,
  onPress,
}: {
  label: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={[styles.smallAction, danger && styles.smallActionDanger]} onPress={onPress}>
      <Text style={[styles.smallActionText, danger && styles.smallActionTextDanger]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PremiumSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: visible ? 360 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [180, 0]) }],
    opacity: progress.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalOverlay, overlayStyle]}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[styles.modalContent, sheetStyle]}>
          <View style={styles.modalHandle} />
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function SheetLabel({ label }: { label: string }) {
  return <Text style={styles.sheetLabel}>{label}</Text>;
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
    <TouchableOpacity style={[styles.chip, selected && styles.chipActive]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function PreviewRow({
  label,
  value,
  success,
  danger,
}: {
  label: string;
  value: string;
  success?: boolean;
  danger?: boolean;
}) {
  return (
    <View style={styles.previewRow}>
      <Text style={styles.previewLabel}>{label}</Text>
      <Text
        style={[
          styles.previewValue,
          success && { color: C.green },
          danger && { color: C.red },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function formatRowTitle(duel: DuelWithParticipants) {
  const p1 = duel.player1User?.username ?? getParticipantLabel(duel, "player1");
  const p2 =
    duel.player2User?.username ??
    (duel.status === "OPEN" ? "Waiting" : getParticipantLabel(duel, "player2"));
  return `${p1} vs ${p2}`;
}

function formatActiveCopy(duel: DuelWithParticipants) {
  if (duel.status === "OPEN") return `Open • ${formatTimeUntil(duel.startTime, "Starts in")}`;
  return `Active • ${formatTimeUntil(duel.endTime, "Ends in")}`;
}

function formatResolvedCopy(duel: DuelWithParticipants) {
  if (duel.status === "CANCELLED") return "Cancelled before activation";
  if (duel.winner) {
    const mine = duel.player1User?.username ? `vs ${duel.player1User.username}` : "resolved";
    return `Completed • ${mine}`;
  }
  return "Resolved duel";
}

function formatResolvedTag(duel: DuelWithParticipants) {
  if (duel.status === "CANCELLED") return "VOID";
  return duel.winner ? "DONE" : "END";
}

function getBadgeValue(duel: DuelWithParticipants) {
  if (duel.status === "OPEN") return `${duel.stakeAmount}`;
  return String(Math.max(1, Math.ceil(duel.stakeAmount * 10)));
}

function formatTimeUntil(timestamp?: number, prefix = "") {
  if (!timestamp) return "TBD";
  const diff = timestamp - Date.now();
  if (diff <= 0) return prefix ? `${prefix} now` : "now";
  const days = Math.floor(diff / DAY_MS);
  const hours = Math.floor((diff % DAY_MS) / HOUR_MS);
  if (days > 0) return `${prefix} ${days}d`;
  if (hours > 0) return `${prefix} ${hours}h`;
  return `${prefix} soon`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  lockTitle: { color: C.white, fontSize: 24, fontWeight: "800", textAlign: "center" },
  lockCopy: { marginTop: 8, color: C.mutedBright, fontSize: 12, textAlign: "center" },
  bgDuels: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.bg,
  },
  bgDuelsCore: {
    position: "absolute",
    top: "10%",
    left: "50%",
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.1)",
  },
  bgNoise: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.025,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  particles: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  particle: { position: "absolute", width: 4, height: 4, borderRadius: 999 },
  headerWrap: { alignItems: "center", marginTop: 10, marginBottom: 25 },
  screenTitle: { color: C.white, fontSize: 24, fontWeight: "700" },
  screenSubtitle: { color: C.mutedBright, fontSize: 12, marginTop: 6 },
  buttonGrid: { flexDirection: "row", gap: 12, marginBottom: 28 },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonPrimary: {
    backgroundColor: C.orange,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
  },
  actionButtonSecondary: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.border,
  },
  actionButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  actionButtonTextSecondary: { color: C.white },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14, marginTop: 2 },
  sectionLine: {
    width: 20,
    height: 1,
    backgroundColor: C.orange,
  },
  sectionTitleText: {
    color: "#444",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  emptyCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 20,
    padding: 18,
    marginBottom: 18,
  },
  emptyText: { color: C.mutedBright, fontSize: 13 },
  duelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    marginBottom: 12,
  },
  duelRowResolved: {
    opacity: 0.62,
  },
  duelInfo: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  duelAvatarShell: { borderRadius: 24, overflow: "hidden" },
  duelMeta: { flex: 1 },
  duelMetaTitle: { color: C.white, fontSize: 14, fontWeight: "700" },
  duelMetaSub: { color: C.muted, fontSize: 11, marginTop: 4, fontWeight: "500" },
  duelMetaSubResolved: { color: C.mutedBright },
  duelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,107,53,0.15)",
    borderColor: "rgba(255,107,53,0.2)",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  duelBadgeResolved: {
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  fireDot: { width: 8, height: 8, borderRadius: 8, backgroundColor: C.orange },
  duelBadgeText: { color: C.orange, fontSize: 15, fontWeight: "700" },
  duelBadgeTextResolved: { color: C.white },
  rowActionWrap: { flexDirection: "row", gap: 10, marginBottom: 14, marginTop: -4 },
  smallAction: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 12,
    alignItems: "center",
  },
  smallActionDanger: {
    backgroundColor: "rgba(255,59,92,0.1)",
    borderColor: "rgba(255,59,92,0.2)",
  },
  smallActionText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  smallActionTextDanger: { color: C.red },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#0c0c10",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: "88%",
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#3a3a42",
    alignSelf: "center",
    marginTop: 14,
    marginBottom: 12,
  },
  modalScroll: { paddingHorizontal: 20, paddingBottom: 28 },
  sheetTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 24,
  },
  sheetLabel: {
    color: C.mutedBright,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: C.white,
    fontSize: 14,
    marginBottom: 12,
  },
  textarea: { minHeight: 84, textAlignVertical: "top" },
  chipGroup: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 },
  chipGroupCompact: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.border,
  },
  chipActive: {
    backgroundColor: "rgba(255,107,53,0.1)",
    borderColor: "rgba(255,107,53,0.25)",
  },
  chipText: { color: C.white, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: C.white },
  previewBox: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
  },
  previewRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  previewLabel: { color: "#666", fontSize: 12 },
  previewValue: { color: C.white, fontSize: 14, fontWeight: "700" },
  primarySheetButton: {
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  primarySheetButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  disabled: { opacity: 0.45 },
  invitePreview: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  invitePreviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  inviteAvatarRow: { flexDirection: "row", gap: 8 },
  invitePreviewStatus: { color: C.orange, fontSize: 11, fontWeight: "700" },
  invitePreviewTitle: { color: C.white, fontSize: 16, fontWeight: "700" },
  invitePreviewCopy: { color: C.mutedBright, fontSize: 12, lineHeight: 18, marginTop: 6 },
  checkRow: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 18 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  checkboxActive: { backgroundColor: C.green, borderColor: C.green },
  checkText: { flex: 1, color: C.mutedBright, fontSize: 12, lineHeight: 18 },
});
