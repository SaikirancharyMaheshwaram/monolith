import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { C } from "./lobby-theme";

type Variant = "primary" | "ghost";

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
};

export function GateButton({
  label,
  onPress,
  variant = "primary",
  disabled,
}: Props) {
  const isGhost = variant === "ghost";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      disabled={disabled}
      style={[styles.button, isGhost ? styles.ghost : styles.primary, disabled && styles.disabled]}
    >
      <Text style={[styles.label, isGhost ? styles.ghostLabel : styles.primaryLabel]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: "100%",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  primary: {
    backgroundColor: C.mana,
    borderColor: "#ff936b",
  },
  ghost: {
    backgroundColor: C.cardAlt,
    borderColor: C.manaBorder,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontFamily: "monospace",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  primaryLabel: {
    color: C.white,
  },
  ghostLabel: {
    color: "#ffba9f",
  },
});
