import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FLOW_STEPS = [
  {
    id: "01",
    title: "Create Duel",
    copy: "Vinay stakes 1 SOL. The contract moves funds into escrow and the backend marks the duel pending.",
  },
  {
    id: "02",
    title: "Join Duel",
    copy: "Rahul matches the stake, escrow reaches 2 SOL, and the duel becomes active with a start time.",
  },
  {
    id: "03",
    title: "Daily Check-in",
    copy: "Check-ins stay off-chain for speed. The backend records proof, validates the 24h window, and updates streaks.",
  },
  {
    id: "04",
    title: "Resolve + Settle",
    copy: "Two missed windows trigger resolution. The frontend then unlocks settlement so the contract distributes funds.",
  },
];

const REWARDS = [
  "Winner receives 70%",
  "Loser keeps 25% in vault",
  "Treasury receives 5%",
];

async function feedbackFx(type: "soft" | "hard") {
  try {
    if (type === "hard") {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Vibration.vibrate([0, 40, 40, 40]);
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Vibration.vibrate(12);
  } catch {
    Vibration.vibrate(20);
  }
}

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    void feedbackFx("soft");
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <Text style={styles.badge}>Sol Duel Arena</Text>
          <Text style={styles.title}>Turn discipline into a live orange-streak game.</Text>
          <Text style={styles.subtitle}>
            Challenge a friend, lock the stake on-chain, keep the daily loop fast off-chain, and settle only when the winner is clear.
          </Text>

          <View style={styles.heroStats}>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>2 SOL</Text>
              <Text style={styles.heroStatLabel}>escrowed match</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>24h</Text>
              <Text style={styles.heroStatLabel}>check-in window</Text>
            </View>
            <View style={styles.heroStatCard}>
              <Text style={styles.heroStatValue}>2</Text>
              <Text style={styles.heroStatLabel}>strikes to lose</Text>
            </View>
          </View>

          <View style={styles.heroActions}>
            <GateButton
              label="Enter Lobby"
              onPress={() => {
                void feedbackFx("soft");
                router.push("/");
              }}
            />
            <GateButton
              label="Open Duel Board"
              variant="ghost"
              onPress={() => {
                void feedbackFx("soft");
                router.push("/duel");
              }}
            />
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>Gameplay Loop</Text>
          <View style={styles.flowList}>
            {FLOW_STEPS.map((step) => (
              <View key={step.id} style={styles.stepCard}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{step.id}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepCopy}>{step.copy}</Text>
                </View>
              </View>
            ))}
          </View>
        </SystemWindow>

        <SystemWindow style={styles.rewardsWindow}>
          <Text style={styles.sectionLabel}>Settlement Rewards</Text>
          <Text style={styles.rewardsLead}>
            The backend decides the winner from streak data, but the contract only allows the approved payout path.
          </Text>
          <View style={styles.rewardList}>
            {REWARDS.map((reward) => (
              <View key={reward} style={styles.rewardRow}>
                <View style={styles.rewardDot} />
                <Text style={styles.rewardText}>{reward}</Text>
              </View>
            ))}
          </View>
        </SystemWindow>

        <SystemWindow style={styles.warningWindow}>
          <Text style={styles.sectionLabel}>Why This Works</Text>
          <Text style={styles.rule}>Real escrow creates pressure.</Text>
          <Text style={styles.rule}>Off-chain check-ins keep the game fast.</Text>
          <Text style={styles.rule}>On-chain settlement keeps payouts controlled.</Text>

          <View style={styles.warningAction}>
            <GateButton
              label="Launch Challenge"
              onPress={() => {
                void feedbackFx("hard");
                router.push("/");
              }}
            />
          </View>
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: "rgba(42,20,8,0.96)",
  },
  heroGlow: {
    position: "absolute",
    right: -32,
    top: -26,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,31,0.18)",
  },
  badge: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.purple,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  title: {
    color: C.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
    maxWidth: 560,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  heroStatCard: {
    flexGrow: 1,
    minWidth: 92,
    borderRadius: 14,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  heroStatValue: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroStatLabel: {
    color: C.slate500,
    fontSize: 11,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  heroActions: { gap: 10 },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  flowList: {
    gap: 10,
  },
  stepCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  stepBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.mana,
  },
  stepBadgeText: {
    color: C.coal,
    fontSize: 11,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  stepContent: {
    flex: 1,
    gap: 4,
  },
  stepTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
  },
  stepCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  rewardsWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  rewardsLead: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 12,
  },
  rewardList: {
    gap: 10,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rewardDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: C.success,
  },
  rewardText: {
    color: C.white,
    fontSize: 14,
  },
  warningWindow: {
    borderColor: "rgba(255,107,26,0.34)",
    backgroundColor: "rgba(255,107,26,0.09)",
  },
  rule: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  warningAction: {
    marginTop: 12,
  },
});
