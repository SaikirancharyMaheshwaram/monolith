import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import { ScrollView, StyleSheet, Text, Vibration, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const EXPLAINERS = [
  {
    title: "What this app is",
    copy: "A PvP habit duel app. Two people put real SOL into escrow, then compete by checking in daily until one side proves more discipline.",
  },
  {
    title: "Why blockchain is used",
    copy: "Money custody and final payout happen on-chain so neither player can fake the stake or alter the final split after the duel is decided.",
  },
  {
    title: "Why everything is not on-chain",
    copy: "Daily proof stays off-chain so the habit loop feels fast, cheap, and usable. Only the serious money moment touches the contract.",
  },
];

const FLOW_STEPS = [
  {
    id: "01",
    title: "Create a challenge",
    copy: "Choose a stake, add a title and mission, and lock your side of the escrow.",
  },
  {
    id: "02",
    title: "Invite or get matched",
    copy: "A friend can join directly, or a public rival can claim the open slot and activate the duel.",
  },
  {
    id: "03",
    title: "Check in daily",
    copy: "Each day you submit proof that you actually did the habit. Miss enough windows and the duel turns against you.",
  },
  {
    id: "04",
    title: "Settle the result",
    copy: "When the winner is clear, the final split is executed through the contract so the payout is enforceable.",
  },
];

const TRUST_POINTS = [
  "Real escrow creates pressure before the duel starts.",
  "Titles and descriptions make every duel read like a mission, not a random transaction.",
  "The battle board separates open, active, and completed matches so the state is always clear.",
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
          <Text style={styles.badge}>Habit Dueling Protocol</Text>
          <Text style={styles.title}>Turn personal discipline into a meaningful head-to-head game.</Text>
          <Text style={styles.subtitle}>
            If someone has never used blockchain before, the simple version is
            this: the app holds the wager safely, tracks the daily competition,
            and releases money by rule instead of trust.
          </Text>

          <View style={styles.heroStats}>
            <StatCard value="2 players" label="compete with clear stakes" />
            <StatCard value="24h loop" label="daily proof window" />
            <StatCard value="On-chain payout" label="final result enforced" />
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
              label="See Duel Board"
              variant="ghost"
              onPress={() => {
                void feedbackFx("soft");
                router.push("/duel");
              }}
            />
          </View>
        </SystemWindow>

        <SystemWindow style={styles.explainerWindow}>
          <Text style={styles.sectionLabel}>How To Understand It</Text>
          <View style={styles.explainerList}>
            {EXPLAINERS.map((item) => (
              <View key={item.title} style={styles.explainerCard}>
                <Text style={styles.explainerTitle}>{item.title}</Text>
                <Text style={styles.explainerCopy}>{item.copy}</Text>
              </View>
            ))}
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

        <SystemWindow style={styles.trustWindow}>
          <Text style={styles.sectionLabel}>Why It Feels Credible</Text>
          <View style={styles.trustList}>
            {TRUST_POINTS.map((point) => (
              <View key={point} style={styles.trustRow}>
                <View style={styles.trustDot} />
                <Text style={styles.trustText}>{point}</Text>
              </View>
            ))}
          </View>

          <View style={styles.finalAction}>
            <GateButton
              label="Launch First Duel"
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

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.heroStatCard}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: C.cardAlt,
  },
  heroGlow: {
    position: "absolute",
    right: -36,
    top: -28,
    width: 190,
    height: 190,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.2)",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: C.manaDim,
    borderWidth: 1,
    borderColor: C.manaBorder,
    fontFamily: "monospace",
    fontSize: 10,
    color: C.white,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  title: {
    color: C.white,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "800",
    marginBottom: 10,
  },
  subtitle: {
    color: C.slate400,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  heroStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 18,
  },
  heroStatCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  heroStatValue: {
    color: C.white,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 4,
  },
  heroStatLabel: {
    color: C.slate500,
    fontSize: 11,
    lineHeight: 16,
  },
  heroActions: {
    gap: 10,
  },
  explainerWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,183,3,0.08)",
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  explainerList: {
    gap: 10,
  },
  explainerCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  explainerTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  explainerCopy: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
  },
  flowList: {
    gap: 10,
  },
  stepCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: C.cardAlt,
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
    color: C.white,
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
  trustWindow: {
    borderColor: C.success,
    backgroundColor: C.successSoft,
  },
  trustList: {
    gap: 10,
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  trustDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: C.success,
    marginTop: 6,
  },
  trustText: {
    flex: 1,
    color: C.white,
    fontSize: 14,
    lineHeight: 21,
  },
  finalAction: {
    marginTop: 16,
  },
});
