import { ImageSourcePropType } from "react-native";

export type CharacterId = "warrior" | "assassin" | "monk";

export type CharacterOption = {
  id: CharacterId;
  name: string;
  image: ImageSourcePropType;
};

export const CHARACTER_OPTIONS: CharacterOption[] = [
  {
    id: "warrior",
    name: "Warrior",
    image: require("@/assets/images/characters/char1.webp"),
  },
  {
    id: "assassin",
    name: "Assassin",
    image: require("@/assets/images/characters/char2.webp"),
  },
  {
    id: "monk",
    name: "Monk",
    image: require("@/assets/images/characters/char3.webp"),
  },
];

export const CHARACTER_BY_ID = CHARACTER_OPTIONS.reduce<Record<CharacterId, CharacterOption>>(
  (acc, character) => {
    acc[character.id] = character;
    return acc;
  },
  {
    warrior: CHARACTER_OPTIONS[0],
    assassin: CHARACTER_OPTIONS[1],
    monk: CHARACTER_OPTIONS[2],
  },
);
