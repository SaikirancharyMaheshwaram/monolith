import { CharacterAvatar } from "@/components/CharacterAvatar";
import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { C } from "@/components/lobby-theme";
import { SystemWindow } from "@/components/SystemWindow";
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
import { SafeAreaView } from "react-native-safe-area-context";

type DuelProgress = {
  player1: Id<"users">;
  player2?: Id<"users">;
  p1Days: number[];
  p2Days: number[];
};

type DayState = "done" | "missed" | "today" | "upcoming";
type DuelPhase = "unknown" | "upcoming" | "live" | "ended";
type FeedbackState = {
  visible: boolean;
  tone: "success" | "error";
  title: string;
  message: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 30 * 1000;
const EMPTY_FEEDBACK: FeedbackState = {
  visible: false,
  tone: "success",
  title: "",
  message: "",
};
const MASCOT_TAUNTS: Record<string, string> = {
  lion: "ROAR",
  tiger: "CLAW",
  wolf: "HOWL",
  fox: "DASH",
  dragon: "BLAZE",
  phoenix: "RISE",
  snake: "HISS",
  hawk: "SWOOP",
  bear: "CRUSH",
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

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

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
  const selectedDuel = useQuery(
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
    selectedDuel &&
    user &&
    (selectedDuel.player1 === user._id || selectedDuel.player2 === user._id)
  );
  const meIsPlayerOne = !!(
    selectedDuel &&
    user &&
    selectedDuel.player1 === user._id
  );

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

  const totalDays = getTotalDays(selectedDuel);
  const currentDay = getCurrentDay(selectedDuel, now, totalDays);
  const duelPhase = getDuelPhase(selectedDuel, now);
  const timelineDays = buildRelevantDays(totalDays, currentDay);
  const title = getDuelTitle(selectedDuel);
  const description = getDuelDescription(selectedDuel);
  const myLabel = getSideLabel(
    selectedDuel,
    viewerIsParticipant,
    meIsPlayerOne,
    "self",
  );
  const rivalLabel = getSideLabel(
    selectedDuel,
    viewerIsParticipant,
    meIsPlayerOne,
    "rival",
  );
  const myCharacter = getSideCharacter(
    selectedDuel,
    viewerIsParticipant,
    meIsPlayerOne,
    "self",
  );
  const rivalCharacter = getSideCharacter(
    selectedDuel,
    viewerIsParticipant,
    meIsPlayerOne,
    "rival",
  );
  const myTodayState = getDayState(currentDay, myDays, currentDay, duelPhase);
  const mySubmittedToday = myTodayState === "done";
  const winnerLabel = getWinnerLabel(selectedDuel);
  const rivalWallet = getSideWallet(
    selectedDuel,
    viewerIsParticipant,
    meIsPlayerOne,
    "rival",
  );
  const startText = formatDateTime(selectedDuel?.startTime);
  const endText = formatDateTime(selectedDuel?.endTime);
  const duelStatusLabel = getStatusLabel(selectedDuel?.status, duelPhase);
  const duelTaunt =
    MASCOT_TAUNTS[(myCharacter ?? "default").toLowerCase()] ?? "LOCK IN";
  const rivalTaunt =
    MASCOT_TAUNTS[(rivalCharacter ?? "default").toLowerCase()] ?? "BRING IT";

  const canCheckIn =
    !!duelId &&
    !!user &&
    viewerIsParticipant &&
    selectedDuel?.status === "ACTIVE" &&
    duelPhase === "live" &&
    !mySubmittedToday;
  const canSettle =
    !!duelId &&
    !!selectedDuel &&
    viewerIsParticipant &&
    selectedDuel.status === "ACTIVE" &&
    duelPhase === "ended" &&
    !!selectedDuel.onchainDuelAddress &&
    !selectedDuel.resolved;

  const handleCheckIn = async () => {
    if (!duelId || !user) {
      openFeedback(
        "error",
        "Check-in blocked",
        "Connect the wallet that joined this duel to submit a check-in.",
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
          ? `${result.message}. Day ${result.dayNumber} is already safe.`
          : `Day ${result.dayNumber} is protected. Keep the streak alive.`,
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
    if (!selectedDuel || !duelId || !walletAddress) {
      openFeedback(
        "error",
        "Settle failed",
        "Connect a participant wallet before settling this duel.",
      );
      return;
    }

    if (!selectedDuel.onchainDuelAddress) {
      openFeedback(
        "error",
        "Missing on-chain duel",
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
        selectedDuel.onchainDuelAddress,
      );
      const prepared = await prepareSettlement({
        duelId,
        callerWallet: walletAddress,
        onchainDuelId: context.duelId,
        settlementNonce: context.settlementNonce,
      });

      onChainSettlement = await wallet.settleDuel({
        duelAddress: selectedDuel.onchainDuelAddress,
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
          ? `${shortenWallet(prepared.winnerWallet)} takes the win.`
          : formatOutcome(prepared.outcome),
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Settlement failed",
        onChainSettlement
          ? `On-chain settlement succeeded but backend finalization failed. Tx: ${onChainSettlement.signature}`
          : (error?.message ?? "Could not settle duel."),
      );
    } finally {
      setSettleLoading(false);
    }
  };

  const handleInitializeConfig = async () => {
    if (!programConfig) {
      openFeedback(
        "error",
        "Config unavailable",
        "Backend signer config is still loading.",
      );
      return;
    }

    const trimmedTreasury = treasuryAddress.trim();
    if (!trimmedTreasury) {
      openFeedback(
        "error",
        "Treasury required",
        "Enter a treasury wallet address before initializing.",
      );
      return;
    }

    setConfigLoading(true);
    try {
      const result = await wallet.initializeProgramConfig({
        backendPubkey: programConfig.backendPubkey,
        treasuryAddress: trimmedTreasury,
        feeBps: programConfig.feeBps,
      });
      openFeedback(
        "success",
        "Program ready",
        `Config PDA created at ${shortenWallet(result.configAddress)}.`,
      );
    } catch (error: any) {
      openFeedback(
        "error",
        "Initialize failed",
        error?.message ?? "Could not initialize on-chain config.",
      );
    } finally {
      setConfigLoading(false);
    }
  };

  if (!duelId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Malformed duel link</Text>
          <Text style={styles.stateCopy}>
            This duel id is invalid. Open the detail screen again from the duel
            board.
          </Text>
          <Link href="/(tabs)/duel" asChild>
            <TouchableOpacity style={styles.backPill}>
              <Text style={styles.backPillText}>Back To Duels</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  if (selectedDuel === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Loading duel</Text>
          <Text style={styles.stateCopy}>
            Pulling the arena board, streaks, and payout status.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!selectedDuel) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.stateWrap}>
          <Text style={styles.stateTitle}>Duel missing</Text>
          <Text style={styles.stateCopy}>
            This duel no longer exists or the link is stale.
          </Text>
          <Link href="/(tabs)/duel" asChild>
            <TouchableOpacity style={styles.backPill}>
              <Text style={styles.backPillText}>Back To Duels</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.bgGlowLarge} />
      <View style={styles.bgGlowSmall} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <TouchableOpacity
            style={styles.backPill}
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
                return;
              }
              router.replace("/(tabs)/duel");
            }}
          >
            <Text style={styles.backPillText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeText}>{duelStatusLabel}</Text>
          </View>
        </View>

        <SystemWindow style={styles.heroCard}>
          <View style={styles.heroHeadingRow}>
            <View style={styles.heroTextBlock}>
              <Text style={styles.heroEyebrow}>Duel Arena</Text>
              <Text style={styles.heroTitle}>{title}</Text>
              <Text style={styles.heroCopy}>{description}</Text>
            </View>
            <View style={styles.potBadge}>
              <Text style={styles.potLabel}>Pot</Text>
              <Text style={styles.potValue}>
                {selectedDuel.stakeAmount} SOL
              </Text>
            </View>
          </View>

          <View style={styles.duelistRow}>
            <MascotCard
              sideLabel={viewerIsParticipant ? "You" : "Challenger"}
              name={myLabel}
              taunt={duelTaunt}
              characterId={myCharacter}
              score={myDays.length}
              totalDays={totalDays}
              accent="mana"
            />
            <View style={styles.versusWrap}>
              <View style={styles.versusRing}>
                <Text style={styles.versusText}>VS</Text>
              </View>
              <Text style={styles.versusSub}>
                {duelPhase === "upcoming"
                  ? "Warm up"
                  : duelPhase === "ended"
                    ? "Final whistle"
                    : `Day ${currentDay}`}
              </Text>
            </View>
            <MascotCard
              sideLabel={selectedDuel.player2 ? "Rival" : "Open Slot"}
              name={selectedDuel.player2 ? rivalLabel : "Awaiting rival"}
              taunt={rivalTaunt}
              characterId={rivalCharacter}
              score={rivalDays.length}
              totalDays={totalDays}
              accent="green"
            />
          </View>

          <View style={styles.heroStats}>
            <StatPill label="Starts" value={startText} />
            <StatPill label="Ends" value={endText} />
            <StatPill
              label="Winner"
              value={
                winnerLabel ??
                (duelPhase === "ended" ? "Ready to settle" : "Pending")
              }
            />
            <StatPill
              label="Rival Wallet"
              value={rivalWallet ? shortenWallet(rivalWallet) : "Not joined"}
            />
          </View>
        </SystemWindow>

        <SystemWindow style={styles.boardCard}>
          <View style={styles.boardHeader}>
            <View>
              <Text style={styles.boardTitle}>Streak Path</Text>
              <Text style={styles.boardCopy}>
                Duolingo-style tiles, but built for head-to-head grind. Orange
                is your lane, green is your rival.
              </Text>
            </View>
            <View style={styles.dayCounter}>
              <Text style={styles.dayCounterLabel}>Current</Text>
              <Text style={styles.dayCounterValue}>
                {duelPhase === "upcoming" ? "Soon" : `Day ${currentDay}`}
              </Text>
            </View>
          </View>

          <View style={styles.laneHeader}>
            <View style={styles.laneLabelBlock}>
              <View style={[styles.laneDot, styles.myDot]} />
              <Text style={styles.laneLabel}>
                {viewerIsParticipant ? "You" : "Player 1"}
              </Text>
            </View>
            <View style={styles.laneLabelBlock}>
              <View style={[styles.laneDot, styles.rivalDot]} />
              <Text style={styles.laneLabel}>
                {selectedDuel.player2 ? "Rival" : "Slot"}
              </Text>
            </View>
          </View>

          <View style={styles.pathBoard}>
            {timelineDays.map((day, index) => (
              <View
                key={day}
                style={[
                  styles.pathRow,
                  index % 2 === 1 && styles.pathRowOffset,
                ]}
              >
                <TileColumn
                  day={day}
                  accent="mana"
                  state={getDayState(day, myDays, currentDay, duelPhase)}
                />
                <View style={styles.pathConnector}>
                  <View style={styles.pathConnectorLine} />
                  <Text style={styles.pathDayText}>DAY {day}</Text>
                </View>
                <TileColumn
                  day={day}
                  accent="green"
                  state={getDayState(day, rivalDays, currentDay, duelPhase)}
                />
              </View>
            ))}
          </View>

          <View style={styles.tileLegend}>
            <LegendChip label="Done" state="done" />
            <LegendChip label="Today" state="today" />
            <LegendChip label="Missed" state="missed" />
            <LegendChip label="Queued" state="upcoming" />
          </View>
        </SystemWindow>

        <SystemWindow style={styles.actionDeck}>
          <Text style={styles.boardTitle}>Action Center</Text>
          <Text style={styles.boardCopy}>
            {getActionCopy(selectedDuel.status, duelPhase, mySubmittedToday)}
          </Text>

          <View style={styles.actionGrid}>
            <View style={styles.actionModule}>
              <Text style={styles.actionModuleTitle}>Check-In</Text>
              <Text style={styles.actionModuleBody}>
                {mySubmittedToday
                  ? "You already cleared today."
                  : duelPhase === "upcoming"
                    ? `Opens ${formatRelativeTime(selectedDuel.startTime, now)}.`
                    : duelPhase === "ended"
                      ? "The play window is closed."
                      : "Submit today before the window rolls over."}
              </Text>
              <GateButton
                label={
                  submitLoading
                    ? "Submitting..."
                    : mySubmittedToday
                      ? "Checked In"
                      : "Lock Today"
                }
                onPress={handleCheckIn}
                disabled={!canCheckIn || submitLoading}
              />
            </View>

            <View style={styles.actionModule}>
              <Text style={styles.actionModuleTitle}>Settlement</Text>
              <Text style={styles.actionModuleBody}>
                {selectedDuel.resolved
                  ? "Payout state is already finalized."
                  : duelPhase === "ended"
                    ? "The duel can now be settled on-chain."
                    : `Unlocks ${formatRelativeTime(selectedDuel.endTime, now)}.`}
              </Text>
              <GateButton
                label={
                  settleLoading
                    ? "Settling..."
                    : selectedDuel.resolved
                      ? "Settled"
                      : "Finalize Duel"
                }
                onPress={handleSettle}
                disabled={!canSettle || settleLoading}
              />
            </View>
          </View>
        </SystemWindow>
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

function MascotCard({
  sideLabel,
  name,
  taunt,
  characterId,
  score,
  totalDays,
  accent,
}: {
  sideLabel: string;
  name: string;
  taunt: string;
  characterId?: string | null;
  score: number;
  totalDays: number;
  accent: "mana" | "green";
}) {
  const tone = accent === "mana" ? styles.mascotCardMe : styles.mascotCardRival;
  const badgeTone =
    accent === "mana" ? styles.mascotSpeechMe : styles.mascotSpeechRival;

  return (
    <View style={[styles.mascotCard, tone]}>
      <Text style={styles.mascotSideLabel}>{sideLabel}</Text>
      <View style={styles.mascotAvatarWrap}>
        <CharacterAvatar characterId={characterId} label={name} size={72} />
        <View style={[styles.mascotSpeech, badgeTone]}>
          <Text style={styles.mascotSpeechText}>{taunt}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={styles.mascotName}>
        {name}
      </Text>
      <View style={styles.fireScore}>
        <Text style={styles.fireIcon}>🔥</Text>
        <Text style={styles.fireScoreText}>
          {score}/{totalDays}
        </Text>
      </View>
    </View>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statPill}>
      <Text style={styles.statPillLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.statPillValue}>
        {value}
      </Text>
    </View>
  );
}

function TileColumn({
  day,
  accent,
  state,
}: {
  day: number;
  accent: "mana" | "green";
  state: DayState;
}) {
  const isOrange = accent === "mana";
  return (
    <View style={styles.tileColumn}>
      <View
        style={[
          styles.streakTile,
          isOrange ? tileTone.orangeBase : tileTone.greenBase,
          state === "done" &&
            (isOrange ? tileTone.orangeDone : tileTone.greenDone),
          state === "today" &&
            (isOrange ? tileTone.orangeToday : tileTone.greenToday),
          state === "missed" && tileTone.missed,
          state === "upcoming" && tileTone.upcoming,
        ]}
      >
        <Text style={styles.streakTileEmoji}>
          {state === "done"
            ? "✓"
            : state === "today"
              ? "!"
              : state === "missed"
                ? "×"
                : "•"}
        </Text>
      </View>
      <Text style={styles.tileDayMini}>{day}</Text>
    </View>
  );
}

function LegendChip({ label, state }: { label: string; state: DayState }) {
  return (
    <View style={styles.legendChip}>
      <View style={[styles.legendSwatch, legendMap[state]]} />
      <Text style={styles.legendText}>{label}</Text>
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

function buildRelevantDays(totalDays: number, currentDay: number) {
  if (totalDays <= 12) {
    return Array.from({ length: totalDays }, (_, index) => index + 1);
  }
  const start = Math.max(1, currentDay - 3);
  const end = Math.min(totalDays, start + 9);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
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
  if (status === "OPEN") return "Open";
  return "Live";
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

  let parts = "";
  if (days > 0) {
    parts = `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    parts = `${hours}h ${minutes}m`;
  } else {
    parts = `${Math.max(1, minutes)}m`;
  }

  return diffMs >= 0 ? `in ${parts}` : `${parts} ago`;
}

function getActionCopy(
  status: string,
  phase: DuelPhase,
  mySubmittedToday: boolean,
) {
  if (status === "RESOLVED" || status === "COMPLETED") {
    return "The duel result is already locked. Review the board and payout state.";
  }
  if (phase === "upcoming") {
    return "The arena is scheduled. Day one opens at the listed start time.";
  }
  if (phase === "ended") {
    return "The grind is over. Settle the duel to finalize the payout.";
  }
  if (mySubmittedToday) {
    return "Today is already secured. Return after the next rollover.";
  }
  return "The duel is live. Lock your daily progress before the window expires.";
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
      return "Draw. Neither player cleared enough days.";
    default:
      return outcome;
  }
}

const tileTone = StyleSheet.create({
  orangeBase: {
    backgroundColor: "rgba(255,107,53,0.12)",
    borderColor: "rgba(255,107,53,0.24)",
  },
  orangeDone: {
    backgroundColor: C.mana,
    borderColor: "#ff936b",
  },
  orangeToday: {
    backgroundColor: "rgba(255,107,53,0.28)",
    borderColor: "#ff936b",
  },
  greenBase: {
    backgroundColor: "rgba(0,245,160,0.12)",
    borderColor: "rgba(0,245,160,0.22)",
  },
  greenDone: {
    backgroundColor: C.green,
    borderColor: "#5dffd0",
  },
  greenToday: {
    backgroundColor: "rgba(0,245,160,0.22)",
    borderColor: "#5dffd0",
  },
  missed: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: "rgba(255,255,255,0.08)",
  },
  upcoming: {
    backgroundColor: "rgba(255,255,255,0.02)",
    borderColor: C.glassBorder,
  },
});

const legendMap = StyleSheet.create({
  done: {
    backgroundColor: C.mana,
  },
  missed: {
    backgroundColor: C.slate700,
  },
  today: {
    backgroundColor: C.purple,
  },
  upcoming: {
    backgroundColor: C.cardAlt,
  },
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  bgGlowLarge: {
    position: "absolute",
    top: 70,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.12)",
  },
  bgGlowSmall: {
    position: "absolute",
    top: 220,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(0,245,160,0.08)",
  },
  scroll: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  backPillText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  heroBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: C.manaDim,
    borderWidth: 1,
    borderColor: C.manaBorder,
  },
  heroBadgeText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  heroCard: {
    padding: 18,
    backgroundColor: "rgba(18,18,26,0.95)",
  },
  heroHeadingRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 18,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroEyebrow: {
    color: C.mana,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    color: C.white,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: "800",
    marginBottom: 8,
  },
  heroCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
  },
  potBadge: {
    minWidth: 92,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(255,107,53,0.08)",
    borderWidth: 1,
    borderColor: C.manaBorder,
    alignItems: "flex-end",
  },
  potLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  potValue: {
    color: C.white,
    fontSize: 16,
    fontWeight: "800",
  },
  duelistRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 18,
  },
  mascotCard: {
    flex: 1,
    borderRadius: 22,
    padding: 14,
    borderWidth: 1,
    minHeight: 176,
  },
  mascotCardMe: {
    backgroundColor: "rgba(255,107,53,0.08)",
    borderColor: C.manaBorder,
  },
  mascotCardRival: {
    backgroundColor: "rgba(0,245,160,0.08)",
    borderColor: "rgba(0,245,160,0.24)",
  },
  mascotSideLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  mascotAvatarWrap: {
    alignSelf: "center",
    marginBottom: 10,
  },
  mascotSpeech: {
    position: "absolute",
    top: -8,
    right: -22,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderWidth: 1,
  },
  mascotSpeechMe: {
    backgroundColor: "rgba(255,107,53,0.18)",
    borderColor: C.manaBorder,
  },
  mascotSpeechRival: {
    backgroundColor: "rgba(0,245,160,0.18)",
    borderColor: "rgba(0,245,160,0.24)",
  },
  mascotSpeechText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  mascotName: {
    color: C.white,
    textAlign: "center",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  fireScore: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  fireIcon: {
    fontSize: 14,
  },
  fireScoreText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1.2,
  },
  versusWrap: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  versusRing: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  versusText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 12,
    letterSpacing: 1.4,
  },
  versusSub: {
    color: C.slate500,
    fontSize: 11,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statPill: {
    width: "48%",
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  statPillLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  statPillValue: {
    color: C.white,
    fontSize: 12,
    lineHeight: 18,
  },
  boardCard: {
    padding: 18,
  },
  boardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  boardTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
  },
  boardCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
  },
  dayCounter: {
    minWidth: 82,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.glassBorder,
    alignItems: "center",
  },
  dayCounterLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 9,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  dayCounterValue: {
    color: C.white,
    fontSize: 14,
    fontWeight: "800",
  },
  laneHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  laneLabelBlock: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "44%",
  },
  laneDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  myDot: {
    backgroundColor: C.mana,
  },
  rivalDot: {
    backgroundColor: C.green,
  },
  laneLabel: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pathBoard: {
    gap: 10,
  },
  pathRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  pathRowOffset: {
    paddingLeft: 22,
  },
  tileColumn: {
    width: 62,
    alignItems: "center",
    gap: 6,
  },
  streakTile: {
    width: 52,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.coal,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  streakTileEmoji: {
    color: C.white,
    fontSize: 18,
    fontWeight: "800",
  },
  tileDayMini: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
  },
  pathConnector: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  pathConnectorLine: {
    width: "88%",
    height: 2,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 8,
  },
  pathDayText: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
  },
  tileLegend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 18,
  },
  legendChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  legendText: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  actionDeck: {
    padding: 18,
  },
  actionGrid: {
    gap: 12,
    marginTop: 14,
  },
  actionModule: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.glassBorder,
    gap: 12,
  },
  actionModuleTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "800",
  },
  actionModuleBody: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  configCard: {
    padding: 18,
  },
  input: {
    marginTop: 12,
    marginBottom: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: C.cardAlt,
    color: C.white,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  configMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 14,
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
    color: C.slate400,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 18,
  },
});
