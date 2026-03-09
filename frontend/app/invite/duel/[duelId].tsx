import { CharacterAvatar } from "@/components/CharacterAvatar";
import { ConnectButton } from "@/components/ConnectButton";
import { FeedbackModal } from "@/components/FeedbackModal";
import { GateButton } from "@/components/GateButton";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { DuelWithParticipants, getParticipantLabel, shortenWallet, toDuelId } from "@/lib/duel-view";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { Link, Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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

export default function DuelInviteScreen() {
  const router = useRouter();
  const { duelId: duelIdValue } = useLocalSearchParams<{ duelId?: string }>();
  const wallet = useWallet();
  const duelId = toDuelId(duelIdValue);

  const [readChecked, setReadChecked] = useState(false);
  const [joinLoading, setJoinLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(EMPTY_FEEDBACK);

  const orbit = useSharedValue(0);
  useEffect(() => {
    orbit.value = withRepeat(
      withTiming(1, { duration: 28000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [orbit]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(orbit.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );
  const inviteDuel = useQuery(
    api.duels.getDuelById.getDuelById,
    duelId ? { id: duelId } : "skip",
  ) as DuelWithParticipants | null | undefined;

  const joinFriendDuel = useMutation(api.duels.joinFriendDuel.joinFriendDuel);

  const canJoin = useMemo(() => {
    if (!inviteDuel || !user) return false;
    if (inviteDuel.status !== "OPEN") return false;
    if (inviteDuel.player1 === user._id) return false;
    return true;
  }, [inviteDuel, user]);

  const openFeedback = (
    tone: FeedbackState["tone"],
    title: string,
    message: string,
  ) => setFeedback({ visible: true, tone, title, message });

  const handleJoin = async () => {
    if (!inviteDuel || !duelId || !user) {
      openFeedback("error", "Join blocked", "Connect your registered wallet first.");
      return;
    }
    if (!readChecked) {
      openFeedback("error", "Consent required", "Review the contract terms before joining.");
      return;
    }
    if (!inviteDuel.onchainDuelAddress) {
      openFeedback("error", "Join failed", "This duel is missing on-chain metadata.");
      return;
    }

    setJoinLoading(true);
    let onChainJoin: Awaited<ReturnType<typeof wallet.joinDuel>> | null = null;
    try {
      onChainJoin = await wallet.joinDuel({
        duelAddress: inviteDuel.onchainDuelAddress,
        escrowAddress: inviteDuel.onchainEscrowAddress,
      });
      await joinFriendDuel({
        duelId,
        player2: user._id,
      });
      openFeedback(
        "success",
        "Joined duel",
        `Stake locked. Redirecting to duel ${String(duelId).slice(0, 8)}...`,
      );
      setTimeout(() => {
        router.replace(`/(tabs)/duel/${encodeURIComponent(String(duelId))}` as any);
      }, 500);
    } catch (error: any) {
      openFeedback(
        "error",
        "Join failed",
        onChainJoin
          ? `On-chain join succeeded, but backend activation failed. Tx: ${onChainJoin.signature}`
          : (error?.message ?? "Could not join duel."),
      );
    } finally {
      setJoinLoading(false);
    }
  };

  if (!duelId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <InviteBackground orbStyle={orbStyle} />
        <CenteredState title="Invalid invite" copy="This duel invite link is malformed." />
      </SafeAreaView>
    );
  }

  if (inviteDuel === undefined) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <InviteBackground orbStyle={orbStyle} />
        <CenteredState title="Loading contract" copy="Pulling the duel terms and escrow details." />
      </SafeAreaView>
    );
  }

  if (!inviteDuel) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <InviteBackground orbStyle={orbStyle} />
        <CenteredState title="Invite expired" copy="This duel could not be found." />
      </SafeAreaView>
    );
  }

  const challenger = getParticipantLabel(inviteDuel, "player1");
  const alreadyJoined = inviteDuel.status !== "OPEN";

  return (
    <SafeAreaView style={styles.safeArea}>
      <Stack.Screen options={{ headerShown: false }} />
      <InviteBackground orbStyle={orbStyle} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.backPill}>
              <Text style={styles.backPillText}>Home</Text>
            </TouchableOpacity>
          </Link>
          <ConnectButton
            connected={wallet.connected}
            connecting={wallet.connecting}
            publicKey={wallet.publicKey?.toBase58() ?? null}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </View>

        <Animated.View entering={FadeInDown.duration(420)} style={styles.heroSection}>
          <Text style={styles.eyebrow}>Invite Contract</Text>
          <Text style={styles.heroTitle}>Review Before You Join</Text>
          <Text style={styles.heroCopy}>
            This page is the contract summary for the duel you were invited to. Confirm the terms before you lock your stake.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(460).delay(40)} style={styles.contractCard}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarColumn}>
              <CharacterAvatar
                characterId={inviteDuel.player1User?.selectedCharacter}
                label={challenger}
                size={88}
              />
              <Text style={styles.avatarName}>{challenger}</Text>
              <Text style={styles.avatarMeta}>Challenger</Text>
            </View>

            <View style={styles.versusWrap}>
              <View style={styles.versusRing}>
                <Text style={styles.versusText}>VS</Text>
              </View>
              <Text style={styles.versusSub}>
                {inviteDuel.status === "OPEN" ? "Open seat" : "Locked"}
              </Text>
            </View>

            <View style={styles.avatarColumn}>
              <CharacterAvatar
                characterId={user?.selectedCharacter ?? inviteDuel.player2User?.selectedCharacter}
                label={user?.username ?? "You"}
                size={88}
              />
              <Text style={styles.avatarName}>{user?.username ? `@${user.username}` : "Your seat"}</Text>
              <Text style={styles.avatarMeta}>Responder</Text>
            </View>
          </View>

          <Text style={styles.contractTitle}>{inviteDuel.title?.trim() || "Friend Duel Contract"}</Text>
          <Text style={styles.contractCopy}>{inviteDuel.description?.trim() || "A private duel with escrow-backed accountability."}</Text>

          <View style={styles.contractGrid}>
            <ContractTile label="Stake" value={`${inviteDuel.stakeAmount} SOL`} />
            <ContractTile label="Starts" value={formatDateTime(inviteDuel.startTime)} />
            <ContractTile label="Ends" value={formatDateTime(inviteDuel.endTime)} />
            <ContractTile label="Duration" value={`${getTotalDays(inviteDuel)} days`} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(500).delay(80)} style={styles.termsCard}>
          <Text style={styles.sectionTitle}>What You Are Joining</Text>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Counterparty</Text>
            <Text style={styles.termValue}>{challenger}</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Wallet</Text>
            <Text style={styles.termValue}>{shortenWallet(inviteDuel.player1User?.walletAddress)}</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Winner payout</Text>
            <Text style={styles.termValue}>70%</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Loser vault lock</Text>
            <Text style={styles.termValue}>25%</Text>
          </View>
          <View style={styles.termRow}>
            <Text style={styles.termLabel}>Treasury fee</Text>
            <Text style={styles.termValue}>5%</Text>
          </View>

          <Pressable style={styles.checkRow} onPress={() => setReadChecked((value) => !value)}>
            <View style={[styles.checkbox, readChecked && styles.checkboxActive]} />
            <Text style={styles.checkText}>
              I understand the payout split, the duel duration, and that joining will lock my stake on-chain.
            </Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(540).delay(120)} style={styles.actionCard}>
          {!wallet.connected ? (
            <Text style={styles.stateHint}>Connect your wallet to continue.</Text>
          ) : user === null ? (
            <Text style={styles.stateHint}>Complete registration on the home screen before joining.</Text>
          ) : alreadyJoined ? (
            <Text style={styles.stateHint}>This invite is no longer open. If you are a participant, open the duel board.</Text>
          ) : null}

          <GateButton
            label={joinLoading ? "Joining..." : "Join This Duel"}
            onPress={handleJoin}
            disabled={!wallet.connected || !user || !canJoin || !readChecked || joinLoading}
          />

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={() => router.push(`/(tabs)/duel/${encodeURIComponent(String(duelId))}` as any)}
          >
            <Text style={styles.secondaryActionText}>Open Duel Detail</Text>
          </TouchableOpacity>
        </Animated.View>
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

function InviteBackground({ orbStyle }: { orbStyle: ReturnType<typeof useAnimatedStyle> }) {
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
        { left: `${10 + index * 12}%`, backgroundColor: index % 2 === 0 ? C.mana : C.success },
      ]}
    />
  );
}

function CenteredState({ title, copy }: { title: string; copy: string }) {
  return (
    <View style={styles.centered}>
      <Text style={styles.centerTitle}>{title}</Text>
      <Text style={styles.centerCopy}>{copy}</Text>
    </View>
  );
}

function ContractTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.contractTile}>
      <Text style={styles.contractTileLabel}>{label}</Text>
      <Text style={styles.contractTileValue}>{value}</Text>
    </View>
  );
}

function getTotalDays(duel: DuelWithParticipants) {
  if (!duel.startTime || !duel.endTime) return 0;
  return Math.max(1, Math.ceil((duel.endTime - duel.startTime) / (24 * 60 * 60 * 1000)));
}

function formatDateTime(value?: number) {
  if (!value) return "TBD";
  return new Date(value).toLocaleString();
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
  heroSection: {
    alignItems: "center",
    marginBottom: 24,
  },
  eyebrow: {
    color: C.mana,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  heroTitle: {
    color: C.white,
    fontSize: 28,
    fontWeight: "800",
    textAlign: "center",
  },
  heroCopy: {
    marginTop: 10,
    maxWidth: 320,
    color: "#9b9ba3",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  contractCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
    marginBottom: 18,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  avatarColumn: {
    flex: 1,
    alignItems: "center",
  },
  avatarName: {
    marginTop: 10,
    color: C.white,
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
  },
  avatarMeta: {
    marginTop: 4,
    color: "#8d8d96",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  versusWrap: {
    width: 80,
    alignItems: "center",
  },
  versusRing: {
    width: 56,
    height: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  versusText: {
    color: C.white,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  versusSub: {
    marginTop: 8,
    color: "#8d8d96",
    fontSize: 11,
    fontWeight: "700",
  },
  contractTitle: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 8,
  },
  contractCopy: {
    color: "#9b9ba3",
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  contractGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  contractTile: {
    width: "48%",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    borderRadius: 16,
    padding: 14,
  },
  contractTileLabel: {
    color: "#8d8d96",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 6,
  },
  contractTileValue: {
    color: C.white,
    fontSize: 12,
    lineHeight: 18,
  },
  termsCard: {
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
    marginBottom: 14,
  },
  termRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  termLabel: {
    color: "#8d8d96",
    fontSize: 12,
  },
  termValue: {
    color: C.white,
    fontSize: 12,
    fontWeight: "700",
  },
  checkRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  checkboxActive: {
    backgroundColor: C.success,
    borderColor: C.success,
  },
  checkText: {
    flex: 1,
    color: "#9b9ba3",
    fontSize: 12,
    lineHeight: 18,
  },
  actionCard: {
    backgroundColor: "rgba(12,12,16,0.85)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    padding: 20,
  },
  stateHint: {
    color: "#9b9ba3",
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 14,
  },
  secondaryAction: {
    marginTop: 12,
    alignItems: "center",
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: "#8d8d96",
    fontSize: 12,
    fontWeight: "700",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  centerTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  centerCopy: {
    color: "#9b9ba3",
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
});
