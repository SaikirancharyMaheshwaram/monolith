import { CharacterAvatar } from "@/components/CharacterAvatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  formatDuelStatus,
  formatStartTime,
  getDuelDescription,
  getDuelNextAction,
  getDuelTitle,
} from "@/lib/duel-copy";
import {
  DuelWithParticipants,
  getParticipantLabel,
  toDuelId,
} from "@/lib/duel-view";
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
import Animated, {
  Easing,
  Extrapolation,
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

type FeedbackState = {
  visible: boolean;
  tone: "success" | "error";
  title: string;
  message: string;
};

type DuelProgress = {
  player1: Id<"users">;
  player2?: Id<"users">;
  p1Days: number[];
  p2Days: number[];
};

type QueueKey = "ACTIVE" | "OPEN" | "DONE";

const EMPTY_FEEDBACK: FeedbackState = {
  visible: false,
  tone: "success",
  title: "",
  message: "",
};

const COLORS = {
  bg: "#030304",
  card: "rgba(12,12,16,0.86)",
  cardHover: "rgba(18,18,24,0.96)",
  border: "rgba(255,255,255,0.08)",
  borderSoft: "rgba(255,255,255,0.05)",
  orange: "#ff6b35",
  orangeSoft: "#ff8f66",
  green: "#00d68f",
  greenSoft: "rgba(0,214,143,0.18)",
  red: "#ff3b5c",
  yellow: "#ffc107",
  purple: "#a855f7",
  cyan: "#22d3ee",
  text: "#ffffff",
  textMuted: "#9b9ba3",
  textDim: "#676770",
};

const PARTICLES = Array.from({ length: 7 }, (_, index) => index);

export default function BattleScreen() {
  const wallet = useWallet();
  const params = useLocalSearchParams<{ duelId?: string }>();
  const [journal, setJournal] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);
  const [selectedDuelId, setSelectedDuelId] = useState<Id<"duels"> | null>(
    toDuelId(params.duelId),
  );
  const [queueKey, setQueueKey] = useState<QueueKey>("ACTIVE");
  const [celebrationDay, setCelebrationDay] = useState<number | null>(null);

  const submitCompletion = useMutation(
    api.submissions.submitCompletion.submitCompletion,
  );
  const prepareSettlement = useMutation(
    api.duels.prepareSettlement.prepareSettlement,
  );
  const finalizeSettlement = useMutation(
    api.duels.finalizeSettlement.finalizeSettlement,
  );

  const mesh = useSharedValue(0);
  const float = useSharedValue(0);
  const celebration = useSharedValue(0);

  useEffect(() => {
    mesh.value = withRepeat(
      withTiming(1, { duration: 12000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    float.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [float, mesh]);

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const duels = useQuery(
    api.duels.getUserDuels.getUserDuels,
    user ? { userId: user._id } : "skip",
  ) as DuelWithParticipants[] | undefined;
  const selectedDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    selectedDuelId ? { id: selectedDuelId } : "skip",
  ) as DuelWithParticipants | null | undefined;
  const progress = useQuery(
    api.duels.getDuelProgress.getDuelProgress,
    selectedDuelId ? { duelId: selectedDuelId } : "skip",
  ) as DuelProgress | undefined;

  useEffect(() => {
    const nextId = toDuelId(params.duelId);
    if (nextId) {
      setSelectedDuelId(nextId);
    }
  }, [params.duelId]);

  const activeDuels = useMemo(
    () => (duels ?? []).filter((duel) => duel.status === "ACTIVE"),
    [duels],
  );
  const openDuels = useMemo(
    () => (duels ?? []).filter((duel) => duel.status === "OPEN"),
    [duels],
  );
  const doneDuels = useMemo(
    () =>
      (duels ?? []).filter(
        (duel) =>
          duel.status === "RESOLVED" ||
          duel.status === "COMPLETED" ||
          duel.status === "CANCELLED",
      ),
    [duels],
  );

  useEffect(() => {
    if (!selectedDuelId) {
      const fallback = activeDuels[0] ?? openDuels[0] ?? doneDuels[0] ?? null;
      if (fallback) {
        setSelectedDuelId(fallback._id);
      }
    }
  }, [activeDuels, doneDuels, openDuels, selectedDuelId]);

  useEffect(() => {
    if (!selectedDuel) return;
    if (selectedDuel.status === "ACTIVE") setQueueKey("ACTIVE");
    else if (selectedDuel.status === "OPEN") setQueueKey("OPEN");
    else setQueueKey("DONE");
  }, [selectedDuel]);

  const queue = queueKey === "ACTIVE" ? activeDuels : queueKey === "OPEN" ? openDuels : doneDuels;
  const duelStatus = selectedDuel?.status ?? "CREATED";
  const isActive = duelStatus === "ACTIVE";
  const isResolved = duelStatus === "RESOLVED" || duelStatus === "COMPLETED";
  const hasOnchainMetadata = !!selectedDuel?.onchainDuelAddress;
  const invalidLinkedDuel = typeof params.duelId === "string" && !toDuelId(params.duelId);

  const meIsPlayerOne = !!(selectedDuel && user && selectedDuel.player1 === user._id);
  const myDays = useMemo(() => {
    if (!progress || !user) return [];
    return progress.player1 === user._id ? progress.p1Days : progress.p2Days;
  }, [progress, user]);
  const rivalDays = useMemo(() => {
    if (!progress || !user) return [];
    return progress.player1 === user._id ? progress.p2Days : progress.p1Days;
  }, [progress, user]);

  const totalDays = useMemo(() => {
    if (!selectedDuel?.startTime || !selectedDuel?.endTime) return 7;
    const diff = Math.max(selectedDuel.endTime - selectedDuel.startTime, 1);
    return Math.max(1, Math.ceil(diff / (24 * 60 * 60 * 1000)));
  }, [selectedDuel?.endTime, selectedDuel?.startTime]);

  const currentDay = useMemo(() => {
    if (!selectedDuel?.startTime) return 1;
    if (Date.now() <= selectedDuel.startTime) return 1;
    return Math.min(
      totalDays,
      Math.floor((Date.now() - selectedDuel.startTime) / (24 * 60 * 60 * 1000)) + 1,
    );
  }, [selectedDuel?.startTime, totalDays]);

  const myStreak = new Set(myDays).size;
  const rivalStreak = new Set(rivalDays).size;
  const misses = Math.min(3, Math.max(0, currentDay - 1 - myStreak));
  const remainingLabel = getRemainingLabel(selectedDuel);
  const actionCopy = selectedDuel ? getDuelNextAction(selectedDuel) : "Choose a duel to review the live state.";
  const rivalLabel = getParticipantLabel(selectedDuel, meIsPlayerOne ? "player2" : "player1");
  const myLabel = getParticipantLabel(selectedDuel, meIsPlayerOne ? "player1" : "player2");
  const myCharacterId = meIsPlayerOne
    ? selectedDuel?.player1User?.selectedCharacter
    : selectedDuel?.player2User?.selectedCharacter;
  const rivalCharacterId = meIsPlayerOne
    ? selectedDuel?.player2User?.selectedCharacter
    : selectedDuel?.player1User?.selectedCharacter;

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const triggerCelebration = (dayNumber: number) => {
    setCelebrationDay(dayNumber);
    celebration.value = 0;
    celebration.value = withSequence(
      withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) }),
      withDelay(1300, withTiming(0, { duration: 280 })),
    );
    setTimeout(() => setCelebrationDay(null), 2100);
  };

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
      triggerCelebration(result.dayNumber);
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
      openFeedback("error", "Settle failed", "Choose a duel before settling.");
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
    let onChainSettlement: Awaited<ReturnType<typeof wallet.settleDuel>> | null = null;

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

  const meshStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(mesh.value, [0, 1], [1, 1.06]) }],
    opacity: interpolate(mesh.value, [0, 1], [1, 0.78], Extrapolation.CLAMP),
  }));

  const stageStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [-6, 10]) }],
  }));

  const celebrationStyle = useAnimatedStyle(() => ({
    opacity: celebration.value,
    transform: [
      { scale: interpolate(celebration.value, [0, 1], [0.8, 1]) },
      { translateY: interpolate(celebration.value, [0, 1], [50, 0]) },
    ],
  }));

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ArenaBackground meshStyle={meshStyle} />
        <View style={styles.lockedWrap}>
          <Text style={styles.lockedEyebrow}>PvP Arena</Text>
          <Text style={styles.lockedTitle}>Connect wallet to enter the battle board.</Text>
          <Text style={styles.lockedCopy}>
            The redesigned duel stage, live check-in tracker, and settlement flow all unlock after wallet auth.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ArenaBackground meshStyle={meshStyle} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.heroCard}>
          <Text style={styles.eyebrow}>Battle Screen</Text>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>
                {selectedDuel ? getDuelTitle(selectedDuel) : "Select a duel"}
              </Text>
              <Text style={styles.heroSubtitle}>
                {selectedDuel
                  ? getDuelDescription(selectedDuel)
                  : "Use the arena queue below to load an active fight, an open invite, or a resolved record."}
              </Text>
            </View>
            <StatusChip status={duelStatus} />
          </View>

          <View style={styles.heroMetrics}>
            <Metric label="Pot" value={selectedDuel ? `${selectedDuel.stakeAmount} SOL` : "--"} tone="orange" />
            <Metric label="Remaining" value={remainingLabel} tone="green" />
            <Metric label="Check-ins" value={`${myStreak}/${totalDays}`} tone="purple" />
          </View>

          <Text style={styles.actionCopy}>{actionCopy}</Text>
        </Animated.View>

        {invalidLinkedDuel ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Malformed duel link</Text>
            <Text style={styles.alertCopy}>
              The shared link does not contain a valid duel id. Pick one from the arena queue below.
            </Text>
          </View>
        ) : null}

        <Animated.View entering={FadeInDown.duration(520).delay(90)} style={styles.queueCard}>
          <View style={styles.segmentRow}>
            <Segment label="Active" active={queueKey === "ACTIVE"} onPress={() => setQueueKey("ACTIVE")} />
            <Segment label="Open" active={queueKey === "OPEN"} onPress={() => setQueueKey("OPEN")} />
            <Segment label="Resolved" active={queueKey === "DONE"} onPress={() => setQueueKey("DONE")} />
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.queueScroller}>
            {queue.length === 0 ? (
              <View style={styles.emptyQueueCard}>
                <Text style={styles.emptyQueueTitle}>Nothing queued here yet.</Text>
                <Text style={styles.emptyQueueCopy}>Switch lanes or create a duel from the duel board.</Text>
              </View>
            ) : (
              queue.map((duel, index) => (
                <Animated.View
                  key={duel._id}
                  entering={FadeInDown.duration(450).delay(60 * index)}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedDuelId(duel._id)}
                    style={[
                      styles.queueItem,
                      duel._id === selectedDuelId && styles.queueItemSelected,
                    ]}
                  >
                    <CharacterAvatar
                      characterId={duel.player1User?.selectedCharacter}
                      label={duel.player1User?.username}
                      size={48}
                    />
                    <View style={styles.queueCopyWrap}>
                      <Text style={styles.queueTitle}>{getDuelTitle(duel)}</Text>
                      <Text style={styles.queueMeta}>
                        {formatDuelStatus(duel.status)} • {formatStartTime(duel.startTime)}
                      </Text>
                    </View>
                    <View style={styles.queueBadge}>
                      <Text style={styles.queueBadgeText}>{duel.stakeAmount}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </ScrollView>
        </Animated.View>

        {selectedDuel ? (
          <>
            <Animated.View
              entering={FadeInDown.duration(540).delay(130)}
              style={styles.stageCard}
            >
              <Animated.View style={[styles.stageGlowOrange, stageStyle]} />
              <Animated.View style={[styles.stageGlowGreen, stageStyle]} />

              <View style={styles.stageHeader}>
                <Text style={styles.stageEyebrow}>Check-In Duel</Text>
                <Text style={styles.stageRule}>Today is day {currentDay} of {totalDays}</Text>
              </View>

              <Animated.View style={[styles.versusRow, stageStyle]}>
                <View style={styles.fighterColumn}>
                  <CharacterAvatar characterId={myCharacterId} label={myLabel} size={90} />
                  <Text style={styles.fighterName}>{myLabel}</Text>
                  <Text style={styles.fighterStat}>{myStreak} day streak</Text>
                </View>
                <View style={styles.vsWrap}>
                  <Text style={styles.vsText}>VS</Text>
                  <View style={styles.livePill}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>{formatDuelStatus(duelStatus)}</Text>
                  </View>
                </View>
                <View style={styles.fighterColumn}>
                  <CharacterAvatar characterId={rivalCharacterId} label={rivalLabel} size={90} />
                  <Text style={styles.fighterName}>{rivalLabel}</Text>
                  <Text style={styles.fighterStat}>{rivalStreak} day streak</Text>
                </View>
              </Animated.View>

              <View style={styles.detailGrid}>
                <DetailStat label="SOL Pot" value={`${selectedDuel.stakeAmount.toFixed(1)}`} tone={COLORS.green} />
                <DetailStat label="Remaining" value={remainingLabel} tone={COLORS.yellow} />
                <DetailStat label="Duration" value={`${totalDays}`} tone={COLORS.text} />
              </View>

              <View style={styles.streakBanner}>
                <Text style={styles.streakFlame}>FIRE</Text>
                <Text style={styles.streakValue}>{myStreak}</Text>
                <Text style={styles.streakLabel}>day streak</Text>
              </View>

              <Text style={styles.sectionCaption}>Your strike status</Text>
              <View style={styles.strikeRow}>
                {[0, 1, 2].map((slot) => (
                  <View
                    key={slot}
                    style={[
                      styles.strikeDot,
                      slot < misses ? styles.strikeDotUsed : styles.strikeDotSafe,
                    ]}
                  />
                ))}
              </View>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(560).delay(170)} style={styles.checkinCard}>
              <View style={styles.cardTopRow}>
                <Text style={styles.cardTitle}>Daily check-in</Text>
                <Text style={styles.cardSubtle}>
                  {isActive ? "Live proof window open" : "Check-in paused"}
                </Text>
              </View>

              <TextInput
                multiline
                value={journal}
                onChangeText={setJournal}
                placeholder="Add a short proof note, workout detail, or habit context."
                placeholderTextColor={COLORS.textDim}
                style={styles.journalInput}
              />

              <View style={styles.miniGrid}>
                <MiniStat label="You" value={`${myStreak} logged`} />
                <MiniStat label="Rival" value={`${rivalStreak} logged`} />
                <MiniStat label="Starts" value={formatStartTime(selectedDuel.startTime)} compact />
              </View>

              <TouchableOpacity
                style={[styles.primaryButton, !isActive && styles.buttonDisabled]}
                onPress={() => void handleCheckIn()}
                disabled={!isActive || submitLoading}
              >
                <Text style={styles.primaryButtonText}>
                  {submitLoading ? "Submitting..." : "Complete Daily Check-In"}
                </Text>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View entering={FadeInDown.duration(580).delay(210)} style={styles.settlementCard}>
              <Text style={styles.cardTitle}>Settlement rail</Text>
              <Text style={styles.settlementCopy}>
                {isResolved
                  ? "The duel is decided. Trigger final payout to close the loop on-chain."
                  : duelStatus === "OPEN"
                    ? "This duel is still waiting for a rival to lock matching stake."
                    : "Settlement becomes available once the duel window has ended and the backend computes the winner."}
              </Text>

              <TouchableOpacity
                style={[
                  styles.secondaryButton,
                  (!isResolved || !hasOnchainMetadata) && styles.buttonDisabled,
                ]}
                onPress={() => void handleSettle()}
                disabled={!isResolved || !hasOnchainMetadata || settleLoading}
              >
                <Text style={styles.secondaryButtonText}>
                  {settleLoading ? "Settling..." : "Finalize Settlement"}
                </Text>
              </TouchableOpacity>

              <View style={styles.metaRows}>
                <MetaRow label="Creator" value={getParticipantLabel(selectedDuel, "player1")} />
                <MetaRow label="Rival" value={getParticipantLabel(selectedDuel, "player2")} />
                <MetaRow label="Started" value={formatStartTime(selectedDuel.startTime)} />
                <MetaRow label="Ends" value={formatStartTime(selectedDuel.endTime)} />
              </View>
            </Animated.View>
          </>
        ) : (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>No duel selected</Text>
            <Text style={styles.alertCopy}>
              Pick an item from Active, Open, or Resolved to load the full battle view.
            </Text>
          </View>
        )}
      </ScrollView>

      {celebrationDay !== null ? (
        <Animated.View pointerEvents="none" style={[styles.celebrationOverlay, celebrationStyle]}>
          <View style={styles.celebrationCard}>
            <Text style={styles.celebrationEyebrow}>Daily check-in completed</Text>
            <Text style={styles.celebrationDay}>Day {celebrationDay}</Text>
            <Text style={styles.celebrationCopy}>Streak locked in. Your duel record has been updated.</Text>
          </View>
        </Animated.View>
      ) : null}

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
        {PARTICLES.map((particle) => (
          <Particle key={particle} index={particle} />
        ))}
      </View>
    </>
  );
}

function Particle({ index }: { index: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(
      index * 320,
      withRepeat(
        withTiming(1, {
          duration: 8000 + index * 600,
          easing: Easing.linear,
        }),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.85, 1], [0, 0.35, 0.35, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [620, -80]) },
      { scale: interpolate(progress.value, [0, 1], [0.4, 1.1]) },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        animatedStyle,
        {
          left: `${10 + index * 12}%`,
          backgroundColor: index % 2 === 0 ? COLORS.orange : COLORS.green,
        },
      ]}
    />
  );
}

function Segment({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segment, active && styles.segmentActive]}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "orange" | "green" | "purple";
}) {
  const tint =
    tone === "orange" ? COLORS.orange : tone === "green" ? COLORS.green : COLORS.purple;

  return (
    <View style={styles.metricCard}>
      <Text style={[styles.metricValue, { color: tint }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? COLORS.green
      : status === "OPEN"
        ? COLORS.orange
        : status === "RESOLVED" || status === "COMPLETED"
          ? COLORS.cyan
          : COLORS.textDim;

  return (
    <View style={[styles.statusChip, { borderColor: `${tone}66` }]}>
      <View style={[styles.statusDot, { backgroundColor: tone }]} />
      <Text style={[styles.statusText, { color: tone }]}>{formatDuelStatus(status as any)}</Text>
    </View>
  );
}

function DetailStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={styles.detailStat}>
      <Text style={[styles.detailValue, { color: tone }]}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

function MiniStat({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <View style={[styles.miniStat, compact && styles.miniStatWide]}>
      <Text style={styles.miniStatValue} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metaRow}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function getRemainingLabel(duel?: DuelWithParticipants | null) {
  if (!duel?.endTime) return "TBD";
  const diff = duel.endTime - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.max(1, Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000)));
  return `${hours}h ${minutes}m`;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  scroll: {
    padding: 16,
    paddingBottom: 44,
    gap: 14,
  },
  bgMesh: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.bg,
    opacity: 0.95,
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
  lockedWrap: {
    flex: 1,
    paddingHorizontal: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  lockedEyebrow: {
    color: COLORS.orange,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  lockedTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  lockedCopy: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  heroCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    overflow: "hidden",
  },
  eyebrow: {
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    fontSize: 11,
    fontWeight: "700",
    marginBottom: 10,
  },
  heroHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  heroTitle: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroSubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  heroMetrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  metricCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  metricLabel: {
    marginTop: 4,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 10,
    fontWeight: "700",
  },
  actionCopy: {
    marginTop: 16,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  alertCard: {
    backgroundColor: "rgba(255,107,53,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.22)",
    padding: 16,
  },
  alertTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  alertCopy: {
    marginTop: 6,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  queueCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  segmentRow: {
    flexDirection: "row",
    gap: 8,
  },
  segment: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  segmentActive: {
    backgroundColor: "rgba(255,107,53,0.12)",
    borderColor: "rgba(255,107,53,0.28)",
  },
  segmentText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  segmentTextActive: {
    color: COLORS.text,
  },
  queueScroller: {
    gap: 10,
    paddingTop: 14,
    paddingRight: 4,
  },
  emptyQueueCard: {
    width: 240,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    padding: 16,
  },
  emptyQueueTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyQueueCopy: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 13,
    lineHeight: 20,
  },
  queueItem: {
    width: 250,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  queueItemSelected: {
    backgroundColor: COLORS.cardHover,
    borderColor: "rgba(255,107,53,0.28)",
  },
  queueCopyWrap: {
    flex: 1,
  },
  queueTitle: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  queueMeta: {
    marginTop: 4,
    color: COLORS.textMuted,
    fontSize: 11,
    lineHeight: 16,
  },
  queueBadge: {
    minWidth: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: "rgba(255,107,53,0.14)",
  },
  queueBadgeText: {
    color: COLORS.orange,
    fontSize: 13,
    fontWeight: "800",
  },
  stageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    overflow: "hidden",
  },
  stageGlowOrange: {
    position: "absolute",
    top: -36,
    left: -10,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.18)",
  },
  stageGlowGreen: {
    position: "absolute",
    right: -20,
    bottom: -60,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(0,214,143,0.12)",
  },
  stageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  stageEyebrow: {
    color: COLORS.textDim,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  stageRule: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  versusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  fighterColumn: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  fighterName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  fighterStat: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  vsWrap: {
    alignItems: "center",
    gap: 10,
  },
  vsText: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: COLORS.green,
  },
  liveText: {
    color: COLORS.text,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  detailGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  detailStat: {
    flex: 1,
    alignItems: "center",
    borderRadius: 18,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  detailValue: {
    fontSize: 24,
    fontWeight: "900",
  },
  detailLabel: {
    marginTop: 4,
    color: COLORS.textDim,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  streakBanner: {
    marginTop: 18,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
    backgroundColor: "rgba(255,107,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.22)",
  },
  streakFlame: {
    color: COLORS.orange,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  streakValue: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: "900",
  },
  streakLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionCaption: {
    marginTop: 18,
    color: COLORS.textDim,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontSize: 11,
    fontWeight: "800",
  },
  strikeRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  strikeDot: {
    width: 16,
    height: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  strikeDotSafe: {
    backgroundColor: COLORS.greenSoft,
    borderColor: "rgba(0,214,143,0.4)",
  },
  strikeDotUsed: {
    backgroundColor: "rgba(255,59,92,0.2)",
    borderColor: "rgba(255,59,92,0.4)",
  },
  checkinCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  cardSubtle: {
    color: COLORS.textDim,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "800",
  },
  journalInput: {
    minHeight: 110,
    marginTop: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: COLORS.text,
    textAlignVertical: "top",
    fontSize: 14,
  },
  miniGrid: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  miniStat: {
    flex: 1,
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: COLORS.borderSoft,
  },
  miniStatWide: {
    flex: 1.4,
  },
  miniStatValue: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  miniStatLabel: {
    marginTop: 5,
    color: COLORS.textDim,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  primaryButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: COLORS.orange,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  settlementCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
  settlementCopy: {
    marginTop: 10,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  secondaryButton: {
    marginTop: 16,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  metaRows: {
    marginTop: 16,
    gap: 10,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  metaLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 1.1,
    fontWeight: "700",
  },
  metaValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 12,
    textAlign: "right",
  },
  celebrationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(3,3,4,0.58)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  celebrationCard: {
    width: "100%",
    borderRadius: 28,
    padding: 24,
    alignItems: "center",
    backgroundColor: "rgba(10,10,14,0.96)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.25)",
  },
  celebrationEyebrow: {
    color: COLORS.green,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 1.3,
  },
  celebrationDay: {
    marginTop: 10,
    color: COLORS.text,
    fontSize: 38,
    fontWeight: "900",
  },
  celebrationCopy: {
    marginTop: 8,
    color: COLORS.textMuted,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
