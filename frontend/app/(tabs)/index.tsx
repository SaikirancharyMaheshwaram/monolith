import { CharacterAvatar } from "@/components/CharacterAvatar";
import { ConnectButton } from "@/components/ConnectButton";
import { GateButton } from "@/components/GateButton";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestCard } from "@/components/QuestCard";
import { StatBlock } from "@/components/StatBlock";
import { SystemWindow } from "@/components/SystemWindow";
import { CHARACTER_OPTIONS, CharacterId } from "@/components/characters";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { getDuelDescription, getDuelTitle } from "@/lib/duel-copy";
import {
  DuelWithParticipants,
  getParticipantLabel,
  toDuelId,
} from "@/lib/duel-view";
import { useWallet } from "@/lib/use-wallet";
import { useArenaStore } from "@/stores/arenaStore";
import { useDuelStore } from "@/stores/duelStore";
import { useUserStore } from "@/stores/userStore";
import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STAKES = [0.1, 0.5, 1, 2];
const START_DELAY_OPTIONS = [10, 30, 60];
const STORY_STEPS = [
  { title: "Create", detail: "1 SOL moves into escrow and the duel waits for an opponent." },
  { title: "Join", detail: "Escrow reaches 2 SOL and the backend flips the duel to active." },
  { title: "Check-in", detail: "Daily proof stays off-chain so streak tracking feels instant." },
  { title: "Settle", detail: "When the backend resolves the winner, the contract pays the final split." },
];
const LIVE_FEED = [
  "Escrow creates real pressure because the stake is already locked.",
  "Every duel now carries a title and a mission so the board feels readable.",
  "Daily proof stays fast off-chain and only final payout touches the contract.",
];
const MISSION_BOARD = [
  { title: "Name the duel", status: "READY" },
  { title: "Keep daily proof", status: "TRACKED" },
  { title: "Settle the winner", status: "LOCKED" },
];

export default function HomeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ duelId?: string }>();
  const wallet = useWallet();

  const user = useUserStore((s) => s.user);
  const username = useUserStore((s) => s.username);
  const tier = useUserStore((s) => s.tier);
  const xp = useUserStore((s) => s.xp);
  const vaultBalance = useUserStore((s) => s.vaultBalance);
  const userLoading = useUserStore((s) => s.loading);
  const fetchUser = useUserStore((s) => s.fetchUser);
  const createUser = useUserStore((s) => s.createUser);

  const activeDuels = useDuelStore((s) => s.activeDuels);
  const duelMap = useDuelStore((s) => s.duelMap);
  const fetchActiveDuels = useDuelStore((s) => s.fetchActiveDuels);

  const openDuels = useArenaStore((s) => s.openDuels);
  const createLoading = useArenaStore((s) => s.createLoading);
  const joinLoading = useArenaStore((s) => s.joinLoading);
  const fetchOpenDuels = useArenaStore((s) => s.fetchOpenDuels);
  const createDuel = useArenaStore((s) => s.createDuel);
  const joinDuel = useArenaStore((s) => s.joinDuel);

  const [showRegistration, setShowRegistration] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [selectedCharacter, setSelectedCharacter] =
    useState<CharacterId>("samurai");

  const [showArenaModal, setShowArenaModal] = useState(false);
  const [stake, setStake] = useState(STAKES[2]);
  const [startDelayMins, setStartDelayMins] = useState(START_DELAY_OPTIONS[0]);
  const [duelTitle, setDuelTitle] = useState("");
  const [duelDescription, setDuelDescription] = useState("");
  const [arenaMessage, setArenaMessage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  const inviteDuelId = toDuelId(params.duelId);
  const inviteDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    inviteDuelId ? { id: inviteDuelId } : "skip",
  ) as DuelWithParticipants | null | undefined;
  const [showInviteModal, setShowInviteModal] = useState(Boolean(inviteDuelId));

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const activeDuel = activeDuels[0] ?? null;
  const activeDuelView = activeDuel as DuelWithParticipants | null;
  const openDuelViews = openDuels as DuelWithParticipants[];
  const invalidInviteLink =
    typeof params.duelId === "string" && !toDuelId(params.duelId);
  const activeDuelEntry = activeDuel ? duelMap[activeDuel._id] : undefined;
  const duelProgressDays = useMemo(() => {
    if (!activeDuel || !activeDuelEntry?.progress || !user) return 0;
    const progress = activeDuelEntry.progress;
    const mine = progress.player1 === user._id ? progress.p1Days : progress.p2Days;
    return new Set(mine).size;
  }, [activeDuel, activeDuelEntry, user]);

  useEffect(() => {
    if (!wallet.connected || !walletAddress) {
      setShowRegistration(false);
      return;
    }

    let isMounted = true;

    const boot = async () => {
      const fetchedUser = await fetchUser(walletAddress);
      if (!isMounted) return;

      if (!fetchedUser) {
        setShowRegistration(true);
        return;
      }

      setShowRegistration(false);
      await Promise.all([
        fetchActiveDuels(fetchedUser._id),
        fetchOpenDuels(fetchedUser._id),
      ]);
    };

    void boot();

    return () => {
      isMounted = false;
    };
  }, [wallet.connected, walletAddress, fetchActiveDuels, fetchOpenDuels, fetchUser]);

  useEffect(() => {
    setShowInviteModal(Boolean(inviteDuelId));
  }, [inviteDuelId]);

  useEffect(() => {
    if (!scanning) return;

    setScanProgress(0.1);
    const timer = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 1) {
          clearInterval(timer);
          return 1;
        }
        return Math.min(1, p + 0.1);
      });
    }, 220);

    return () => clearInterval(timer);
  }, [scanning]);

  const isWalletDisconnected = !wallet.connected;
  const isNewPlayer = wallet.connected && !userLoading && !user;
  const hasActiveDuel = wallet.connected && !!user && !!activeDuel;
  const isIdleHunter = wallet.connected && !!user && !activeDuel;
  const levelLabel = user ? String(Math.floor(xp / 100) + 1).padStart(2, "0") : "00";

  const handleRegister = async () => {
    if (!walletAddress || usernameInput.trim().length < 3) return;

    await createUser({
      walletAddress,
      username: usernameInput.trim(),
      selectedCharacter,
    });

    const fresh = await fetchUser(walletAddress);
    if (!fresh) return;

    await Promise.all([fetchActiveDuels(fresh._id), fetchOpenDuels(fresh._id)]);
    setShowRegistration(false);
  };

  const handleCreateChallenge = async () => {
    if (!walletAddress || !user) return;

    setArenaMessage(null);

    const startTime = Date.now() + startDelayMins * 60 * 1000;
    await createDuel({
      player1: walletAddress,
      stakeAmount: stake,
      startTime,
      title:
        duelTitle.trim() ||
        `Discipline Run • ${stake} SOL`,
      description:
        duelDescription.trim() ||
        "A focused streak challenge with real escrow and daily proof.",
    });

    await fetchOpenDuels(user._id);
    setDuelTitle("");
    setDuelDescription("");
    setArenaMessage("Challenge forged. Open the duel board to share the invite.");
  };

  const handleJoinPublic = async () => {
    if (!user) return;

    const candidate = openDuels.find((duel) => duel.player1 !== user._id);
    if (!candidate) {
      setScanning(true);
      setArenaMessage("Scanning for a live rival...");
      setTimeout(() => {
        setScanning(false);
        setArenaMessage("No live rival found yet. Try again in a bit.");
      }, 2500);
      return;
    }

    await joinDuel(candidate._id, user._id);
    await fetchActiveDuels(user._id);
    setShowArenaModal(false);
    router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(candidate._id))}` as any);
  };

  const handleJoinInvite = async () => {
    if (!user || !inviteDuel) return;
    await joinDuel(inviteDuel._id, user._id);
    await fetchActiveDuels(user._id);
    setShowInviteModal(false);
    router.push(`/(tabs)/battle?duelId=${encodeURIComponent(String(inviteDuel._id))}` as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlowLarge} />
          <View style={styles.heroGlowSmall} />

          <View style={styles.rowBetween}>
            <View style={styles.heroHeaderCopy}>
              <Text style={styles.sectionLabel}>Orange Arena</Text>
              <Text style={styles.heroTitle}>Stake up. Check in daily. Win the duel.</Text>
              <Text style={styles.heroSubtitle}>
                Built for simple friend challenges where the money is on-chain, the streak loop is off-chain, and the settlement moment feels earned.
              </Text>
            </View>
            <View style={styles.heroLevelBadge}>
              <Text style={styles.heroLevelValue}>LV {levelLabel}</Text>
              <Text style={styles.heroLevelLabel}>hunter tier</Text>
            </View>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.walletLabel}>Wallet status</Text>
            <ConnectButton
              connected={wallet.connected}
              connecting={wallet.connecting}
              publicKey={wallet.publicKey?.toBase58() ?? null}
              onConnect={wallet.connect}
              onDisconnect={wallet.disconnect}
            />
          </View>

          {isWalletDisconnected ? (
            <Text style={styles.systemOffline}>Connect wallet to unlock duels, streak tracking, and settlement.</Text>
          ) : (
            <View style={styles.statsGrid}>
              <StatBlock
                label="Player Rank"
                value={tier || "ROOKIE"}
                unit={username ? `@${username}` : "pending"}
                valueColor={C.success}
              />
              <StatBlock
                label="Vault Balance"
                value={vaultBalance.toFixed(2)}
                unit="SOL"
                valueColor={C.purple}
              />
            </View>
          )}
        </SystemWindow>

        {invalidInviteLink ? (
          <SystemWindow style={styles.quickActionWindow}>
            <Text style={styles.sectionLabel}>Invite Link</Text>
            <Text style={styles.feedText}>
              The duel link is invalid. Open the full shared URL again or paste the exact duel id in the duel board.
            </Text>
          </SystemWindow>
        ) : null}

        {isIdleHunter && (
          <TouchableOpacity
            style={styles.idleQuestBox}
            activeOpacity={0.88}
            onPress={() => setShowArenaModal(true)}
          >
            <Text style={styles.idleQuestBadge}>Arena Ready</Text>
            <Text style={styles.idleQuestTitle}>No active duel yet.</Text>
            <Text style={styles.idleQuestSub}>
              Create a duel or auto-match into a public gate and start your streak.
            </Text>
          </TouchableOpacity>
        )}

        {hasActiveDuel && activeDuel && (
          <QuestCard
            title={getDuelTitle(activeDuel as any)}
            opponentName={getParticipantLabel(activeDuelView, "player2")}
            stakeLabel={`${activeDuel.stakeAmount} SOL`}
            progress={Math.min(1, duelProgressDays / 7)}
            isLive={activeDuel.status === "ACTIVE"}
            onEnter={() =>
              router.push(
                `/(tabs)/battle?duelId=${encodeURIComponent(String(activeDuel._id))}` as any,
              )
            }
          />
        )}

        {!isWalletDisconnected && !isNewPlayer && openDuelViews.length > 0 && (
          <SystemWindow style={styles.feedWindow}>
            <Text style={styles.sectionLabel}>Open Duel Board</Text>
            <View style={styles.duelPreviewList}>
              {openDuelViews.map((duel) => (
                <TouchableOpacity
                  key={duel._id}
                  style={styles.duelPreviewCard}
                  activeOpacity={0.9}
                  onPress={() =>
                    router.push(
                      `/(tabs)/battle?duelId=${encodeURIComponent(String(duel._id))}` as any,
                    )
                  }
                >
                  <View style={styles.duelPreviewHeader}>
                    <Text style={styles.duelPreviewTitle}>{getDuelTitle(duel)}</Text>
                    <Text style={styles.duelPreviewStatus}>{duel.status}</Text>
                  </View>
                  <Text style={styles.duelPreviewCopy}>{getDuelDescription(duel)}</Text>
                  <View style={styles.duelPreviewMetaRow}>
                    <Text style={styles.duelPreviewMeta}>{getParticipantLabel(duel, "player1")}</Text>
                    <Text style={styles.duelPreviewMeta}>{duel.stakeAmount} SOL</Text>
                  </View>
                  <View style={styles.duelPreviewMetaRow}>
                    <Text style={styles.duelPreviewMeta}>{getParticipantLabel(duel, "player2")}</Text>
                    <Text style={styles.duelPreviewMeta}>View battle detail</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </SystemWindow>
        )}

        {!isWalletDisconnected && !isNewPlayer && (
          <SystemWindow style={styles.flowWindow}>
            <Text style={styles.sectionLabel}>Duel Flow</Text>
            <View style={styles.storyList}>
              {STORY_STEPS.map((step, index) => (
                <View key={step.title} style={styles.storyRow}>
                  <View style={styles.storyIndex}>
                    <Text style={styles.storyIndexText}>{index + 1}</Text>
                  </View>
                  <View style={styles.storyBody}>
                    <Text style={styles.storyTitle}>{step.title}</Text>
                    <Text style={styles.storyDetail}>{step.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </SystemWindow>
        )}

        {!isWalletDisconnected && !isNewPlayer && (
          <SystemWindow style={styles.quickActionWindow}>
            <Text style={styles.sectionLabel}>Quick Actions</Text>
            <View style={styles.actionStack}>
              <GateButton label="Match Me Now" onPress={() => setShowArenaModal(true)} />
              <GateButton label="Open Duel Board" variant="ghost" onPress={() => router.push("/duel")} />
            </View>
          </SystemWindow>
        )}

        {!isWalletDisconnected && !isNewPlayer && (
          <SystemWindow style={styles.missionWindow}>
            <Text style={styles.sectionLabel}>Mission Track</Text>
            <View style={styles.missionList}>
              {MISSION_BOARD.map((item) => (
                <View key={item.title} style={styles.missionRow}>
                  <View style={styles.statusDot} />
                  <Text style={styles.missionTitle}>{item.title}</Text>
                  <Text style={styles.missionStatus}>{item.status}</Text>
                </View>
              ))}
            </View>
          </SystemWindow>
        )}

        {!isWalletDisconnected && (
          <SystemWindow style={styles.feedWindow}>
            <Text style={styles.sectionLabel}>Live Feed</Text>
            <View style={styles.feedList}>
              {LIVE_FEED.map((line) => (
                <Text key={line} style={styles.feedText}>
                  • {line}
                </Text>
              ))}
            </View>
          </SystemWindow>
        )}
      </ScrollView>

      <Modal transparent visible={showRegistration && isNewPlayer} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Register Hunter</Text>
            <Text style={styles.modalLabel}>Choose username</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder="hunter-name"
              placeholderTextColor={C.slate600}
              value={usernameInput}
              onChangeText={setUsernameInput}
            />

            <Text style={styles.modalLabel}>Select avatar</Text>
            <View style={styles.characterGrid}>
              {CHARACTER_OPTIONS.map((ch) => {
                const selected = selectedCharacter === ch.id;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.characterCard, selected && styles.characterCardSelected]}
                    onPress={() => setSelectedCharacter(ch.id)}
                  >
                    <CharacterAvatar characterId={ch.id} label={ch.name} size={72} />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {ch.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <GateButton
              label={userLoading ? "Registering..." : "Enter Arena"}
              onPress={handleRegister}
              disabled={userLoading || usernameInput.trim().length < 3}
            />
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showArenaModal && !!user} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forge a Duel</Text>
            <Text style={styles.modalLabel}>Duel title</Text>
            <TextInput
              style={styles.input}
              placeholder="Example: 7-Day Study Sprint"
              placeholderTextColor={C.slate600}
              value={duelTitle}
              onChangeText={setDuelTitle}
            />

            <Text style={styles.modalLabel}>Duel description</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Explain the habit, rules, or why this duel matters"
              placeholderTextColor={C.slate600}
              value={duelDescription}
              onChangeText={setDuelDescription}
              multiline
            />
            <Text style={styles.modalLabel}>Pick stake</Text>
            <View style={styles.chipRow}>
              {STAKES.map((s) => {
                const selected = stake === s;
                return (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setStake(s)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{s} SOL</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Start countdown</Text>
            <View style={styles.chipRow}>
              {START_DELAY_OPTIONS.map((mins) => {
                const selected = startDelayMins === mins;
                return (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => setStartDelayMins(mins)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{mins}m</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.energyStrip}>
              <Text style={styles.energyTitle}>Game loop</Text>
              <Text style={styles.energyText}>Name the mission, create escrow, keep daily proof, settle when resolved.</Text>
            </View>

            {scanning ? (
              <View style={styles.scanBlock}>
                <Text style={styles.scanText}>Searching for a rival...</Text>
                <ProgressBar progress={scanProgress} animated={false} />
              </View>
            ) : null}

            {arenaMessage ? <Text style={styles.arenaMessage}>{arenaMessage}</Text> : null}

            <View style={styles.actionStack}>
              <GateButton
                label={createLoading ? "Forging..." : "Create Challenge"}
                onPress={handleCreateChallenge}
                disabled={createLoading || joinLoading}
              />
              <GateButton
                label={joinLoading ? "Joining..." : "Join Public Duel"}
                variant="ghost"
                onPress={handleJoinPublic}
                disabled={createLoading || joinLoading}
              />
              <GateButton label="Close" variant="ghost" onPress={() => setShowArenaModal(false)} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showInviteModal && !!inviteDuel && !!user} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite Found</Text>
            <Text style={styles.modalLabel}>{getDuelTitle(inviteDuel)}</Text>
            <Text style={styles.modalLabel}>{getDuelDescription(inviteDuel)}</Text>
            <Text style={styles.modalLabel}>Opponent: {getParticipantLabel(inviteDuel, "player1")}</Text>
            <Text style={styles.modalLabel}>Stake: {inviteDuel?.stakeAmount ?? 0} SOL</Text>
            <Text style={styles.modalLabel}>
              Starts: {inviteDuel?.startTime ? new Date(inviteDuel.startTime).toLocaleString() : "TBD"}
            </Text>

            <View style={styles.actionStack}>
              <GateButton label="Join Gate" onPress={handleJoinInvite} disabled={joinLoading} />
              <GateButton label="Dismiss" variant="ghost" onPress={() => setShowInviteModal(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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
    paddingBottom: 42,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 14,
  },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: "rgba(42,20,8,0.97)",
  },
  heroGlowLarge: {
    position: "absolute",
    right: -40,
    top: -28,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,31,0.16)",
  },
  heroGlowSmall: {
    position: "absolute",
    left: -18,
    bottom: -30,
    width: 120,
    height: 120,
    borderRadius: 999,
    backgroundColor: "rgba(255,179,71,0.1)",
  },
  heroHeaderCopy: {
    flex: 1,
    gap: 6,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  heroTitle: {
    color: C.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  heroSubtitle: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    maxWidth: 520,
  },
  heroLevelBadge: {
    minWidth: 92,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  heroLevelValue: {
    color: C.white,
    fontSize: 20,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  heroLevelLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    marginTop: 3,
  },
  walletLabel: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 12,
    marginTop: 18,
  },
  statsGrid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 12,
  },
  systemOffline: {
    marginTop: 16,
    color: C.slate500,
    fontSize: 13,
    lineHeight: 20,
  },
  idleQuestBox: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    borderRadius: 18,
    padding: 22,
    backgroundColor: "rgba(255,138,31,0.08)",
    gap: 8,
  },
  idleQuestBadge: {
    alignSelf: "flex-start",
    color: C.coal,
    backgroundColor: C.success,
    borderRadius: 999,
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
  },
  idleQuestTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: C.white,
  },
  idleQuestSub: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
  },
  flowWindow: {
    borderColor: C.glassBorder,
  },
  storyList: {
    gap: 10,
    marginTop: 12,
  },
  storyRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  storyIndex: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.emberSoft,
    borderWidth: 1,
    borderColor: C.manaBorder,
  },
  storyIndexText: {
    color: C.mana,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  storyBody: {
    flex: 1,
    gap: 4,
  },
  storyTitle: {
    color: C.white,
    fontSize: 15,
    fontWeight: "700",
  },
  storyDetail: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  quickActionWindow: {
    borderColor: "rgba(255,107,26,0.3)",
    backgroundColor: "rgba(255,107,26,0.08)",
  },
  actionStack: {
    gap: 10,
    marginTop: 12,
  },
  missionWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  missionList: {
    gap: 10,
    marginTop: 12,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statusDot: {
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: C.success,
  },
  missionTitle: {
    flex: 1,
    color: C.white,
    fontSize: 13,
  },
  missionStatus: {
    color: C.purple,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
  },
  feedWindow: {
    borderColor: "rgba(255,138,31,0.28)",
    backgroundColor: "rgba(255,138,31,0.06)",
  },
  feedList: {
    gap: 8,
    marginTop: 12,
  },
  feedText: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  duelPreviewList: {
    gap: 10,
    marginTop: 12,
  },
  duelPreviewCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 8,
  },
  duelPreviewHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  duelPreviewTitle: {
    flex: 1,
    color: C.white,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  duelPreviewStatus: {
    color: C.mana,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  duelPreviewCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  duelPreviewMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  duelPreviewMeta: {
    color: C.slate500,
    fontSize: 11,
    fontFamily: "monospace",
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
  input: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.white,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  textarea: {
    minHeight: 88,
    textAlignVertical: "top",
  },
  characterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  characterCard: {
    width: "31%",
    minWidth: 92,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 14,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  characterCardSelected: {
    borderColor: C.mana,
    backgroundColor: C.manaDim,
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
  energyStrip: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,179,71,0.08)",
    borderWidth: 1,
    borderColor: C.purpleBorder,
    gap: 4,
    marginVertical: 6,
  },
  energyTitle: {
    color: C.purple,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  energyText: {
    color: C.white,
    fontSize: 13,
    lineHeight: 19,
  },
  scanBlock: {
    gap: 8,
  },
  scanText: {
    color: C.mana,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  arenaMessage: {
    color: C.slate400,
    fontSize: 12,
    lineHeight: 18,
  },
});
