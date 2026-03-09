
import { CharacterAvatar } from "@/components/CharacterAvatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import {
  formatDuelStatus,
  formatStartTime,
  getDuelTitle,
} from "@/lib/duel-copy";
import {
  DuelWithParticipants,
  getParticipantLabel,
  toDuelId,
} from "@/lib/duel-view";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
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
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// Mascot sounds and animation configs
const MASCOT_SOUNDS: Record<string, string> = {
  lion: "ROAR!",
  tiger: "GROWL!",
  wolf: "HOWL!",
  fox: "YIP!",
  dragon: "FIRE!",
  phoenix: "BLAZE!",
  snake: "HISS!",
  hawk: "SCREECH!",
  bear: "GROWL!",
  default: "ROAR!",
};

type MascotAnimationType = "shake" | "bounce" | "rise" | "fire" | "slither";

const MASCOT_ANIMATIONS: Record<string, MascotAnimationType> = {
  lion: "shake",
  tiger: "shake",
  wolf: "rise",
  fox: "bounce",
  dragon: "fire",
  phoenix: "fire",
  snake: "slither",
  hawk: "rise",
  bear: "shake",
  default: "shake",
};

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

type Props = {
  duelIdValue?: string | string[];
};

const EMPTY_FEEDBACK: FeedbackState = {
  visible: false,
  tone: "success",
  title: "",
  message: "",
};

const C = {
  orange: "#ff6b35",
  success: "#00d68f",
  danger: "#ff3b5c",
  warning: "#ffc107",
  surface: "#030304",
  card: "rgba(12,12,16,0.85)",
  border: "rgba(255,255,255,0.06)",
  white: "#ffffff",
  muted: "#555",
  mutedBright: "#8d8d96",
};

const PARTICLES = Array.from({ length: 7 }, (_, i) => i);
const SLIDER_WIDTH = 320;
const THUMB_SIZE = 60;
const SLIDE_MAX = SLIDER_WIDTH - THUMB_SIZE - 12;

export function DuelDetailScreen({ duelIdValue }: Props) {
  const router = useRouter();
  const wallet = useWallet();
  const [submitLoading, setSubmitLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);
  const [selectedDuelId, setSelectedDuelId] = useState<Id<"duels"> | null>(
    toDuelId(duelIdValue),
  );
  const [celebrationDay, setCelebrationDay] = useState<number | null>(null);
  const [myMascotSound, setMyMascotSound] = useState<string | null>(null);
  const [rivalMascotSound, setRivalMascotSound] = useState<string | null>(null);

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
  const pulse = useSharedValue(0);
  const celebration = useSharedValue(0);

  // Mascot animation shared values
  const myMascotScale = useSharedValue(1);
  const myMascotRotate = useSharedValue(0);
  const myMascotTranslateY = useSharedValue(0);
  const myMascotBrightness = useSharedValue(1);
  const rivalMascotScale = useSharedValue(1);
  const rivalMascotRotate = useSharedValue(0);
  const rivalMascotTranslateY = useSharedValue(0);
  const rivalMascotBrightness = useSharedValue(1);
  const vsScale = useSharedValue(1);

  useEffect(() => {
    mesh.value = withRepeat(
      withTiming(1, { duration: 16000, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
    pulse.value = withRepeat(
      withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [mesh, pulse]);

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
    const nextId = toDuelId(duelIdValue);
    if (nextId) setSelectedDuelId(nextId);
  }, [duelIdValue]);

  const activeDuels = useMemo(
    () => (duels ?? []).filter((duel) => duel.status === "ACTIVE"),
    [duels],
  );
  const resolvedDuels = useMemo(
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
      const fallback = activeDuels[0] ?? resolvedDuels[0] ?? null;
      if (fallback) setSelectedDuelId(fallback._id);
    }
  }, [activeDuels, resolvedDuels, selectedDuelId]);

  const duelStatus = selectedDuel?.status ?? "CREATED";
  const isActive = duelStatus === "ACTIVE";
  const isResolved = duelStatus === "RESOLVED" || duelStatus === "COMPLETED";
  const hasOnchainMetadata = !!selectedDuel?.onchainDuelAddress;
  const invalidLinkedDuel =
    typeof duelIdValue === "string" && !toDuelId(duelIdValue);

  const meIsPlayerOne = !!(
    selectedDuel &&
    user &&
    selectedDuel.player1 === user._id
  );
  const myDays = useMemo(() => {
    if (!progress || !user) return [];
    return progress.player1 === user._id ? progress.p1Days : progress.p2Days;
  }, [progress, user]);
  const myStreak = new Set(myDays).size;

  useEffect(() => {
    // Deeplink invite handling: If user clicks an invite link but hasn't joined, 
    // redirect them to the Duel Board where the "Join Duel" modal handles the rest.
    if (selectedDuel && user) {
      if (
        selectedDuel.status === "OPEN" &&
        selectedDuel.player1 !== user._id &&
        selectedDuel.player2 !== user._id
      ) {
        router.replace(`/(tabs)/duel?duelId=${selectedDuel._id}`);
      }
    }
  }, [selectedDuel, user, router]);

  // Rival streak calculation
  const rivalDays = useMemo(() => {
    if (!progress || !user) return [];
    return progress.player1 === user._id ? progress.p2Days : progress.p1Days;
  }, [progress, user]);
  const rivalStreak = new Set(rivalDays).size;

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
      Math.floor(
        (Date.now() - selectedDuel.startTime) / (24 * 60 * 60 * 1000),
      ) + 1,
    );
  }, [selectedDuel?.startTime, totalDays]);

  const strikesUsed = Math.min(2, Math.max(0, currentDay - 1 - myStreak));
  const meLabel = getParticipantLabel(
    selectedDuel,
    meIsPlayerOne ? "player1" : "player2",
  );
  const rivalLabel = getParticipantLabel(
    selectedDuel,
    meIsPlayerOne ? "player2" : "player1",
  );
  const meCharacter = meIsPlayerOne
    ? selectedDuel?.player1User?.selectedCharacter
    : selectedDuel?.player2User?.selectedCharacter;
  const rivalCharacter = meIsPlayerOne
    ? selectedDuel?.player2User?.selectedCharacter
    : selectedDuel?.player1User?.selectedCharacter;
  const remainingLabel = getRemainingLabel(selectedDuel);

  const meshStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mesh.value, [0, 1], [1, 0.8], Extrapolation.CLAMP),
    transform: [{ scale: interpolate(mesh.value, [0, 1], [1, 1.05]) }],
  }));

  const statusPulseStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [1, 0.7]),
    transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 1.2]) }],
  }));

  const celebrationStyle = useAnimatedStyle(() => ({
    opacity: celebration.value,
    transform: [
      { scale: interpolate(celebration.value, [0, 1], [0.75, 1]) },
      { translateY: interpolate(celebration.value, [0, 1], [30, 0]) },
    ],
  }));

  // Mascot animated styles
  const myMascotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: myMascotScale.value },
      { rotate: `${myMascotRotate.value}deg` },
      { translateY: myMascotTranslateY.value },
    ],
    opacity: myMascotBrightness.value,
  }));

  const rivalMascotAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: rivalMascotScale.value },
      { rotate: `${rivalMascotRotate.value}deg` },
      { translateY: rivalMascotTranslateY.value },
    ],
    opacity: rivalMascotBrightness.value,
  }));

  const vsAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: vsScale.value }],
  }));

  // Get mascot ID for sounds
  const getMascotId = (characterId?: string) => {
    if (!characterId) return "default";
    const id = characterId.toLowerCase();
    return MASCOT_SOUNDS[id] ? id : "default";
  };

  // Trigger mascot animation
  const triggerMascotAnimation = useCallback((isMe: boolean, characterId?: string) => {
    const mascotId = getMascotId(characterId);
    const animType = MASCOT_ANIMATIONS[mascotId] || "shake";
    const sound = MASCOT_SOUNDS[mascotId] || "ROAR!";

    // Show sound bubble
    if (isMe) {
      setMyMascotSound(sound);
      setTimeout(() => setMyMascotSound(null), 800);
    } else {
      setRivalMascotSound(sound);
      setTimeout(() => setRivalMascotSound(null), 800);
    }

    // Get the right shared values
    const scale = isMe ? myMascotScale : rivalMascotScale;
    const rotate = isMe ? myMascotRotate : rivalMascotRotate;
    const translateY = isMe ? myMascotTranslateY : rivalMascotTranslateY;
    const brightness = isMe ? myMascotBrightness : rivalMascotBrightness;

    // Reset values
    scale.value = 1;
    rotate.value = 0;
    translateY.value = 0;
    brightness.value = 1;

    // Apply animation based on type
    switch (animType) {
      case "shake": // Lion, Tiger, Bear
        scale.value = withSequence(
          withTiming(1.15, { duration: 80 }),
          withTiming(1.2, { duration: 80 }),
          withTiming(1.1, { duration: 80 }),
          withSpring(1, { damping: 8 }),
        );
        rotate.value = withSequence(
          withTiming(-5, { duration: 60 }),
          withTiming(5, { duration: 60 }),
          withTiming(-3, { duration: 60 }),
          withTiming(3, { duration: 60 }),
          withSpring(0, { damping: 8 }),
        );
        break;

      case "bounce": // Fox
        scale.value = withSequence(
          withTiming(1.25, { duration: 100 }),
          withTiming(0.95, { duration: 100 }),
          withTiming(1.15, { duration: 100 }),
          withSpring(1, { damping: 6 }),
        );
        rotate.value = withSequence(
          withTiming(8, { duration: 100 }),
          withTiming(-8, { duration: 100 }),
          withTiming(4, { duration: 100 }),
          withSpring(0, { damping: 8 }),
        );
        break;

      case "rise": // Wolf, Hawk
        translateY.value = withSequence(
          withTiming(-15, { duration: 200, easing: Easing.out(Easing.cubic) }),
          withTiming(-8, { duration: 150 }),
          withTiming(-3, { duration: 150 }),
          withSpring(0, { damping: 10 }),
        );
        scale.value = withSequence(
          withTiming(1.1, { duration: 200 }),
          withTiming(1.15, { duration: 200 }),
          withSpring(1, { damping: 8 }),
        );
        break;

      case "fire": // Dragon, Phoenix
        scale.value = withSequence(
          withTiming(1.15, { duration: 150 }),
          withTiming(1.25, { duration: 150 }),
          withTiming(1.15, { duration: 150 }),
          withSpring(1, { damping: 8 }),
        );
        brightness.value = withSequence(
          withTiming(1.3, { duration: 150 }),
          withTiming(1.5, { duration: 150 }),
          withTiming(1.2, { duration: 150 }),
          withTiming(1, { duration: 200 }),
        );
        break;

      case "slither": // Snake
        rotate.value = withSequence(
          withTiming(6, { duration: 80 }),
          withTiming(-6, { duration: 80 }),
          withTiming(4, { duration: 80 }),
          withTiming(-4, { duration: 80 }),
          withTiming(2, { duration: 80 }),
          withSpring(0, { damping: 10 }),
        );
        scale.value = withSequence(
          withTiming(1.08, { duration: 150 }),
          withTiming(1.12, { duration: 150 }),
          withSpring(1, { damping: 8 }),
        );
        break;
    }

    // Pulse VS badge
    vsScale.value = withSequence(
      withTiming(1.15, { duration: 100 }),
      withSpring(1, { damping: 8 }),
    );
  }, [
    myMascotBrightness,
    myMascotRotate,
    myMascotScale,
    myMascotTranslateY,
    rivalMascotBrightness,
    rivalMascotRotate,
    rivalMascotScale,
    rivalMascotTranslateY,
    vsScale,
  ]);

  // Auto-trigger animations when duel is selected
  useEffect(() => {
    if (selectedDuel && meCharacter) {
      const timer = setTimeout(() => {
        triggerMascotAnimation(true, meCharacter);
        setTimeout(() => {
          if (rivalCharacter) {
            triggerMascotAnimation(false, rivalCharacter);
          }
        }, 300);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [meCharacter, rivalCharacter, selectedDuel, triggerMascotAnimation]);

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const triggerCelebration = (dayNumber: number) => {
    setCelebrationDay(dayNumber);
    celebration.value = 0;
    celebration.value = withSequence(
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
      withDelay(1700, withTiming(0, { duration: 280 })),
    );
    setTimeout(() => setCelebrationDay(null), 2200);
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
      triggerCelebration(result.dayNumber);
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
        <ArenaBackground meshStyle={meshStyle} />
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>PvP Battle Board</Text>
          <Text style={styles.stateCopy}>
            Connect wallet to review live duels and submit check-ins.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ArenaBackground meshStyle={meshStyle} />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInDown.duration(420)}
          style={styles.headerBlock}
        >
          <Text style={styles.screenTitle}>Duel Detail</Text>
          <Text style={styles.screenSubtitle}>
            Open a duel and lock your streak.
          </Text>
        </Animated.View>

        {invalidLinkedDuel ? (
          <View style={styles.alertCard}>
            <Text style={styles.alertTitle}>Malformed duel link</Text>
            <Text style={styles.alertCopy}>
              Pick a duel from the list below.
            </Text>
          </View>
        ) : null}

        <SectionTitle title="Ongoing Duels" />
        {(activeDuels.length === 0 ? resolvedDuels : activeDuels).map(
          (duel, index) => (
            <Animated.View
              key={duel._id}
              entering={FadeInDown.duration(380).delay(40 + index * 35)}
            >
              <TouchableOpacity
                style={[
                  styles.duelListItem,
                  selectedDuelId === duel._id && styles.duelListItemActive,
                  duel.status !== "ACTIVE" && styles.duelListItemResolved,
                ]}
                onPress={() => setSelectedDuelId(duel._id)}
              >
                <View style={styles.duelInfo}>
                  <View style={styles.duelAvatarWrap}>
                    <CharacterAvatar
                      characterId={
                        duel.player1User?.selectedCharacter ??
                        duel.player2User?.selectedCharacter
                      }
                      label={duel.player1User?.username}
                      size={48}
                    />
                  </View>
                  <View style={styles.duelMeta}>
                    <Text style={styles.duelMetaTitle}>
                      {formatListTitle(duel)}
                    </Text>
                    <Text style={styles.duelMetaCopy}>
                      {duel.status === "ACTIVE"
                        ? `Active • Ends in ${remainingLabelForRow(duel.endTime)}`
                        : `${formatDuelStatus(duel.status as any)} • ${formatStartTime(duel.startTime)}`}
                    </Text>
                  </View>
                </View>
                <View style={styles.duelStreakBadge}>
                  {duel.status === "ACTIVE" ? (
                    <>
                      <Animated.View
                        style={[styles.duelFireDot, statusPulseStyle]}
                      />
                      <Text style={styles.duelStreakText}>
                        {getDuelStreakBadge(duel, user?._id, progress)}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={[styles.duelStreakText, styles.duelStreakResolved]}
                    >
                      {formatDuelStatus(duel.status as any).toUpperCase()}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
            </Animated.View>
          ),
        )}

        {selectedDuel ? (
          <Animated.View
            entering={FadeInDown.duration(440).delay(120)}
            style={styles.modalShell}
          >
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {getDuelTitle(selectedDuel)}
              </Text>
              <Text style={styles.modalClose}>X</Text>
            </View>

            <View style={styles.checkinCard}>
              {/* Premium Header */}
              <View style={styles.checkinDuelHeader}>
                <View style={styles.battleArenaLabel}>
                  <Text style={styles.battleArenaIcon}>⚔</Text>
                  <Text style={styles.battleArenaText}>Battle Arena</Text>
                </View>
                <View style={styles.checkinStatusPill}>
                  <Animated.View style={[styles.pulseDot, statusPulseStyle]} />
                  <Text style={styles.checkinStatusText}>
                    {formatDuelStatus(duelStatus).toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* Premium Battle Streak Comparison */}
              <View style={styles.streakBattleContainer}>
                <View style={styles.streakBattleRow}>
                  {/* You */}
                  <View style={styles.streakPlayerYou}>
                    <Text style={styles.streakPlayerLabelYou}>YOU</Text>
                    <TouchableOpacity
                      onPress={() => triggerMascotAnimation(true, meCharacter)}
                      activeOpacity={0.8}
                    >
                      <Animated.View
                        style={[
                          styles.streakAvatarAnimated,
                          myMascotAnimatedStyle,
                        ]}
                      >
                        <CharacterAvatar
                          characterId={meCharacter}
                          label={meLabel}
                          size={56}
                        />
                        {/* Sound Bubble */}
                        {myMascotSound && (
                          <View style={styles.soundBubble}>
                            <Text style={styles.soundBubbleText}>
                              {myMascotSound}
                            </Text>
                          </View>
                        )}
                        {/* Ripple Effect */}
                        <View
                          style={[
                            styles.soundRipple,
                            { borderColor: C.success },
                          ]}
                        />
                      </Animated.View>
                    </TouchableOpacity>
                    <Text style={styles.streakPlayerName}>{meLabel}</Text>
                    <View style={styles.streakValueBadgeYou}>
                      <Text style={styles.fireIcon}>🔥</Text>
                      <Text style={styles.streakValueTextYou}>{myStreak}</Text>
                    </View>
                  </View>

                  {/* VS Divider */}
                  <Animated.View
                    style={[styles.streakVsDivider, vsAnimatedStyle]}
                  >
                    <Text style={styles.streakVsText}>VS</Text>
                  </Animated.View>

                  {/* Rival */}
                  <View style={styles.streakPlayerRival}>
                    <Text style={styles.streakPlayerLabelRival}>RIVAL</Text>
                    <TouchableOpacity
                      onPress={() =>
                        triggerMascotAnimation(false, rivalCharacter)
                      }
                      activeOpacity={0.8}
                    >
                      <Animated.View
                        style={[
                          styles.streakAvatarAnimated,
                          rivalMascotAnimatedStyle,
                        ]}
                      >
                        <CharacterAvatar
                          characterId={rivalCharacter}
                          label={rivalLabel}
                          size={56}
                        />
                        {/* Sound Bubble */}
                        {rivalMascotSound && (
                          <View style={styles.soundBubbleRival}>
                            <Text style={styles.soundBubbleText}>
                              {rivalMascotSound}
                            </Text>
                          </View>
                        )}
                        {/* Ripple Effect */}
                        <View
                          style={[
                            styles.soundRipple,
                            { borderColor: C.orange },
                          ]}
                        />
                      </Animated.View>
                    </TouchableOpacity>
                    <Text style={styles.streakPlayerName}>{rivalLabel}</Text>
                    <View style={styles.streakValueBadgeRival}>
                      <Text style={styles.fireIcon}>🔥</Text>
                      <Text style={styles.streakValueTextRival}>
                        {rivalStreak}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Duel Details Grid */}
              <View style={styles.checkinDuelDetails}>
                <CheckinDetail
                  label="SOL Pot"
                  value={selectedDuel.stakeAmount.toFixed(1)}
                  color={C.success}
                />
                <CheckinDetail
                  label="Remaining"
                  value={remainingLabel}
                  color={C.warning}
                />
                <CheckinDetail
                  label="Days"
                  value={String(totalDays)}
                  color={C.white}
                />
              </View>

              {/* Strike Status */}
              <View style={styles.strikeWrap}>
                <Text style={styles.strikeHeading}>Your Strike Status</Text>
                <View style={styles.strikeBars}>
                  {[0, 1].map((index) => (
                    <View key={index} style={styles.strikeBar}>
                      <View
                        style={[
                          styles.strikeFill,
                          index < strikesUsed && styles.strikeFillActive,
                        ]}
                      />
                    </View>
                  ))}
                </View>
                <Text style={styles.strikeNote}>
                  2 strikes = automatic loss
                </Text>
              </View>

              {/* Button check in */}
              <TouchableOpacity
                style={[styles.checkInButton, (!isActive || submitLoading) && styles.disabled]}
                onPress={() => void handleCheckIn()}
                disabled={!isActive || submitLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.checkInButtonText}>
                  {submitLoading ? "Submitting..." : "Tap To Check In"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.distributionCard}>
              <Text style={styles.distributionTitle}>Win Distribution</Text>
              <DistributionRow
                label="Winner Takes"
                value="70%"
                color={C.success}
              />
              <DistributionRow
                label="Loser Vault Lock"
                value="25%"
                color={C.danger}
              />
              <DistributionRow
                label="Treasury Fee"
                value="5%"
                color={C.warning}
              />
            </View>

            {isResolved ? (
              <TouchableOpacity
                style={[
                  styles.settleButton,
                  (!hasOnchainMetadata || settleLoading) && styles.disabled,
                ]}
                onPress={() => void handleSettle()}
                disabled={!hasOnchainMetadata || settleLoading}
              >
                <Text style={styles.settleButtonText}>
                  {settleLoading ? "Settling..." : "Finalize Settlement"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </Animated.View>
        ) : (
          <EmptyState />
        )}
      </ScrollView>

      {celebrationDay !== null ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.checkinOverlay, celebrationStyle]}
        >
          <View style={styles.checkinSuccessIcon}>
            <View style={styles.checkinCircle} />
            <View style={styles.checkinCheckWrap}>
              <Text style={styles.checkinCheck}>✓</Text>
            </View>
            {Array.from({ length: 8 }).map((_, index) => (
              <CheckinParticle key={index} index={index} />
            ))}
          </View>
          <Text style={styles.checkinTitle}>Streak Protected!</Text>
          <Text style={styles.checkinStreak}>Day {celebrationDay}</Text>
          <Text style={styles.checkinSubtitle}>Keep going, champion!</Text>
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
      <Animated.View style={[styles.bgDuels, meshStyle]} />
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
      index * 240,
      withRepeat(
        withTiming(1, { duration: 14000 + index * 600, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.4, 0.4, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [760, -90]) },
      { scale: interpolate(progress.value, [0, 1], [0, 1]) },
    ],
  }));
  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: `${10 + index * 12}%`,
          backgroundColor: index % 2 === 0 ? C.orange : C.success,
        },
      ]}
    />
  );
}

function CheckinParticle({ index }: { index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withSequence(
      withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) }),
      withTiming(0, { duration: 100 }),
    );
  }, [progress]);
  const angle = (Math.PI * 2 * index) / 8;
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      {
        translateX:
          Math.cos(angle) * interpolate(progress.value, [0, 1], [0, 72]),
      },
      {
        translateY:
          Math.sin(angle) * interpolate(progress.value, [0, 1], [0, 72]),
      },
      { scale: interpolate(progress.value, [0, 1], [1, 0]) },
    ],
  }));
  return <Animated.View style={[styles.checkinParticle, style]} />;
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function CheckinDetail({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.detailBox}>
      <Text style={[styles.detailValue, { color }]}>{value}</Text>
      <Text style={styles.detailLabel}>{label}</Text>
    </View>
  );
}

function DistributionRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.distributionRow}>
      <Text style={styles.distributionLabel}>{label}</Text>
      <Text style={[styles.distributionValue, { color }]}>{value}</Text>
    </View>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>No duel selected</Text>
      <Text style={styles.emptyCopy}>
        Pick a duel from the list above to open the premium duel card.
      </Text>
    </View>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatListTitle(duel: DuelWithParticipants) {
  const p1 = duel.player1User?.username ?? "Player 1";
  const p2 =
    duel.player2User?.username ??
    (duel.status === "OPEN" ? "Waiting" : "Player 2");
  return `${p1} vs ${p2}`;
}

function remainingLabelForRow(timestamp?: number) {
  if (!timestamp) return "soon";
  const diff = timestamp - Date.now();
  if (diff <= 0) return "ended";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  if (days > 0) return `${days}d`;
  const hours = Math.floor(diff / (60 * 60 * 1000));
  return `${Math.max(1, hours)}h`;
}

function getRemainingLabel(duel?: DuelWithParticipants | null) {
  if (!duel?.endTime) return "TBD";
  const diff = duel.endTime - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / (24 * 60 * 60 * 1000));
  const hours = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (days > 0) return `${days}d ${hours}h`;
  return `${Math.max(1, hours)}h`;
}

function getDuelStreakBadge(
  duel: DuelWithParticipants,
  userId: Id<"users"> | undefined,
  progress?: DuelProgress,
) {
  if (!userId || !progress || progress.player1 !== duel.player1) {
    return String(Math.round(duel.stakeAmount * 10));
  }
  const mine = progress.player1 === userId ? progress.p1Days : progress.p2Days;
  return String(new Set(mine).size);
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.surface },
  scroll: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 44 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  stateCopy: {
    marginTop: 8,
    color: C.mutedBright,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  bgDuels: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: C.surface,
    opacity: 1,
  },
  bgNoise: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.015)",
  },
  particles: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  particle: { position: "absolute", width: 4, height: 4, borderRadius: 999 },
  headerBlock: { alignItems: "center", marginVertical: 10 },
  screenTitle: { color: C.white, fontSize: 24, fontWeight: "700" },
  screenSubtitle: { marginTop: 6, color: C.mutedBright, fontSize: 12 },
  alertCard: {
    backgroundColor: "rgba(255,107,53,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.2)",
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  alertTitle: { color: C.white, fontSize: 14, fontWeight: "700" },
  alertCopy: { marginTop: 4, color: C.mutedBright, fontSize: 12 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    marginTop: 8,
  },
  sectionLine: { width: 20, height: 1, backgroundColor: C.orange },
  sectionTitle: {
    color: "#444",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  duelListItem: {
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
  duelListItemActive: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,107,53,0.2)",
  },
  duelListItemResolved: { opacity: 0.6 },
  duelInfo: { flexDirection: "row", alignItems: "center", gap: 14, flex: 1 },
  duelAvatarWrap: { borderRadius: 24, overflow: "hidden" },
  duelMeta: { flex: 1 },
  duelMetaTitle: { color: C.white, fontSize: 14, fontWeight: "700" },
  duelMetaCopy: {
    marginTop: 4,
    color: C.muted,
    fontSize: 11,
    fontWeight: "500",
  },
  duelStreakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,107,53,0.15)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.2)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  duelFireDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.orange,
  },
  duelStreakText: { color: C.orange, fontSize: 15, fontWeight: "700" },
  duelStreakResolved: { color: C.white, fontSize: 12 },
  modalShell: {
    backgroundColor: "#0c0c10",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 4,
    backgroundColor: "#3a3a42",
    alignSelf: "center",
    marginBottom: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { color: C.white, fontSize: 20, fontWeight: "700", flex: 1 },
  modalClose: {
    color: C.muted,
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 10,
  },
  checkinCard: {
    backgroundColor: "rgba(0,214,143,0.04)",
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.15)",
    borderRadius: 24,
    padding: 20,
  },
  checkinDuelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  battleArenaLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  battleArenaIcon: { fontSize: 16, color: C.orange },
  battleArenaText: { color: C.white, fontSize: 14, fontWeight: "700" },
  checkinStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(0,214,143,0.1)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.25)",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: C.success,
  },
  checkinStatusText: {
    color: C.success,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },

  // Premium Battle Streak Comparison
  streakBattleContainer: {
    backgroundColor: "rgba(255,107,53,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  streakBattleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  streakPlayerYou: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(0,214,143,0.2)",
  },
  streakPlayerRival: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.2)",
  },
  streakPlayerLabelYou: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: C.success,
    marginBottom: 8,
  },
  streakPlayerLabelRival: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 1.5,
    color: C.orange,
    marginBottom: 8,
  },
  streakAvatarAnimated: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(20,20,24,1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
    overflow: "visible",
  },
  streakPlayerName: {
    fontSize: 14,
    fontWeight: "700",
    color: C.white,
    marginBottom: 8,
  },
  streakValueBadgeYou: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,214,143,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakValueBadgeRival: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,107,53,0.15)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  streakValueTextYou: { fontSize: 16, fontWeight: "700", color: C.success },
  streakValueTextRival: { fontSize: 16, fontWeight: "700", color: C.orange },
  fireIcon: { fontSize: 14 },
  streakVsDivider: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.orange,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 12,
    shadowColor: C.orange,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
  },
  streakVsText: { color: C.white, fontSize: 11, fontWeight: "800" },

  // Sound Bubble
  soundBubble: {
    position: "absolute",
    top: -28,
    left: "50%",
    transform: [{ translateX: -30 }],
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 100,
  },
  soundBubbleRival: {
    position: "absolute",
    top: -28,
    left: "50%",
    transform: [{ translateX: -30 }],
    backgroundColor: "rgba(0,0,0,0.9)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    zIndex: 100,
  },
  soundBubbleText: { color: C.white, fontSize: 11, fontWeight: "700" },
  soundRipple: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: 32,
    borderWidth: 2,
    opacity: 0.3,
  },

  checkinDuelDetails: { flexDirection: "row", gap: 10, marginBottom: 20 },
  detailBox: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  detailValue: { fontSize: 22, fontWeight: "700" },
  detailLabel: {
    marginTop: 4,
    color: "#888",
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  strikeWrap: { alignItems: "center", marginBottom: 20 },
  strikeHeading: {
    color: C.mutedBright,
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  strikeBars: { flexDirection: "row", gap: 8, marginTop: 10 },
  strikeBar: {
    width: 40,
    height: 10,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 5,
    overflow: "hidden",
  },
  strikeFill: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0,
    backgroundColor: C.danger,
  },
  strikeFillActive: { opacity: 1 },
  strikeNote: { color: "#444", fontSize: 10, marginTop: 8 },
  checkInButton: {
    height: 72,
    backgroundColor: "rgba(0,214,143,0.15)",
    borderColor: "rgba(0,214,143,0.3)",
    borderWidth: 1,
    borderRadius: 36,
    width: "100%",
    maxWidth: SLIDER_WIDTH,
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  checkInButtonText: {
    color: C.success,
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  distributionCard: {
    marginTop: 16,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    borderRadius: 16,
  },
  distributionTitle: {
    color: C.muted,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 12,
  },
  distributionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  distributionLabel: { color: C.mutedBright, fontSize: 12 },
  distributionValue: { fontSize: 12, fontWeight: "700" },
  settleButton: {
    marginTop: 16,
    backgroundColor: C.orange,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  settleButtonText: {
    color: C.white,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  disabled: { opacity: 0.45 },
  emptyCard: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  emptyTitle: { color: C.white, fontSize: 16, fontWeight: "700" },
  emptyCopy: {
    marginTop: 6,
    color: C.mutedBright,
    fontSize: 12,
    lineHeight: 18,
  },
  checkinOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  checkinSuccessIcon: {
    width: 160,
    height: 160,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 30,
  },
  checkinCircle: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: C.success,
    opacity: 0.25,
  },
  checkinCheckWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: C.success,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.success,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 28,
  },
  checkinCheck: { color: "#000", fontSize: 44, fontWeight: "900" },
  checkinParticle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.success,
  },
  checkinTitle: {
    color: C.success,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 10,
  },
  checkinStreak: {
    color: C.white,
    fontSize: 48,
    fontWeight: "700",
    marginBottom: 10,
  },
  checkinSubtitle: { color: "#666", fontSize: 14 },
});
