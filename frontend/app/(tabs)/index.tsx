import { CharacterAvatar } from "@/components/CharacterAvatar";
import { ConnectButton } from "@/components/ConnectButton";
import { GateButton } from "@/components/GateButton";
import {
  CHARACTER_OPTIONS,
  CharacterId,
  resolveCharacterOption,
} from "@/components/characters";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { getParticipantLabel, toDuelId } from "@/lib/duel-view";
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

const STAKES = [0.1, 0.5, 1, 2];
const START_DELAY_OPTIONS = [10, 30, 60];
const HOW_IT_WORKS =
  "Strivioz uses blockchain transparency to enforce habit streaks. Two players stake SOL. The winner takes 70%, the loser's 25% is locked in a vault. Treasury takes 5%.";

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

  const inviteDuelId = toDuelId(params.duelId);
  const inviteDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    inviteDuelId ? { id: inviteDuelId } : "skip",
  );
  const [showInviteModal, setShowInviteModal] = useState(Boolean(inviteDuelId));

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const activeDuel = activeDuels[0] ?? null;
  const invalidInviteLink =
    typeof params.duelId === "string" && !toDuelId(params.duelId);
  const activeDuelEntry = activeDuel ? duelMap[activeDuel._id] : undefined;
  const duelProgressDays = useMemo(() => {
    if (!activeDuel || !activeDuelEntry?.progress || !user) return 0;
    const progress = activeDuelEntry.progress;
    const mine =
      progress.player1 === user._id ? progress.p1Days : progress.p2Days;
    return new Set(mine).size;
  }, [activeDuel, activeDuelEntry, user]);

  const homeRotate = useSharedValue(0);
  const mascotFloat = useSharedValue(0);

  useEffect(() => {
    homeRotate.value = withRepeat(
      withTiming(1, { duration: 30000, easing: Easing.linear }),
      -1,
      false,
    );
    mascotFloat.value = withRepeat(
      withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [homeRotate, mascotFloat]);

  const bgOrbStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(homeRotate.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const mascotStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(mascotFloat.value, [0, 1], [-8, 10]) },
    ],
  }));

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
  }, [
    wallet.connected,
    walletAddress,
    fetchActiveDuels,
    fetchOpenDuels,
    fetchUser,
  ]);

  useEffect(() => {
    if (inviteDuelId) {
      router.replace(
        `/invite/duel/${encodeURIComponent(String(inviteDuelId))}` as any,
      );
      return;
    }
    setShowInviteModal(Boolean(inviteDuelId));
  }, [inviteDuelId, router]);

  const isNewPlayer = wallet.connected && !userLoading && !user;
  const hasActiveDuel = wallet.connected && !!user && !!activeDuel;
  const levelLabel = user
    ? String(Math.floor(xp / 100) + 1).padStart(2, "0")
    : "00";
  const showcaseCharacter = resolveCharacterOption(
    user?.selectedCharacter ?? selectedCharacter,
  );

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
      title: duelTitle.trim() || `Discipline Run • ${stake} SOL`,
      description:
        duelDescription.trim() ||
        "A focused streak challenge with real escrow and daily proof.",
    });

    await fetchOpenDuels(user._id);
    setDuelTitle("");
    setDuelDescription("");
    setArenaMessage(
      "Challenge forged. Open the duel board to share the invite.",
    );
  };

  const handleJoinPublic = async () => {
    if (!user) return;
    const candidate = openDuels.find((duel) => duel.player1 !== user._id);
    if (!candidate) {
      setArenaMessage("No live rival found yet. Try again in a bit.");
      return;
    }

    await joinDuel(candidate._id, user._id);
    await fetchActiveDuels(user._id);
    setShowArenaModal(false);
    router.push(
      `/(tabs)/duel/${encodeURIComponent(String(candidate._id))}` as any,
    );
  };

  const handleJoinInvite = async () => {
    if (!user || !inviteDuel) return;
    await joinDuel(inviteDuel._id, user._id);
    await fetchActiveDuels(user._id);
    setShowInviteModal(false);
    router.push(
      `/(tabs)/duel/${encodeURIComponent(String(inviteDuel._id))}` as any,
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <HomeBackground orbStyle={bgOrbStyle} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoIcon}>
              <View style={styles.logoBolt} />
            </View>
            <Text style={styles.brandText}>Strivioz</Text>
          </View>
          <ConnectButton
            connected={wallet.connected}
            connecting={wallet.connecting}
            publicKey={wallet.publicKey?.toBase58() ?? null}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </View>

        <Animated.View
          entering={FadeInDown.duration(420)}
          style={styles.heroSection}
        >
          <View style={styles.mascotShowcase}>
            <Animated.View style={[styles.mascotRing, mascotStyle]} />
            <Animated.View style={[styles.mascotRingInner, mascotStyle]} />
            <Animated.View style={[styles.mascotGlow, mascotStyle]} />
            <Animated.View style={[styles.mascotAvatar, mascotStyle]}>
              <CharacterAvatar
                characterId={showcaseCharacter.id}
                label={showcaseCharacter.name}
                size={110}
              />
            </Animated.View>
          </View>

          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>
              Welcome to <Text style={styles.heroAccent}>Strivioz</Text>
            </Text>
            <Text style={styles.heroCopy}>
              Stake SOL, build unbreakable habits, and dominate the arena.
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(460).delay(40)}
          style={styles.statsCard}
        >
          <View style={styles.statsHeader}>
            <Text style={styles.statsLabel}>Your Stats</Text>
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>
                {wallet.connected ? "Live" : "Offline"}
              </Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <StatTile
              value={String(user?.totalWins ?? 0)}
              label="Wins"
              accent={C.mana}
              tone="orange"
            />
            <StatTile
              value={vaultBalance.toFixed(1)}
              label="SOL Earned"
              accent={C.success}
              tone="green"
            />
          </View>

          {wallet.connected ? (
            <View style={styles.metaLine}>
              <Text style={styles.metaText}>LV {levelLabel}</Text>
              <Text style={styles.metaDivider}>•</Text>
              <Text style={styles.metaText}>{tier || "Initiate"}</Text>
              {username ? (
                <>
                  <Text style={styles.metaDivider}>•</Text>
                  <Text style={styles.metaText}>@{username}</Text>
                </>
              ) : null}
            </View>
          ) : null}
        </Animated.View>

        {invalidInviteLink ? (
          <View style={styles.noticeCard}>
            <Text style={styles.noticeTitle}>Invite Link</Text>
            <Text style={styles.noticeCopy}>
              The duel link is invalid. Open the full shared URL again or paste
              the exact duel id in the duel board.
            </Text>
          </View>
        ) : null}

        {hasActiveDuel && activeDuel ? (
          <Animated.View
            entering={FadeInDown.duration(500).delay(80)}
            style={styles.liveDuelCard}
          >
            <Text style={styles.sectionTitle}>Live Duel</Text>
            {/*<Text style={styles.liveDuelTitle}>{getDuelTitle(activeDuel as any)}</Text>*/}
            <Text style={styles.liveDuelCopy}>
              Rival: {getParticipantLabel(activeDuel as any, "player2")} •{" "}
              {duelProgressDays} days logged
            </Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() =>
                router.push(
                  `/(tabs)/duel/${encodeURIComponent(String(activeDuel._id))}` as any,
                )
              }
            >
              <Text style={styles.primaryButtonText}>Open Duel Detail</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}

      

        <SectionTitle title="How It Works" />
        <Animated.View
          entering={FadeInDown.duration(540).delay(160)}
          style={styles.copyCard}
        >
          <Text style={styles.copyText}>{HOW_IT_WORKS}</Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.duration(560).delay(200)}
          style={styles.actionCard}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push("/duel")}
          >
            <Text style={styles.primaryButtonText}>Enter Arena</Text>
          </TouchableOpacity>
          {wallet.connected && user ? (
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setShowArenaModal(true)}
            >
              <Text style={styles.secondaryButtonText}>Forge Quick Duel</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </ScrollView>

      <Modal
        transparent
        visible={showRegistration && isNewPlayer}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Register Hunter</Text>
            <Text style={styles.modalLabel}>Choose Username</Text>
            <TextInput
              style={styles.input}
              autoCapitalize="none"
              placeholder="hunter-name"
              placeholderTextColor={C.slate600}
              value={usernameInput}
              onChangeText={setUsernameInput}
            />

            <Text style={styles.modalLabel}>Select Character</Text>
            <View style={styles.modalCharacterGrid}>
              {CHARACTER_OPTIONS.slice(0, 8).map((character) => {
                const selected = selectedCharacter === character.id;
                return (
                  <TouchableOpacity
                    key={character.id}
                    style={[
                      styles.modalCharacterCard,
                      selected && styles.modalCharacterCardSelected,
                    ]}
                    onPress={() => setSelectedCharacter(character.id)}
                  >
                    <CharacterAvatar
                      characterId={character.id}
                      label={character.name}
                      size={64}
                    />
                    <Text style={styles.modalCharacterName}>
                      {character.name}
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

      <Modal
        transparent
        visible={showArenaModal && !!user}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Forge a Duel</Text>
            <Text style={styles.modalLabel}>Duel Title</Text>
            <TextInput
              style={styles.input}
              placeholder="7-Day Study Sprint"
              placeholderTextColor={C.slate600}
              value={duelTitle}
              onChangeText={setDuelTitle}
            />

            <Text style={styles.modalLabel}>Mission</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholder="Explain the habit, rules, or why this duel matters"
              placeholderTextColor={C.slate600}
              value={duelDescription}
              onChangeText={setDuelDescription}
              multiline
            />

            <Text style={styles.modalLabel}>Stake</Text>
            <View style={styles.chipRow}>
              {STAKES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[styles.chip, stake === value && styles.chipActive]}
                  onPress={() => setStake(value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      stake === value && styles.chipTextActive,
                    ]}
                  >
                    {value} SOL
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Start Countdown</Text>
            <View style={styles.chipRow}>
              {START_DELAY_OPTIONS.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.chip,
                    startDelayMins === value && styles.chipActive,
                  ]}
                  onPress={() => setStartDelayMins(value)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      startDelayMins === value && styles.chipTextActive,
                    ]}
                  >
                    {value}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {arenaMessage ? (
              <Text style={styles.arenaMessage}>{arenaMessage}</Text>
            ) : null}

            <View style={styles.modalActions}>
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
              <GateButton
                label="Close"
                variant="ghost"
                onPress={() => setShowArenaModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        transparent
        visible={showInviteModal && !!inviteDuel && !!user}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Invite Found</Text>
            <Text style={styles.modalLabel}>
              Opponent: {getParticipantLabel(inviteDuel as any, "player1")}
            </Text>
            <Text style={styles.modalLabel}>
              Stake: {inviteDuel?.stakeAmount ?? 0} SOL
            </Text>
            <Text style={styles.modalLabel}>
              Starts:{" "}
              {inviteDuel?.startTime
                ? new Date(inviteDuel.startTime).toLocaleString()
                : "TBD"}
            </Text>
            <View style={styles.modalActions}>
              <GateButton
                label="Join Gate"
                onPress={handleJoinInvite}
                disabled={joinLoading}
              />
              <GateButton
                label="Dismiss"
                variant="ghost"
                onPress={() => setShowInviteModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
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

function StatTile({
  value,
  label,
  accent,
  tone,
}: {
  value: string;
  label: string;
  accent: string;
  tone: "orange" | "green";
}) {
  return (
    <View
      style={[
        styles.statTile,
        tone === "orange" ? styles.statTileOrange : styles.statTileGreen,
      ]}
    >
      <Text style={[styles.statValue, { color: accent }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionRule} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );
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
    marginBottom: 20,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.mana,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: C.mana,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
  },
  logoBolt: {
    width: 10,
    height: 18,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  brandText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  heroSection: {
    alignItems: "center",
    marginBottom: 28,
  },
  mascotShowcase: {
    width: 160,
    height: 160,
    marginBottom: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  mascotRing: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "rgba(255,107,53,0.2)",
  },
  mascotRingInner: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderStyle: "dashed",
  },
  mascotGlow: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.22)",
  },
  mascotAvatar: {
    width: 110,
    height: 110,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTextBlock: {
    alignItems: "center",
  },
  heroTitle: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  heroAccent: {
    color: C.mana,
  },
  heroCopy: {
    marginTop: 10,
    maxWidth: 280,
    color: "#9b9ba3",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  statsCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 26,
  },
  statsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  statsLabel: {
    color: "#666",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: C.success,
  },
  liveText: {
    color: C.success,
    fontSize: 11,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
  },
  statTile: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
  },
  statTileOrange: {
    backgroundColor: "rgba(255,107,53,0.12)",
    borderColor: "rgba(255,107,53,0.1)",
  },
  statTileGreen: {
    backgroundColor: "rgba(0,214,143,0.12)",
    borderColor: "rgba(0,214,143,0.1)",
  },
  statValue: {
    fontSize: 28,
    fontWeight: "800",
  },
  statLabel: {
    marginTop: 4,
    color: "#555",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  metaLine: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  metaText: {
    color: "#8d8d96",
    fontSize: 11,
    fontWeight: "700",
  },
  metaDivider: {
    marginHorizontal: 8,
    color: "#444",
  },
  noticeCard: {
    backgroundColor: "rgba(255,107,53,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,107,53,0.18)",
    padding: 14,
    marginBottom: 22,
  },
  noticeTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  noticeCopy: {
    marginTop: 4,
    color: "#9b9ba3",
    fontSize: 12,
    lineHeight: 18,
  },
  liveDuelCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 18,
    marginBottom: 22,
  },
  sectionTitle: {
    color: "#666",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
  },
  liveDuelTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
  },
  liveDuelCopy: {
    marginTop: 6,
    color: "#9b9ba3",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
  },
  sectionRule: {
    width: 20,
    height: 1,
    backgroundColor: C.mana,
  },
  sectionTitleText: {
    color: "#444",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  characterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 26,
  },
  characterCard: {
    width: "30.5%",
    minWidth: 94,
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 12,
    alignItems: "center",
    gap: 8,
  },
  characterCardSelected: {
    borderColor: "rgba(255,107,53,0.28)",
    backgroundColor: "rgba(20,20,28,0.9)",
  },
  characterName: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  copyCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 18,
    marginBottom: 20,
  },
  copyText: {
    color: "#888",
    fontSize: 13,
    lineHeight: 22,
  },
  actionCard: {
    gap: 12,
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: C.mana,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: "center",
    shadowColor: C.mana,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 24,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  secondaryButton: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 18,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: "rgba(12,12,16,0.98)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
  },
  modalTitle: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 16,
    textAlign: "center",
  },
  modalLabel: {
    color: "#8d8d96",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.03)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 14,
    marginBottom: 12,
  },
  textarea: {
    minHeight: 92,
    textAlignVertical: "top",
  },
  modalCharacterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 16,
  },
  modalCharacterCard: {
    width: "22%",
    minWidth: 74,
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  modalCharacterCardSelected: {
    borderColor: "rgba(255,107,53,0.28)",
  },
  modalCharacterName: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    borderColor: "rgba(255,107,53,0.28)",
    backgroundColor: "rgba(255,107,53,0.1)",
  },
  chipText: {
    color: "#8d8d96",
    fontSize: 12,
    fontWeight: "700",
  },
  chipTextActive: {
    color: "#fff",
  },
  arenaMessage: {
    color: C.success,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  modalActions: {
    gap: 10,
  },
});
