import { CharacterAvatar } from "@/components/CharacterAvatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { getDuelDescription, getDuelTitle } from "@/lib/duel-copy";
import {
  DuelWithParticipants,
  getParticipantLabel,
  shortenWallet,
  toDuelId,
} from "@/lib/duel-view";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
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
  FadeInDown,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

type DuelProgress = {
  player1: Id<"users">;
  player2?: Id<"users">;
  p1Days: number[];
  p2Days: number[];
};

type DuelPhase = "unknown" | "upcoming" | "live" | "ended";
type DayState = "done" | "missed" | "today" | "upcoming";
type FeedbackState = {
  visible: boolean;
  tone: "success" | "error";
  title: string;
  message: string;
};

type VisibleWeek = {
  index: number;
  startDay: number;
  endDay: number;
  days: number[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30 * 1000;
const EMPTY_FEEDBACK: FeedbackState = {
  visible: false,
  tone: "success",
  title: "",
  message: "",
};

export default function DuelDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ duelId?: string }>();
  const wallet = useWallet();

  const duelId = toDuelId(params.duelId);
  const [now, setNow] = useState(Date.now());
  const [treasuryAddress, setTreasuryAddress] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [settleLoading, setSettleLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);

  const orbit = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    orbit.value = withRepeat(
      withTiming(1, { duration: 28000, easing: Easing.linear }),
      -1,
      false,
    );
    float.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [float, orbit]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${interpolate(orbit.value, [0, 1], [0, 360])}deg` }],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(float.value, [0, 1], [-8, 10]) }],
  }));

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const submitCompletion = useMutation(
    api.submissions.submitCompletion.submitCompletion,
  );
  const prepareSettlement = useMutation(
    api.duels.prepareSettlement.prepareSettlement,
  );
  const finalizeSettlement = useMutation(
    api.duels.finalizeSettlement.finalizeSettlement,
  );

  const programConfig = useQuery(
    api.duels.getProgramConfig.getProgramConfig,
    {},
  );
  const duel = useQuery(
    api.duels.getDuelById.getDuelById,
    duelId ? { id: duelId } : "skip",
  ) as DuelWithParticipants | null | undefined;
  const progress = useQuery(
    api.duels.getDuelProgress.getDuelProgress,
    duelId ? { duelId } : "skip",
  ) as DuelProgress | undefined;

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );

  const viewerIsParticipant = !!(
    duel &&
    user &&
    (duel.player1 === user._id || duel.player2 === user._id)
  );
  const meIsPlayerOne = !!(duel && user && duel.player1 === user._id);

  const player1Days = useMemo(
    () => uniqueDays(progress?.p1Days),
    [progress?.p1Days],
  );
  const player2Days = useMemo(
    () => uniqueDays(progress?.p2Days),
    [progress?.p2Days],
  );
  const myDays = viewerIsParticipant
    ? meIsPlayerOne
      ? player1Days
      : player2Days
    : player1Days;
  const rivalDays = viewerIsParticipant
    ? meIsPlayerOne
      ? player2Days
      : player1Days
    : player2Days;

  const totalDays = getTotalDays(duel);
  const currentDay = getCurrentDay(duel, now, totalDays);
  const phase = getDuelPhase(duel, now);
  const visibleWeeks = getVisibleWeeks(totalDays, currentDay, phase);
  const hiddenWeeks = Math.max(
    0,
    Math.ceil(totalDays / 7) - visibleWeeks.length,
  );
  const mySubmittedToday = myDays.includes(currentDay);
  const canCheckIn =
    !!duelId &&
    !!user &&
    viewerIsParticipant &&
    duel?.status === "ACTIVE" &&
    phase === "live" &&
    !mySubmittedToday;
  const canSettle =
    !!duelId &&
    !!duel &&
    viewerIsParticipant &&
    duel.status === "ACTIVE" &&
    phase === "ended" &&
    !!duel.onchainDuelAddress &&
    !duel.resolved;

  const myLabel = getSideLabel(
    duel,
    viewerIsParticipant,
    meIsPlayerOne,
    "self",
  );
  const rivalLabel = getSideLabel(
    duel,
    viewerIsParticipant,
    meIsPlayerOne,
    "rival",
  );
  const myCharacter = getSideCharacter(
    duel,
    viewerIsParticipant,
    meIsPlayerOne,
    "self",
  );
  const rivalCharacter = getSideCharacter(
    duel,
    viewerIsParticipant,
    meIsPlayerOne,
    "rival",
  );
  const rivalWallet = getSideWallet(
    duel,
    viewerIsParticipant,
    meIsPlayerOne,
    "rival",
  );
  const winnerLabel = getWinnerLabel(duel);

  const handleCheckIn = async () => {
    if (!duelId || !user) {
      openFeedback(
        "error",
        "Check-in blocked",
        "Connect the participant wallet before submitting today.",
      );
      return;
    }

    setSubmitLoading(true);
    try {
      const result = await submitCompletion({
        duelId,
        player: user._id,
      });
      openFeedback(
        "success",
        "Check-in locked",
        result.message
          ? `${result.message}. Day ${result.dayNumber} is already secured.`
          : `Day ${result.dayNumber} has been secured.`,
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
    if (!duel || !duelId || !walletAddress) {
      openFeedback(
        "error",
        "Settlement blocked",
        "Connect a participant wallet before settling.",
      );
      return;
    }

    if (!duel.onchainDuelAddress) {
      openFeedback(
        "error",
        "Missing on-chain metadata",
        "This duel cannot be settled because its on-chain address is missing.",
      );
      return;
    }

    setSettleLoading(true);
    let onChainSettlement: Awaited<
      ReturnType<typeof wallet.settleDuel>
    > | null = null;
    try {
      const context = await wallet.getDuelSettlementContext(
        duel.onchainDuelAddress,
      );
      const prepared = await prepareSettlement({
        duelId,
        callerWallet: walletAddress,
        onchainDuelId: context.duelId,
        settlementNonce: context.settlementNonce,
      });

      onChainSettlement = await wallet.settleDuel({
        duelAddress: duel.onchainDuelAddress,
        resultByte: prepared.resultByte,
        message: prepared.message,
        signature: prepared.signature,
      });

      await finalizeSettlement({
        duelId,
        settlementTxSignature: onChainSettlement.signature,
      });

      openFeedback(
        "success",
        "Settlement complete",
        prepared.winnerWallet
          ? `${shortenWallet(prepared.winnerWallet)} takes the duel.`
          : formatOutcome(prepared.outcome),
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Settlement failed",
        onChainSettlement
          ? `On-chain settlement succeeded, but backend finalization failed. Tx: ${onChainSettlement.signature}`
          : (error?.message ?? "Could not settle duel."),
      );
    } finally {
      setSettleLoading(false);
    }
  };

  if (!duelId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <HomeBackground orbStyle={orbStyle} />
        <CenteredState
          title="Malformed duel link"
          copy="This duel id is invalid. Open the duel again from the arena."
        />
      </SafeAreaView>
    );
  }

  if (duel === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <HomeBackground orbStyle={orbStyle} />
        <CenteredState
          title="Loading duel"
          copy="Pulling live duel data and streak records."
        />
      </SafeAreaView>
    );
  }

  if (!duel) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <HomeBackground orbStyle={orbStyle} />
        <CenteredState
          title="Duel not found"
          copy="This duel no longer exists or the shared link is stale."
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <HomeBackground orbStyle={orbStyle} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backPill}
            onPress={() => {
              router.replace("/(tabs)/duel");
            }}
          >
            <Text style={styles.backPillText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText}>
              {getStatusLabel(duel.status, phase)}
            </Text>
          </View>
        </View>

        <Animated.View
          entering={FadeInDown.duration(420)}
          style={styles.heroCard}
        >
          <View style={styles.heroTop}>
            <View style={styles.heroTitleWrap}>
              <Text style={styles.heroEyebrow}>Duel Arena</Text>
              <Text style={styles.heroTitle}>{getDuelTitle(duel)}</Text>
              <Text style={styles.heroCopy}>{getDuelDescription(duel)}</Text>
            </View>
            <View style={styles.heroPot}>
              <Text style={styles.heroPotLabel}>Stake</Text>
              <Text style={styles.heroPotValue}>{duel.stakeAmount} SOL</Text>
            </View>
          </View>

          <View style={styles.mascotShowdown}>
            <Animated.View style={[styles.duelistCard, mascotStyle]}>
              <CharacterAvatar
                characterId={myCharacter}
                label={myLabel}
                size={76}
              />
              <Text style={styles.duelistName}>{myLabel}</Text>
              <Text style={styles.duelistMeta}>
                {myDays.length}/{totalDays} days
              </Text>
            </Animated.View>

            <View style={styles.heroCenter}>
              <View style={styles.heroRing}>
                <Text style={styles.heroRingText}>VS</Text>
              </View>
              <Text style={styles.heroCenterCopy}>
                {phase === "upcoming"
                  ? `Starts ${formatRelativeTime(duel.startTime, now)}`
                  : phase === "ended"
                    ? "Settlement window open"
                    : `Day ${currentDay} live`}
              </Text>
            </View>

            <Animated.View style={[styles.duelistCard, mascotStyle]}>
              <CharacterAvatar
                characterId={rivalCharacter}
                label={rivalLabel}
                size={76}
              />
              <Text style={styles.duelistName}>
                {duel.player2 ? rivalLabel : "Awaiting rival"}
              </Text>
              <Text style={styles.duelistMeta}>
                {rivalDays.length}/{totalDays} days
              </Text>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(460).delay(40)}
          style={styles.actionCard}
        >
          <Text style={styles.sectionTitle}>Action Center</Text>
          <Text style={styles.sectionCopy}>
            {getActionCopy(
              duel.status,
              phase,
              mySubmittedToday,
              duel.startTime,
              duel.endTime,
              now,
            )}
          </Text>

          <View style={styles.buttonStack}>
            <GateButton
              label={
                submitLoading
                  ? "Submitting..."
                  : mySubmittedToday
                    ? "Checked In"
                    : "Check In Today"
              }
              onPress={handleCheckIn}
              disabled={!canCheckIn || submitLoading}
            />
            <GateButton
              label={
                settleLoading
                  ? "Settling..."
                  : duel.resolved
                    ? "Settled"
                    : "Settle Duel"
              }
              onPress={handleSettle}
              variant="ghost"
              disabled={!canSettle || settleLoading}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(500).delay(80)}
          style={styles.infoCard}
        >
          <Text style={styles.sectionTitle}>Contract Snapshot</Text>
          <View style={styles.infoGrid}>
            <InfoTile label="Starts" value={formatDateTime(duel.startTime)} />
            <InfoTile label="Ends" value={formatDateTime(duel.endTime)} />
            <InfoTile
              label="Winner"
              value={
                winnerLabel ??
                (phase === "ended" ? "Ready to settle" : "Pending")
              }
            />
            <InfoTile
              label="Rival Wallet"
              value={rivalWallet ? shortenWallet(rivalWallet) : "Not joined"}
            />
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(540).delay(120)}
          style={styles.progressCard}
        >
          <Text style={styles.sectionTitle}>Submission Board</Text>
          <Text style={styles.sectionCopy}>
            Weekly cards keep longer duels readable. You see the current week,
            the nearby weeks, and the edges of the contract.
          </Text>

          {visibleWeeks.map((week) => (
            <WeekCard
              key={week.index}
              week={week}
              myDays={myDays}
              rivalDays={rivalDays}
              currentDay={currentDay}
              phase={phase}
              isParticipant={viewerIsParticipant}
              rivalJoined={!!duel.player2}
            />
          ))}

          {hiddenWeeks > 0 ? (
            <Text style={styles.hiddenWeeksText}>
              {hiddenWeeks} more {hiddenWeeks === 1 ? "week is" : "weeks are"}{" "}
              collapsed between these checkpoints.
            </Text>
          ) : null}
        </Animated.View>

        <Link href="/(tabs)/duel" asChild>
          <TouchableOpacity style={styles.bottomBackLink}>
            <Text style={styles.bottomBackText}>Back to duel board</Text>
          </TouchableOpacity>
        </Link>
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

function WeekCard({
  week,
  myDays,
  rivalDays,
  currentDay,
  phase,
  isParticipant,
  rivalJoined,
}: {
  week: VisibleWeek;
  myDays: number[];
  rivalDays: number[];
  currentDay: number;
  phase: DuelPhase;
  isParticipant: boolean;
  rivalJoined: boolean;
}) {
  return (
    <View style={styles.weekCard}>
      <Text style={styles.weekTitle}>
        Week {week.index + 1} • Days {week.startDay}-{week.endDay}
      </Text>

      <ProgressLane
        label={isParticipant ? "You" : "Player 1"}
        accent="mana"
        days={week.days}
        submissions={myDays}
        currentDay={currentDay}
        phase={phase}
      />

      <ProgressLane
        label={rivalJoined ? "Rival" : "Open Slot"}
        accent="green"
        days={week.days}
        submissions={rivalDays}
        currentDay={currentDay}
        phase={phase}
      />
    </View>
  );
}

function ProgressLane({
  label,
  accent,
  days,
  submissions,
  currentDay,
  phase,
}: {
  label: string;
  accent: "mana" | "green";
  days: number[];
  submissions: number[];
  currentDay: number;
  phase: DuelPhase;
}) {
  const isOrange = accent === "mana";
  return (
    <View style={styles.laneRow}>
      <Text style={styles.laneTitle}>{label}</Text>
      <View style={styles.dayGrid}>
        {days.map((day) => {
          const state = getDayState(day, submissions, currentDay, phase);
          return (
            <View
              key={day}
              style={[
                styles.dayCell,
                isOrange ? styles.dayCellOrange : styles.dayCellGreen,
                state === "done" &&
                  (isOrange
                    ? styles.dayCellOrangeDone
                    : styles.dayCellGreenDone),
                state === "today" && styles.dayCellToday,
                state === "missed" && styles.dayCellMissed,
                state === "upcoming" && styles.dayCellUpcoming,
              ]}
            >
              <Text style={styles.dayCellText}>{day}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function HomeBackground({
  orbStyle,
}: {
  orbStyle: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <>
      <View style={styles.bgHome} />
      <Animated.View style={[styles.bgHomeOrb, orbStyle]} />
      <View style={styles.particleLayer}>
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
        withTiming(1, { duration: 14000 + index * 500, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [index, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.1, 0.9, 1], [0, 0.35, 0.35, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [720, -80]) },
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
          backgroundColor: index % 2 === 0 ? C.mana : C.success,
        },
      ]}
    />
  );
}

function CenteredState({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.stateWrap}>
      <Text style={styles.stateTitle}>{title}</Text>
      <Text style={styles.stateCopy}>{copy}</Text>
    </View>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoTile}>
      <Text style={styles.infoTileLabel}>{label}</Text>
      <Text style={styles.infoTileValue}>{value}</Text>
    </View>
  );
}

function uniqueDays(days?: number[]) {
  return Array.from(new Set(days ?? [])).sort((a, b) => a - b);
}

function getTotalDays(duel?: DuelWithParticipants | null) {
  if (!duel?.startTime || !duel?.endTime) return 7;
  return Math.max(1, Math.ceil((duel.endTime - duel.startTime) / DAY_MS));
}

function getCurrentDay(
  duel: DuelWithParticipants | null | undefined,
  now: number,
  totalDays: number,
) {
  if (!duel?.startTime) return 1;
  if (now <= duel.startTime) return 1;
  return Math.min(totalDays, Math.floor((now - duel.startTime) / DAY_MS) + 1);
}

function getDuelPhase(
  duel: DuelWithParticipants | null | undefined,
  now: number,
): DuelPhase {
  if (!duel?.startTime || !duel?.endTime) return "unknown";
  if (now < duel.startTime) return "upcoming";
  if (now >= duel.endTime) return "ended";
  return "live";
}

function getVisibleWeeks(
  totalDays: number,
  currentDay: number,
  phase: DuelPhase,
) {
  const totalWeeks = Math.max(1, Math.ceil(totalDays / 7));
  if (totalWeeks <= 4) {
    return Array.from({ length: totalWeeks }, (_, index) =>
      buildWeek(index, totalDays),
    );
  }

  const currentWeek = Math.min(
    totalWeeks - 1,
    Math.max(0, Math.floor((Math.max(1, currentDay) - 1) / 7)),
  );
  const focusWeek = phase === "ended" ? totalWeeks - 1 : currentWeek;
  const chosen = new Set([0, totalWeeks - 1, focusWeek]);

  if (focusWeek > 0) chosen.add(focusWeek - 1);
  if (focusWeek < totalWeeks - 1) chosen.add(focusWeek + 1);

  return Array.from(chosen)
    .sort((a, b) => a - b)
    .map((index) => buildWeek(index, totalDays));
}

function buildWeek(index: number, totalDays: number): VisibleWeek {
  const startDay = index * 7 + 1;
  const endDay = Math.min(totalDays, startDay + 6);
  return {
    index,
    startDay,
    endDay,
    days: Array.from(
      { length: endDay - startDay + 1 },
      (_, dayIndex) => startDay + dayIndex,
    ),
  };
}

function getDayState(
  day: number,
  submittedDays: number[],
  currentDay: number,
  phase: DuelPhase,
): DayState {
  if (submittedDays.includes(day)) return "done";
  if (phase === "live" && day === currentDay) return "today";
  if (phase === "ended" || day < currentDay) return "missed";
  return "upcoming";
}

function getStatusLabel(status?: string, phase?: DuelPhase) {
  if (status === "RESOLVED" || status === "COMPLETED") return "Resolved";
  if (status === "CANCELLED") return "Cancelled";
  if (phase === "upcoming") return "Upcoming";
  if (phase === "ended") return "Awaiting Settlement";
  return "Live";
}

function getActionCopy(
  status: string,
  phase: DuelPhase,
  mySubmittedToday: boolean,
  startTime?: number,
  endTime?: number,
  now = Date.now(),
) {
  if (status === "RESOLVED" || status === "COMPLETED") {
    return "This duel is already finalized. Review the board and payout record.";
  }
  if (phase === "upcoming") {
    return `The duel starts ${formatRelativeTime(startTime, now)}. Your first check-in opens then.`;
  }
  if (phase === "ended") {
    return `The duel ended ${formatRelativeTime(endTime, now)}. Settlement is the next step.`;
  }
  if (mySubmittedToday) {
    return "Today is already locked. The next check-in opens after rollover.";
  }
  return "Submit today near the top of the screen so you do not miss the live window.";
}

function getWinnerLabel(duel?: DuelWithParticipants | null) {
  if (!duel?.winner) return null;
  if (duel.winner === duel.player1) return getParticipantLabel(duel, "player1");
  if (duel.winner === duel.player2) return getParticipantLabel(duel, "player2");
  return null;
}

function getSideLabel(
  duel: DuelWithParticipants | null | undefined,
  viewerIsParticipant: boolean,
  meIsPlayerOne: boolean,
  side: "self" | "rival",
) {
  if (!duel) return side === "self" ? "Player 1" : "Player 2";
  if (!viewerIsParticipant) {
    return getParticipantLabel(duel, side === "self" ? "player1" : "player2");
  }
  if (side === "self") {
    return getParticipantLabel(duel, meIsPlayerOne ? "player1" : "player2");
  }
  return getParticipantLabel(duel, meIsPlayerOne ? "player2" : "player1");
}

function getSideCharacter(
  duel: DuelWithParticipants | null | undefined,
  viewerIsParticipant: boolean,
  meIsPlayerOne: boolean,
  side: "self" | "rival",
) {
  if (!duel) return null;
  if (!viewerIsParticipant) {
    return side === "self"
      ? duel.player1User?.selectedCharacter
      : duel.player2User?.selectedCharacter;
  }
  if (side === "self") {
    return meIsPlayerOne
      ? duel.player1User?.selectedCharacter
      : duel.player2User?.selectedCharacter;
  }
  return meIsPlayerOne
    ? duel.player2User?.selectedCharacter
    : duel.player1User?.selectedCharacter;
}

function getSideWallet(
  duel: DuelWithParticipants | null | undefined,
  viewerIsParticipant: boolean,
  meIsPlayerOne: boolean,
  side: "self" | "rival",
) {
  if (!duel) return null;
  if (!viewerIsParticipant) {
    return side === "self"
      ? duel.player1User?.walletAddress
      : duel.player2User?.walletAddress;
  }
  if (side === "self") {
    return meIsPlayerOne
      ? duel.player1User?.walletAddress
      : duel.player2User?.walletAddress;
  }
  return meIsPlayerOne
    ? duel.player2User?.walletAddress
    : duel.player1User?.walletAddress;
}

function formatDateTime(value?: number) {
  if (!value) return "TBD";
  return new Date(value).toLocaleString();
}

function formatRelativeTime(value?: number, now = Date.now()) {
  if (!value) return "TBD";
  const diffMs = value - now;
  const absMs = Math.abs(diffMs);
  const hours = Math.floor(absMs / (60 * 60 * 1000));
  const minutes = Math.floor((absMs % (60 * 60 * 1000)) / (60 * 1000));
  const days = Math.floor(hours / 24);

  let label = "";
  if (days > 0) label = `${days}d ${hours % 24}h`;
  else if (hours > 0) label = `${hours}h ${minutes}m`;
  else label = `${Math.max(1, minutes)}m`;

  return diffMs >= 0 ? `in ${label}` : `${label} ago`;
}

function formatOutcome(outcome: string) {
  switch (outcome) {
    case "PLAYER1_WIN":
      return "Player 1 wins";
    case "PLAYER2_WIN":
      return "Player 2 wins";
    case "DRAW_BOTH_SUCCESS":
      return "Draw. Both players completed the same number of days.";
    case "DRAW_BOTH_FAIL":
      return "Draw. Neither player completed enough days.";
    default:
      return outcome;
  }
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#030304",
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  bgHome: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#030304",
  },
  bgHomeOrb: {
    position: "absolute",
    top: 70,
    left: "50%",
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.08)",
  },
  particleLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  particle: {
    position: "absolute",
    width: 4,
    height: 4,
    borderRadius: 999,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18,
  },
  backPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  backPillText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(255,107,53,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.18)",
  },
  statusBadgeText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  heroCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 18,
  },
  heroTop: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroEyebrow: {
    color: C.mana,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  heroTitle: {
    color: C.white,
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroCopy: {
    color: "#9b9ba3",
    fontSize: 14,
    lineHeight: 21,
  },
  heroPot: {
    minWidth: 104,
    borderRadius: 18,
    padding: 14,
    alignItems: "flex-end",
    backgroundColor: "rgba(255,107,53,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.16)",
  },
  heroPotLabel: {
    color: "#8d8d96",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroPotValue: {
    color: C.white,
    fontSize: 16,
    fontWeight: "800",
  },
  mascotShowdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  duelistCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  duelistName: {
    marginTop: 10,
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  duelistMeta: {
    marginTop: 4,
    color: "#8d8d96",
    fontSize: 12,
  },
  heroCenter: {
    width: 90,
    alignItems: "center",
    gap: 10,
  },
  heroRing: {
    width: 58,
    height: 58,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroRingText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  heroCenterCopy: {
    color: "#8d8d96",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 16,
  },
  actionCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 18,
  },
  sectionTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  sectionCopy: {
    color: "#9b9ba3",
    fontSize: 13,
    lineHeight: 20,
  },
  buttonStack: {
    marginTop: 16,
    gap: 10,
  },
  infoCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 18,
  },
  infoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 8,
  },
  infoTile: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
  },
  infoTileLabel: {
    color: "#8d8d96",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  infoTileValue: {
    color: C.white,
    fontSize: 12,
    lineHeight: 18,
  },
  progressCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 18,
  },
  weekCard: {
    marginTop: 14,
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  weekTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 12,
  },
  laneRow: {
    marginBottom: 12,
  },
  laneTitle: {
    color: "#8d8d96",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  dayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  dayCell: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellOrange: {
    backgroundColor: "rgba(255,107,53,0.08)",
    borderColor: "rgba(255,107,53,0.14)",
  },
  dayCellGreen: {
    backgroundColor: "rgba(0,214,143,0.08)",
    borderColor: "rgba(0,214,143,0.14)",
  },
  dayCellOrangeDone: {
    backgroundColor: C.mana,
    borderColor: "#ff936b",
  },
  dayCellGreenDone: {
    backgroundColor: C.success,
    borderColor: "#55f0c2",
  },
  dayCellToday: {
    backgroundColor: "rgba(255,210,111,0.18)",
    borderColor: "rgba(255,210,111,0.45)",
  },
  dayCellMissed: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.06)",
  },
  dayCellUpcoming: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: "rgba(255,255,255,0.05)",
  },
  dayCellText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "800",
  },
  hiddenWeeksText: {
    marginTop: 16,
    color: "#8d8d96",
    fontSize: 12,
    lineHeight: 18,
  },
  configCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 18,
  },
  input: {
    marginTop: 12,
    marginBottom: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    color: C.white,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  bottomBackLink: {
    alignSelf: "center",
    paddingVertical: 12,
  },
  bottomBackText: {
    color: "#8d8d96",
    fontSize: 12,
    fontWeight: "700",
  },
  stateWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 10,
    textAlign: "center",
  },
  stateCopy: {
    color: "#9b9ba3",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 320,
  },
});
