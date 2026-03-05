import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useEffect } from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STEPS = [
  { id: "01", title: "STAKE", sub: "Lock SOL before challenge" },
  { id: "02", title: "EXECUTE", sub: "Submit daily proof in duel" },
  { id: "03", title: "SETTLE", sub: "If you break, friend wins stake" },
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
          <Text style={styles.badge}>DISCIPLINE PROTOCOL</Text>
          <Text style={styles.title}>NO STAKE = NO CONSISTENCY</Text>
          <Text style={styles.subtitle}>
            We break habits when nothing is at risk. Here, your SOL is on the
            line. If you fail your plan, your friend takes the stake.
          </Text>

          <View style={styles.heroActions}>
            <GateButton
              label="Start Challenge"
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

          <View style={styles.fxRow}>
            <Text style={styles.fxDot}>●</Text>
            <Text style={styles.fxText}>FX: IMPACT + ALERT PULSE ENABLED</Text>
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>HOW IT WORKS</Text>
          <View style={styles.stepGrid}>
            {STEPS.map((step) => (
              <View key={step.id} style={styles.stepCard}>
                <Text style={styles.stepId}>{step.id}</Text>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepSub}>{step.sub}</Text>
              </View>
            ))}
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>GAME PREVIEW</Text>
          <View style={styles.imageGrid}>
            <View style={styles.imageCard}>
              <Image
                source={require("@/assets/images/icon.png")}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <Text style={styles.imageCaption}>HUNTER TERMINAL</Text>
            </View>

            <View style={styles.imageCard}>
              <Image
                source={require("@/assets/images/splash-icon.png")}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <Text style={styles.imageCaption}>DUEL GATE</Text>
            </View>
          </View>
        </SystemWindow>

        <SystemWindow style={styles.warningWindow}>
          <Text style={styles.sectionLabel}>REAL CONSEQUENCE</Text>
          <Text style={styles.rule}>• You fail discipline {"->"} you lose stake.</Text>
          <Text style={styles.rule}>• Your friend wins because they stayed consistent.</Text>
          <Text style={styles.rule}>• Outcome and payout are backend secured.</Text>

          <View style={{ marginTop: 10 }}>
            <GateButton
              label="I UNDERSTAND. ENTER"
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
  scroll: { padding: 16, gap: 12, paddingBottom: 44 },
  heroWindow: {
    borderColor: C.manaBorder,
    backgroundColor: "rgba(0,209,255,0.05)",
  },
  badge: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  title: {
    color: C.white,
    fontSize: 24,
    fontFamily: "monospace",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  heroActions: { gap: 10 },
  fxRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  fxDot: {
    color: C.green,
    fontSize: 10,
  },
  fxText: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  stepGrid: { gap: 8 },
  stepCard: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 12,
  },
  stepId: {
    color: C.purple,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    marginBottom: 2,
  },
  stepTitle: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  stepSub: {
    color: C.slate400,
    fontSize: 12,
  },
  imageGrid: {
    flexDirection: "row",
    gap: 8,
  },
  imageCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  previewImage: {
    width: "100%",
    height: 120,
    opacity: 0.85,
  },
  imageCaption: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
    textAlign: "center",
    paddingVertical: 8,
  },
  warningWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(153,69,255,0.06)",
  },
  rule: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 4,
  },
});
