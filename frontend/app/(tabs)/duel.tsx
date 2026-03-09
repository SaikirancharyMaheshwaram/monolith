import { CharacterAvatar } from "@/components/CharacterAvatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  formatDuelStatus,
  formatStartTime,
  getDuelDescription,
  getDuelTitle,
} from "@/lib/duel-copy";
import {
  DuelWithParticipants,
  getParticipantLabel,
  toDuelId,
} from "@/lib/duel-view";
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
import Animated, {
  Easing,
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
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

const COLORS = {
  bg: "#030304",
  card: "rgba(12,12,16,0.88)",
  cardHover: "rgba(18,18,24,0.96)",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  orange: "#ff6b35",
  orangeSoft: "#ff8f66",
  green: "#00d68f",
  red: "#ff3b5c",
  yellow: "#ffc107",
  purple: "#a855f7",
  text: "#ffffff",
  muted: "#9b9ba3",
  dim: "#676770",
};

const PARTICLES = Array.from({ length: 7 }, (_, i) => i);

export default function DuelHubScreen() {
  const wallet = useWallet();
  const router = useRouter();
  const params = useLocalSearchParams<{ duelId?: string }>();

  const [sheetMode, setSheetMode] = useState<SheetMode>(null);
  const [stakeInput, setStakeInput] = useState("0.5");
  const [durationDays, setDurationDays] = useState(7);
  const [duelTitle, setDuelTitle] = useState("");
  const [duelDescription, setDuelDescription] = useState("");
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

  const createFriendDuel = useMutation(api.duels.createFriendDuel.createFriendDuel);
  const cancelOpenDuel = useMutation(api.duels.cancelOpenDuel.cancelOpenDuel);
  const joinFriendDuel = useMutation(api.duels.joinFriendDuel.joinFriendDuel);

  const mesh = useSharedValue(0);
  useEffect(() => {
    mesh.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [mesh]);

  const meshStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(mesh.value, [0, 1], [1, 1.05]) }],
    opacity: interpolate(mesh.value, [0, 1], [1, 0.78]),
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
    if (params.duelId) {
      setSheetMode("join");
    }
  }, [params.duelId]);

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

  const stakeAmount = Number.parseFloat(stakeInput);
  const hasInviteInput = manualDuelId.trim().length > 0;
  const hasValidInviteFormat = !hasInviteInput || !!toDuelId(manualDuelId.trim());

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

  const resetCreateSheet = () => {
    setStakeInput("0.5");
    setDurationDays(7);
    setDuelTitle("");
    setDuelDescription("");
  };

  const handleCreateInvite = async () => {
    if (!walletAddress) return;
    if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
      openFeedback("error", "Invalid stake", "Enter a valid SOL amount greater than zero.");
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
        title: duelTitle.trim() || `Discipline Duel • ${durationDays} Days`,
        description:
          duelDescription.trim() ||
          "A focused streak battle with locked stake and daily check-ins.",
        onchainDuelAddress: onChainDuel.duelAddress,
        onchainEscrowAddress: onChainDuel.escrowAddress,
        onchainProgramId: onChainDuel.programId,
        onchainTxSignature: onChainDuel.signature,
        onchainNonce: onChainDuel.duelNonce,
      });

      setSheetMode(null);
      resetCreateSheet();
      openFeedback(
        "success",
        "Duel Created",
        `Duel ${String(duelId)} was created and stake escrow is now locked on-chain.`,
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
      if (!duel.onchainDuelAddress) throw new Error("On-chain duel metadata is missing.");
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
        <ArenaBackground meshStyle={meshStyle} />
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
        <ArenaBackground meshStyle={meshStyle} />
        <View style={styles.centered}>
          <Text style={styles.lockTitle}>SYNCING DUEL LOGS...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ArenaBackground meshStyle={meshStyle} />
        <View style={styles.centered}>
          <Text style={styles.lockTitle}>NO HUNTER PROFILE</Text>
          <Text style={styles.lockCopy}>Complete registration on Home first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const winTake = Number.isFinite(stakeAmount) ? (stakeAmount * 0.7).toFixed(2) : "--";
  const vaultTake = Number.isFinite(stakeAmount) ? (stakeAmount * 0.25).toFixed(2) : "--";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ArenaBackground meshStyle={meshStyle} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.heroCard}>
          <Text style={styles.sectionTitle}>The Arena</Text>
          <Text style={styles.heroTitle}>Select a duel to view details</Text>
          <Text style={styles.heroCopy}>
            Create a locked challenge, paste an invite code, or jump straight into a live battle from the board below.
          </Text>

          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.primaryCta} onPress={() => setSheetMode("create")}>
              <Text style={styles.primaryCtaText}>Create</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryCta} onPress={() => setSheetMode("join")}>
              <Text style={styles.secondaryCtaText}>Join</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroStats}>
            <HeroStat label="Live" value={String(activeDuels.length).padStart(2, "0")} />
            <HeroStat label="Open" value={String(openDuels.length).padStart(2, "0")} />
            <HeroStat label="History" value={String(historyDuels.length).padStart(2, "0")} />
          </View>
        </Animated.View>

        {resolvedInviteId && inviteDuel ? (
          <Animated.View entering={FadeInDown.duration(520).delay(60)} style={styles.featureCard}>
            <Text style={styles.featureEyebrow}>Invite Preview</Text>
            <View style={styles.featureHeader}>
              <View>
                <Text style={styles.featureTitle}>{getDuelTitle(inviteDuel)}</Text>
                <Text style={styles.featureText}>{getDuelDescription(inviteDuel)}</Text>
              </View>
              <StatusPill status={inviteDuel.status} />
            </View>
            <View style={styles.featureMetaRow}>
              <Text style={styles.featureMeta}>{getParticipantLabel(inviteDuel, "player1")}</Text>
              <Text style={styles.featureMeta}>{inviteDuel.stakeAmount} SOL</Text>
              <Text style={styles.featureMeta}>{formatStartTime(inviteDuel.startTime)}</Text>
            </View>
            <TouchableOpacity
              style={[styles.primaryInlineButton, !canJoinInvite && styles.buttonDisabled]}
              onPress={() => setSheetMode("join")}
              disabled={!canJoinInvite}
            >
              <Text style={styles.primaryInlineText}>Review Invite</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : hasInviteInput ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Invite radar</Text>
            <Text style={styles.emptyCopy}>
              {hasValidInviteFormat
                ? "No duel found for that id yet."
                : "That duel id format looks invalid. Use the full id from the shared link."}
            </Text>
          </View>
        ) : null}

        <Section title="Ongoing Duels">
          {activeDuels.length === 0 ? (
            <EmptyState text="No active duel running yet." />
          ) : (
            activeDuels.map((duel, index) => (
              <DuelListItem
                key={duel._id}
                duel={duel}
                onPress={() =>
                  router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any)
                }
                delay={index}
              />
            ))
          )}
        </Section>

        <Section title="Open Invites">
          {openDuels.length === 0 ? (
            <EmptyState text="No open invites waiting." />
          ) : (
            openDuels.map((duel, index) => (
              <DuelListItem
                key={duel._id}
                duel={duel}
                delay={index}
                footer={
                  <View style={styles.itemFooter}>
                    <TouchableOpacity
                      style={styles.inlineGhost}
                      onPress={() => void shareInviteLink(String(duel._id))}
                    >
                      <Text style={styles.inlineGhostText}>Share</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.inlineDanger}
                      onPress={() => void handleCancelOpen(duel)}
                    >
                      <Text style={styles.inlineDangerText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                }
              />
            ))
          )}
        </Section>

        <Section title="Resolved Duels">
          {historyDuels.length === 0 ? (
            <EmptyState text="No completed duels yet." />
          ) : (
            historyDuels.map((duel, index) => (
              <DuelListItem
                key={duel._id}
                duel={duel}
                onPress={() =>
                  router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any)
                }
                delay={index}
                resolved
              />
            ))
          )}
        </Section>
      </ScrollView>

      <AnimatedSheet
        visible={sheetMode === "create"}
        onClose={() => {
          if (createLoading) return;
          setSheetMode(null);
        }}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Create Duel</Text>

        <Text style={styles.inputLabel}>Stake Amount</Text>
        <TextInput
          value={stakeInput}
          onChangeText={setStakeInput}
          placeholder="0.5 SOL"
          placeholderTextColor={COLORS.dim}
          keyboardType="decimal-pad"
          style={styles.input}
        />
        <View style={styles.chipGroup}>
          {QUICK_STAKES.map((value) => (
            <Chip
              key={value}
              label={`${value} SOL`}
              selected={Number(stakeInput) === value}
              onPress={() => setStakeInput(String(value))}
            />
          ))}
        </View>

        <Text style={styles.inputLabel}>Duration</Text>
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

        <Text style={styles.inputLabel}>Title (optional)</Text>
        <TextInput
          value={duelTitle}
          onChangeText={setDuelTitle}
          placeholder="No Sugar Sprint"
          placeholderTextColor={COLORS.dim}
          style={styles.input}
        />

        <Text style={styles.inputLabel}>Mission (optional)</Text>
        <TextInput
          value={duelDescription}
          onChangeText={setDuelDescription}
          placeholder="What both players are trying to do and why it matters"
          placeholderTextColor={COLORS.dim}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <View style={styles.previewCard}>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>You Win (70%)</Text>
            <Text style={[styles.previewValue, { color: COLORS.green }]}>{winTake} SOL</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Loser Vault (25%)</Text>
            <Text style={[styles.previewValue, { color: COLORS.red }]}>{vaultTake} SOL</Text>
          </View>
          <View style={styles.previewRow}>
            <Text style={styles.previewLabel}>Starts</Text>
            <Text style={styles.previewSubtle}>1 hour after create</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.sheetPrimary, createLoading && styles.buttonDisabled]}
          onPress={() => void handleCreateInvite()}
          disabled={createLoading}
        >
          <Text style={styles.sheetPrimaryText}>{createLoading ? "Creating..." : "Create & Lock"}</Text>
        </TouchableOpacity>
      </AnimatedSheet>

      <AnimatedSheet
        visible={sheetMode === "join"}
        onClose={() => {
          if (joinInviteLoading) return;
          setSheetMode(null);
        }}
      >
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Join Duel</Text>

        <Text style={styles.inputLabel}>Invite Code</Text>
        <TextInput
          value={manualDuelId}
          onChangeText={setManualDuelId}
          placeholder="Enter duel id from shared link"
          placeholderTextColor={COLORS.dim}
          autoCapitalize="none"
          style={styles.input}
        />

        {inviteDuel ? (
          <View style={styles.joinPreviewCard}>
            <View style={styles.joinPreviewTop}>
              <View style={styles.joinAvatarStack}>
                <CharacterAvatar
                  characterId={inviteDuel.player1User?.selectedCharacter}
                  label={inviteDuel.player1User?.username}
                  size={44}
                />
                <CharacterAvatar
                  characterId={inviteDuel.player2User?.selectedCharacter ?? user.selectedCharacter}
                  label={inviteDuel.player2User?.username ?? user.username}
                  size={44}
                />
              </View>
              <StatusPill status={inviteDuel.status} />
            </View>
            <Text style={styles.joinPreviewTitle}>{getDuelTitle(inviteDuel)}</Text>
            <Text style={styles.joinPreviewCopy}>{getDuelDescription(inviteDuel)}</Text>
            <View style={styles.joinMetaRow}>
              <MiniMeta label="Creator" value={getParticipantLabel(inviteDuel, "player1")} />
              <MiniMeta label="Stake" value={`${inviteDuel.stakeAmount} SOL`} />
              <MiniMeta label="Start" value={formatStartTime(inviteDuel.startTime)} />
            </View>
          </View>
        ) : hasInviteInput ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Invite lookup</Text>
            <Text style={styles.emptyCopy}>
              {hasValidInviteFormat
                ? "No duel found for that id yet."
                : "That duel id format looks invalid."}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.checkRow}
          onPress={() => setReadChecked((value) => !value)}
        >
          <View style={[styles.checkbox, readChecked && styles.checkboxActive]} />
          <Text style={styles.checkText}>I understand the duel flow and accept the stake rules.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.sheetPrimary,
            (!readChecked || !canJoinInvite || joinInviteLoading) && styles.buttonDisabled,
          ]}
          onPress={() => void handleJoinInvite()}
          disabled={!readChecked || !canJoinInvite || joinInviteLoading}
        >
          <Text style={styles.sheetPrimaryText}>
            {joinInviteLoading ? "Joining..." : "Join & Lock Stake"}
          </Text>
        </TouchableOpacity>
      </AnimatedSheet>

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
  meshStyle,
}: {
  meshStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <>
      <Animated.View style={[styles.bgMesh, meshStyle]} />
      <View style={styles.bgNoise} />
      <View style={styles.particles}>
        {PARTICLES.map((index) => (
          <Particle key={index} index={index} />
        ))}
      </View>
    </>
  );
}

function Particle({ index }: { index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, {
        duration: 9000 + index * 500,
        easing: Easing.linear,
      }),
      -1,
      false,
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.35, 0.35, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [680, -80]) },
      { scale: interpolate(progress.value, [0, 1], [0.4, 1.1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: `${10 + index * 12}%`,
          backgroundColor: index % 2 === 0 ? COLORS.orange : COLORS.green,
        },
      ]}
    />
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionHeader}>{title}</Text>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

function EmptyState({ text }: { text: string }) {
  return <Text style={styles.emptyInline}>{text}</Text>;
}

function DuelListItem({
  duel,
  onPress,
  footer,
  delay,
  resolved,
}: {
  duel: DuelWithParticipants;
  onPress?: () => void;
  footer?: ReactNode;
  delay: number;
  resolved?: boolean;
}) {
  const currentCharacter =
    duel.player1User?.selectedCharacter ?? duel.player2User?.selectedCharacter;

  const statusText =
    duel.status === "ACTIVE"
      ? `Active • ${getEndsLabel(duel.endTime)}`
      : duel.status === "OPEN"
        ? `Open • ${getStartsLabel(duel.startTime)}`
        : formatResolvedCopy(duel);

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(delay * 40)}>
      <TouchableOpacity
        style={[styles.duelListItem, resolved && styles.duelListItemResolved]}
        onPress={onPress}
        disabled={!onPress}
      >
        <View style={styles.duelInfo}>
          <CharacterAvatar characterId={currentCharacter} label={duel.player1User?.username} size={48} />
          <View style={styles.duelMeta}>
            <Text style={styles.duelTitle}>{formatListTitle(duel)}</Text>
            <Text style={[styles.duelSub, resolved && styles.duelSubResolved]}>{statusText}</Text>
          </View>
        </View>
        <View style={[styles.duelBadge, resolved && styles.duelBadgeResolved]}>
          <Text style={[styles.duelBadgeText, resolved && styles.duelBadgeResolvedText]}>
            {resolved ? formatResolvedTag(duel) : duel.stakeAmount}
          </Text>
        </View>
      </TouchableOpacity>
      {footer}
    </Animated.View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStatCard}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "ACTIVE"
      ? COLORS.green
      : status === "OPEN"
        ? COLORS.orange
        : status === "RESOLVED" || status === "COMPLETED"
          ? COLORS.red
          : COLORS.dim;
  return (
    <View style={[styles.statusPill, { borderColor: `${color}55` }]}>
      <Text style={[styles.statusPillText, { color }]}>{formatDuelStatus(status as any)}</Text>
    </View>
  );
}

function MiniMeta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.miniMeta}>
      <Text style={styles.miniMetaValue} numberOfLines={1}>{value}</Text>
      <Text style={styles.miniMetaLabel}>{label}</Text>
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
      style={[styles.chip, selected && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function AnimatedSheet({
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
      duration: visible ? 280 : 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(progress.value, [0, 1], [120, 0]) }],
    opacity: progress.value,
  }));

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.modalBackdrop, backdropStyle]}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <Animated.View style={[styles.modalSheet, sheetStyle]}>
          <ScrollView
            bounces={false}
            contentContainerStyle={styles.modalContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

function formatListTitle(duel: DuelWithParticipants) {
  const p1 = duel.player1User?.username ?? "You";
  const p2 = duel.player2User?.username ?? "Waiting";
  return `${p1} vs ${p2}`;
}

function getEndsLabel(timestamp?: number) {
  if (!timestamp) return "Ends soon";
  const diff = timestamp - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / DAY_MS);
  return days > 0 ? `Ends in ${days}d` : "Ends today";
}

function getStartsLabel(timestamp?: number) {
  if (!timestamp) return "Start pending";
  const diff = timestamp - Date.now();
  if (diff <= 0) return "Starts now";
  const hours = Math.max(1, Math.floor(diff / HOUR_MS));
  return `Starts in ${hours}h`;
}

function formatResolvedTag(duel: DuelWithParticipants) {
  if (duel.status === "CANCELLED") return "VOID";
  if (duel.winner === duel.player1 || duel.winner === duel.player2) return "DONE";
  return "END";
}

function formatResolvedCopy(duel: DuelWithParticipants) {
  if (duel.status === "CANCELLED") return "Cancelled before activation";
  return duel.winner ? "Resolved duel record" : "Completed duel";
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  bgMesh: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
  },
  bgNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  particles: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  lockTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  lockCopy: {
    marginTop: 8,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  scroll: {
    padding: 16,
    paddingBottom: 44,
    gap: 14,
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  sectionTitle: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 8,
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
  },
  heroCopy: {
    marginTop: 8,
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  ctaRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  primaryCta: {
    flex: 1,
    backgroundColor: COLORS.orange,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryCta: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryCtaText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  secondaryCtaText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  heroStats: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  heroStatCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 12,
    alignItems: "center",
  },
  heroStatValue: {
    color: COLORS.orange,
    fontSize: 22,
    fontWeight: "900",
  },
  heroStatLabel: {
    marginTop: 4,
    color: COLORS.dim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  featureCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  featureEyebrow: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  featureHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  featureTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  featureText: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
    maxWidth: 240,
  },
  featureMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 14,
  },
  featureMeta: {
    color: COLORS.dim,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  primaryInlineButton: {
    marginTop: 16,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,107,53,0.14)",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryInlineText: {
    color: COLORS.orange,
    fontWeight: "900",
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  sectionHeader: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  sectionList: {
    gap: 10,
  },
  emptyInline: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 22,
  },
  duelListItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    borderRadius: 18,
  },
  duelListItemResolved: {
    opacity: 0.72,
  },
  duelInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  duelMeta: {
    flex: 1,
  },
  duelTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
  },
  duelSub: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 12,
  },
  duelSubResolved: {
    color: COLORS.dim,
  },
  duelBadge: {
    minWidth: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(255,107,53,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.22)",
  },
  duelBadgeResolved: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: COLORS.borderSoft,
  },
  duelBadgeText: {
    color: COLORS.orange,
    fontWeight: "900",
    fontSize: 13,
  },
  duelBadgeResolvedText: {
    color: COLORS.text,
  },
  itemFooter: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  inlineGhost: {
    flex: 1,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 12,
    alignItems: "center",
  },
  inlineGhostText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  inlineDanger: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: "rgba(255,59,92,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,59,92,0.22)",
    paddingVertical: 12,
    alignItems: "center",
  },
  inlineDangerText: {
    color: COLORS.red,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  emptyCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyCopy: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,3,4,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    maxHeight: "90%",
    backgroundColor: "rgba(8,8,12,0.98)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalContent: {
    padding: 18,
    paddingBottom: 34,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    marginBottom: 16,
  },
  sheetTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 18,
  },
  inputLabel: {
    color: COLORS.dim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 14,
  },
  textarea: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: {
    backgroundColor: "rgba(255,107,53,0.14)",
    borderColor: "rgba(255,107,53,0.22)",
  },
  chipText: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  chipTextActive: {
    color: COLORS.text,
  },
  previewCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  previewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  previewLabel: {
    color: COLORS.muted,
    fontSize: 12,
  },
  previewValue: {
    fontSize: 14,
    fontWeight: "900",
  },
  previewSubtle: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },
  sheetPrimary: {
    backgroundColor: COLORS.orange,
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetPrimaryText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  joinPreviewCard: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
    marginBottom: 16,
  },
  joinPreviewTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  joinAvatarStack: {
    flexDirection: "row",
    gap: 8,
  },
  joinPreviewTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  joinPreviewCopy: {
    marginTop: 6,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
  joinMetaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  miniMeta: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    padding: 10,
  },
  miniMetaValue: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "800",
  },
  miniMetaLabel: {
    marginTop: 4,
    color: COLORS.dim,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  checkboxActive: {
    backgroundColor: COLORS.green,
    borderColor: COLORS.green,
  },
  checkText: {
    flex: 1,
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 20,
  },
});
