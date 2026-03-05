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
          <Text style={styles.questTag}>[ DAILY QUEST ]</Text>
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
            <Text style={styles.opponentName}>Opponent: {opponentName}</Text>
            <Text style={styles.stakeAmount}>{stakeLabel}</Text>
          </View>
          <ProgressBar progress={progress} />
        </View>
      </View>

      <GateButton label="Enter The Gate" onPress={onEnter} />
    </SystemWindow>
  );
}

const styles = StyleSheet.create({
  activeQuestBg: {
    backgroundColor: "rgba(0,209,255,0.05)",
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
    color: C.mana,
    textTransform: "uppercase",
    marginBottom: 4,
    letterSpacing: 1,
  },
  questTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: C.white,
    letterSpacing: 1,
  },
  liveBadge: {
    backgroundColor: C.mana,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 2,
  },
  liveBadgeText: {
    color: C.black,
    fontSize: 8,
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
    fontStyle: "italic",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stakeAmount: {
    fontSize: 10,
    color: C.mana,
  },
});
