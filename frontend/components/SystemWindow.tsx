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
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.glassBorder,
    borderRadius: 20,
    padding: 20,
    shadowColor: C.ember,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 26,
  },
});
