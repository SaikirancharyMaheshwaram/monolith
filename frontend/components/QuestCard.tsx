import { StyleSheet, Text, View } from "react-native";
import { GateButton } from "./GateButton";
import { HunterAvatar } from "./HunterAvatar";
import { ProgressBar } from "./ProgressBar";
import { SystemWindow } from "./SystemWindow";
import { C } from "./lobby-theme";

type Props = {
  title: string;
  opponentName: string;
  stakeLabel: string;
  progress: number;
  isLive?: boolean;
  onEnter: () => void;
};

export function QuestCard({
  title,
  opponentName,
  stakeLabel,
  progress,
  isLive,
  onEnter,
}: Props) {
  return (
    <SystemWindow style={styles.activeQuestBg}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.questTag}>STREAK QUEST</Text>
          <Text style={styles.questTitle}>{title}</Text>
        </View>
        {isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.opponentRow}>
        <HunterAvatar />

        <View style={styles.opponentInfo}>
          <View style={styles.rowBetween}>
            <Text style={styles.opponentName}>Rival: {opponentName}</Text>
            <Text style={styles.stakeAmount}>{stakeLabel}</Text>
          </View>
          <ProgressBar progress={progress} />
          <Text style={styles.progressLabel}>{Math.round(progress * 100)}% duel progress</Text>
        </View>
      </View>

      <GateButton label="Open Duel Board" onPress={onEnter} />
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  activeQuestBg: {
    backgroundColor: "rgba(255,138,31,0.08)",
    borderColor: C.manaBorder,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  questTag: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.purple,
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 1.2,
  },
  questTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 0.5,
  },
  liveBadge: {
    backgroundColor: C.success,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  liveBadgeText: {
    color: C.coal,
    fontSize: 9,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  opponentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginVertical: 20,
  },
  opponentInfo: {
    flex: 1,
    gap: 6,
  },
  opponentName: {
    fontSize: 10,
    color: C.slate400,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stakeAmount: {
    fontSize: 10,
    color: C.mana,
  },
  progressLabel: {
    fontSize: 10,
    color: C.slate500,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
