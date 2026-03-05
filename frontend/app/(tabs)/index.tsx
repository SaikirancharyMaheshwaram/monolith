import { ConnectButton } from "@/components/ConnectButton";
import { GateButton } from "@/components/GateButton";
import { ProgressBar } from "@/components/ProgressBar";
import { QuestCard } from "@/components/QuestCard";
import { StatBlock } from "@/components/StatBlock";
import { SystemWindow } from "@/components/SystemWindow";
import { CHARACTER_OPTIONS, CharacterId } from "@/components/characters";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useWallet } from "@/lib/use-wallet";
import { useArenaStore } from "@/stores/arenaStore";
import { useDuelStore } from "@/stores/duelStore";
import { useUserStore } from "@/stores/userStore";
import { useQuery } from "convex/react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Image,
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
const LOBBY_FEED = [
  "Hunter contract secured.",
  "Stake creates real accountability.",
  "Complete daily task or lose the gate.",
];
const MISSION_BOARD = [
  { title: "Daily Proof", status: "PENDING" },
  { title: "Gate Discipline", status: "LIVE" },
  { title: "Stake Safety", status: "SECURED" },
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
    useState<CharacterId>("warrior");

  const [showArenaModal, setShowArenaModal] = useState(false);
  const [stake, setStake] = useState(STAKES[2]);
  const [startDelayMins, setStartDelayMins] = useState(START_DELAY_OPTIONS[0]);
  const [arenaMessage, setArenaMessage] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanning, setScanning] = useState(false);

  const inviteDuelId =
    typeof params.duelId === "string" ? (params.duelId as Id<"duels">) : "";
  const inviteDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    inviteDuelId ? { id: inviteDuelId } : "skip",
  );
  const [showInviteModal, setShowInviteModal] = useState(Boolean(inviteDuelId));

  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  const activeDuel = activeDuels[0] ?? null;
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

    setScanProgress(0.08);
    const timer = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 1) {
          clearInterval(timer);
          return 1;
        }
        return Math.min(1, p + 0.08);
      });
    }, 220);

    return () => clearInterval(timer);
  }, [scanning]);

  const isWalletDisconnected = !wallet.connected;
  const isNewPlayer = wallet.connected && !userLoading && !user;
  const hasActiveDuel = wallet.connected && !!user && !!activeDuel;
  const isIdleHunter = wallet.connected && !!user && !activeDuel;

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
    });

    await fetchOpenDuels(user._id);
    setArenaMessage("Challenge created. Share invite link from Duel tab.");
  };

  const handleJoinPublic = async () => {
    if (!user) return;

    const candidate = openDuels.find((duel) => duel.player1 !== user._id);
    if (!candidate) {
      setScanning(true);
      setArenaMessage("Searching for opponent...");
      setTimeout(() => {
        setScanning(false);
        setArenaMessage("No open gate found yet. Try again shortly.");
      }, 2500);
      return;
    }

    await joinDuel(candidate._id, user._id);
    await fetchActiveDuels(user._id);
    setShowArenaModal(false);
  };

  const handleJoinInvite = async () => {
    if (!user || !inviteDuel) return;
    await joinDuel(inviteDuel._id, user._id);
    await fetchActiveDuels(user._id);
    setShowInviteModal(false);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SystemWindow>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>CORE STATISTICS</Text>
            <Text style={styles.levelLabel}>LVL. {user ? Math.floor(xp / 100) + 1 : 0}</Text>
          </View>

          <View style={styles.rowBetween}>
            <Text style={styles.walletLabel}>◎ SolScan</Text>
            <ConnectButton
              connected={wallet.connected}
              connecting={wallet.connecting}
              publicKey={wallet.publicKey?.toBase58() ?? null}
              onConnect={wallet.connect}
              onDisconnect={wallet.disconnect}
            />
          </View>

          {isWalletDisconnected ? (
            <Text style={styles.systemOffline}>SYSTEM OFFLINE</Text>
          ) : (
            <View style={styles.statsGrid}>
              <StatBlock
                label="PLAYER STATUS"
                value={tier || "INITIATE"}
                unit={username ? `@${username}` : "UNSET"}
                valueColor={C.green}
              />
              <StatBlock
                label="SHADOW VAULT"
                value={vaultBalance.toFixed(2)}
                unit="SOL"
                valueColor={C.purple}
              />
            </View>
          )}
        </SystemWindow>

        {isIdleHunter && (
          <TouchableOpacity
            style={styles.emptyQuestBox}
            activeOpacity={0.8}
            onPress={() => setShowArenaModal(true)}
          >
            <Text style={styles.skullIcon}>☠</Text>
            <Text style={styles.emptyQuestTitle}>No Active Gate Found</Text>
            <Text style={styles.emptyQuestSub}>Search for opponent or create challenge</Text>
          </TouchableOpacity>
        )}

        {hasActiveDuel && activeDuel && (
          <QuestCard
            title="THE TRIAL OF DISCIPLINE"
            opponentName={activeDuel.player2 ? `#${String(activeDuel.player2).slice(0, 6)}` : "Awaiting Hunter"}
            stakeLabel={`${activeDuel.stakeAmount} SOL`}
            progress={Math.min(1, duelProgressDays / 7)}
            isLive={activeDuel.status === "ACTIVE"}
            onEnter={() => router.push("/duel")}
          />
        )}

        {!isWalletDisconnected && !isNewPlayer && (
          <SystemWindow style={styles.missionWindow}>
            <Text style={styles.sectionLabel}>MISSION BOARD</Text>
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

        {!isWalletDisconnected && !isNewPlayer && (
          <SystemWindow>
            <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
            <View style={styles.actionStack}>
              <GateButton label="Search For Opponent" onPress={() => setShowArenaModal(true)} />
              <GateButton
                label="Create Challenge"
                variant="ghost"
                onPress={() => setShowArenaModal(true)}
              />
            </View>
          </SystemWindow>
        )}

        {!isWalletDisconnected && (
          <SystemWindow style={styles.feedWindow}>
            <Text style={styles.sectionLabel}>HUNTER FEED</Text>
            <View style={styles.feedList}>
              {LOBBY_FEED.map((line) => (
                <Text key={line} style={styles.feedText}>
                  ▸ {line}
                </Text>
              ))}
            </View>
          </SystemWindow>
        )}
      </ScrollView>

      <Modal transparent visible={showRegistration && isNewPlayer} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>SYSTEM REGISTRATION</Text>
            <Text style={styles.modalLabel}>Choose username</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder="hunter-name"
              placeholderTextColor={C.slate600}
              value={usernameInput}
              onChangeText={setUsernameInput}
            />

            <Text style={styles.modalLabel}>Select character</Text>
            <View style={styles.chipRow}>
              {CHARACTER_OPTIONS.map((ch) => {
                const selected = selectedCharacter === ch.id;
                return (
                  <TouchableOpacity
                    key={ch.id}
                    style={[styles.characterCard, selected && styles.characterCardSelected]}
                    onPress={() => setSelectedCharacter(ch.id)}
                  >
                    <Image source={ch.image} style={styles.characterImage} />
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {ch.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <GateButton
              label={userLoading ? "Registering..." : "Confirm"}
              onPress={handleRegister}
              disabled={userLoading || usernameInput.trim().length < 3}
            />
          </View>
        </View>
      </Modal>

      <Modal transparent visible={showArenaModal && !!user} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ARENA SEARCH</Text>

            <Text style={styles.modalLabel}>Select stake</Text>
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

            <Text style={styles.modalLabel}>Select start time</Text>
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

            {scanning ? (
              <View style={styles.scanBlock}>
                <Text style={styles.scanText}>Searching for opponent...</Text>
                <ProgressBar progress={scanProgress} animated={false} />
              </View>
            ) : null}

            {arenaMessage ? <Text style={styles.arenaMessage}>{arenaMessage}</Text> : null}

            <View style={styles.actionStack}>
              <GateButton
                label={createLoading ? "Creating..." : "Create Challenge"}
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
            <Text style={styles.modalTitle}>DUEL INVITE</Text>
            <Text style={styles.modalLabel}>Opponent: #{String(inviteDuel?.player1 ?? "").slice(0, 6)}</Text>
            <Text style={styles.modalLabel}>Stake: {inviteDuel?.stakeAmount ?? 0} SOL</Text>
            <Text style={styles.modalLabel}>
              Start time: {inviteDuel?.startTime ? new Date(inviteDuel.startTime).toLocaleString() : "TBD"}
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
    gap: 12,
    paddingBottom: 42,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 14,
  },
  levelLabel: {
    fontSize: 10,
    color: C.slate500,
    fontFamily: "monospace",
    marginBottom: 14,
  },
  walletLabel: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 12,
  },
  statsGrid: {
    marginTop: 16,
    flexDirection: "row",
    gap: 24,
  },
  systemOffline: {
    marginTop: 16,
    color: C.slate600,
    fontFamily: "monospace",
    letterSpacing: 1,
    textTransform: "uppercase",
    fontStyle: "italic",
  },
  emptyQuestBox: {
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: C.slate800,
    borderRadius: 8,
    padding: 42,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  skullIcon: {
    fontSize: 36,
    color: C.slate800,
    marginBottom: 16,
  },
  emptyQuestTitle: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.slate600,
    letterSpacing: 3,
    textTransform: "uppercase",
    textAlign: "center",
  },
  emptyQuestSub: {
    fontSize: 11,
    color: C.slate700,
    marginTop: 8,
    fontStyle: "italic",
    textAlign: "center",
  },
  actionStack: {
    gap: 10,
  },
  feedWindow: {
    borderColor: C.manaBorder,
    backgroundColor: "rgba(0,209,255,0.04)",
  },
  missionWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(153,69,255,0.05)",
  },
  missionList: {
    gap: 10,
  },
  missionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: C.green,
  },
  missionTitle: {
    flex: 1,
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 12,
  },
  missionStatus: {
    color: C.purple,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
  },
  feedList: {
    gap: 6,
  },
  feedText: {
    color: C.slate400,
    fontSize: 12,
    fontFamily: "monospace",
    lineHeight: 18,
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
  input: {
    borderWidth: 1,
    borderColor: C.slate700,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: C.white,
    fontFamily: "monospace",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  characterCard: {
    width: "31%",
    minWidth: 92,
    borderWidth: 1,
    borderColor: C.slate700,
    borderRadius: 6,
    padding: 6,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  characterCardSelected: {
    borderColor: C.mana,
    backgroundColor: C.manaDim,
  },
  characterImage: {
    width: "100%",
    height: 72,
    borderRadius: 4,
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
  scanBlock: {
    marginTop: 2,
    marginBottom: 4,
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
    fontSize: 11,
    fontStyle: "italic",
    marginBottom: 4,
  },
});
