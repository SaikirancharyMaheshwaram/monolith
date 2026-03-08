import { StyleSheet, Text, View } from "react-native";
import { C } from "./lobby-theme";

type Props = {
  label: string;
  value: string;
  unit: string;
  valueColor?: string;
};

export function StatBlock({ label, value, unit, valueColor = C.white }: Props) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 86,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  label: {
    fontSize: 9,
    color: C.slate400,
    fontFamily: "monospace",
    letterSpacing: 1.2,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  value: {
    fontSize: 22,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  unit: {
    fontSize: 9,
    color: C.slate500,
    fontFamily: "monospace",
    marginBottom: 4,
  },
});
