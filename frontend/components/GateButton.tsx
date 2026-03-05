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
    paddingVertical: 14,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  primary: {
    backgroundColor: C.mana,
  },
  ghost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: C.manaBorder,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontFamily: "monospace",
    fontWeight: "900",
    fontStyle: "italic",
    fontSize: 12,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  primaryLabel: {
    color: C.black,
  },
  ghostLabel: {
    color: C.mana,
  },
});
