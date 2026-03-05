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
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text style={[styles.value, { color: valueColor }]}>{value}</Text>
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontSize: 9,
    color: C.slate400,
    fontFamily: "monospace",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    fontFamily: "monospace",
  },
  unit: {
    fontSize: 9,
    color: C.slate600,
    fontFamily: "monospace",
    marginBottom: 4,
  },
});
