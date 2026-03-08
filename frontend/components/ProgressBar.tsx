import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { C } from "./lobby-theme";

type Props = {
  progress: number;
  animated?: boolean;
};

export function ProgressBar({ progress, animated = true }: Props) {
  const p = Math.max(0, Math.min(progress, 1));
  const width = useRef(new Animated.Value(p)).current;

  useEffect(() => {
    if (!animated) {
      width.setValue(p);
      return;
    }

    Animated.timing(width, {
      toValue: p,
      duration: 350,
      useNativeDriver: false,
    }).start();
  }, [animated, p, width]);

  const fillWidth = width.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width: fillWidth }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: "100%",
    height: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: C.mana,
    borderRadius: 99,
    shadowColor: C.ember,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
  },
});
