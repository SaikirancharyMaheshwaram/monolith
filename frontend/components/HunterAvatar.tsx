import { Image, StyleSheet, Text, View } from "react-native";
import { C } from "./lobby-theme";

type Props = {
  imageUri?: string;
  rank?: string;
};

const DEFAULT_AVATAR =
  "https://image.qwenlm.ai/public_source/88e32e3c-f628-4cca-94e1-fbf7f5151fe2/16f959403-6ea3-4d97-9b96-072e7df050eb.png";

export function HunterAvatar({ imageUri = DEFAULT_AVATAR, rank = "B-RANK" }: Props) {
  return (
    <View style={styles.wrapper}>
      <Image source={{ uri: imageUri }} style={styles.avatar} />
      <View style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>{rank}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    width: 48,
    height: 48,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: C.manaBorder,
    opacity: 0.75,
  },
  rankBadge: {
    position: "absolute",
    bottom: -6,
    right: -6,
    backgroundColor: C.black,
    borderWidth: 1,
    borderColor: C.mana,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rankBadgeText: {
    color: C.mana,
    fontSize: 7,
    fontFamily: "monospace",
  },
});
