import { ReactNode } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { C } from "./lobby-theme";

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function SystemWindow({ children, style }: Props) {
  return <View style={[styles.window, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  window: {
    backgroundColor: C.glass,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 8,
    padding: 20,
    shadowColor: C.mana,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
  },
});
