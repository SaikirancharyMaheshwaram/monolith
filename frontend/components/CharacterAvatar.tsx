import { resolveCharacterOption } from "@/components/characters";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

type CharacterAvatarProps = {
  characterId?: string | null;
  size?: number;
  label?: string | null;
};

export function CharacterAvatar({
  characterId,
  size = 64,
  label,
}: CharacterAvatarProps) {
  const character = resolveCharacterOption(characterId);
  const fallback = (label ?? character.name).slice(0, 1).toUpperCase();

  return (
    <View
      style={[
        styles.shell,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          shadowColor: character.accent,
        },
      ]}
    >
      <View
        style={[
          styles.glow,
          {
            borderRadius: size / 2,
            backgroundColor: `${character.accent}22`,
          },
        ]}
      />
      <Image
        source={{ uri: character.imageUri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="contain"
        transition={120}
      />
      <View style={styles.fallback}>
        <Text style={styles.fallbackText}>{fallback}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#0f0f13",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    opacity: 0,
  },
  fallbackText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 22,
  },
});
