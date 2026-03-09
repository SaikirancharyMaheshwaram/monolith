import { ImageSourcePropType } from "react-native";
import { Buffer } from "buffer";

type CharacterOptionInput = {
  id: string;
  name: string;
  svg: string;
  accent: string;
};

function svgToDataUri(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const CHARACTER_INPUTS: CharacterOptionInput[] = [
  {
    id: "samurai",
    name: "Samurai",
    accent: "#ff6b35",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="samu" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#2d2d2d"/><stop offset="100%" stop-color="#1a1a1a"/></linearGradient></defs><path d="M50 10 L20 40 L30 90 L70 90 L80 40 Z" fill="url(#samu)"/><path d="M50 10 L40 30 L60 30 Z" fill="#B22222"/><circle cx="50" cy="55" r="20" fill="#F5F5DC"/><circle cx="42" cy="52" r="2" fill="#333"/><circle cx="58" cy="52" r="2" fill="#333"/><path d="M44 65 L50 62 L56 65" fill="none" stroke="#B22222" stroke-width="2"/></svg>`,
  },
  {
    id: "lion",
    name: "Lion",
    accent: "#ffd700",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD700"/><stop offset="100%" stop-color="#FF8C00"/></linearGradient></defs><circle cx="50" cy="50" r="40" fill="url(#lg1)"/><circle cx="50" cy="55" r="25" fill="#FFF5E6"/><circle cx="40" cy="50" r="3" fill="#333"/><circle cx="60" cy="50" r="3" fill="#333"/><ellipse cx="50" cy="58" rx="4" ry="3" fill="#333"/><path d="M45 63 Q50 67 55 63" fill="none" stroke="#333" stroke-width="1.5"/></svg>`,
  },
  {
    id: "wolf",
    name: "Wolf",
    accent: "#94a3b8",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,10 20,50 30,85 70,85 80,50" fill="#4a5568"/><polygon points="50,10 30,30 50,35" fill="#2d3748"/><polygon points="50,10 70,30 50,35" fill="#2d3748"/><circle cx="50" cy="55" r="20" fill="#e2e8f0"/><circle cx="42" cy="50" r="3" fill="#333"/><circle cx="58" cy="50" r="3" fill="#333"/><ellipse cx="50" cy="58" rx="4" ry="3" fill="#333"/></svg>`,
  },
  {
    id: "fox",
    name: "Fox",
    accent: "#fb923c",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><polygon points="50,15 15,55 25,80 75,80 85,55" fill="#ed8936"/><polygon points="50,15 25,35 50,40" fill="#fff"/><polygon points="50,15 75,35 50,40" fill="#fff"/><circle cx="50" cy="55" r="18" fill="#fff"/><circle cx="42" cy="52" r="2.5" fill="#333"/><circle cx="58" cy="52" r="2.5" fill="#333"/><ellipse cx="50" cy="58" rx="3" ry="2" fill="#333"/></svg>`,
  },
  {
    id: "dragon",
    name: "Dragon",
    accent: "#a855f7",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="dg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#9f7aea"/><stop offset="100%" stop-color="#6b46c1"/></linearGradient></defs><circle cx="50" cy="50" r="38" fill="url(#dg1)"/><path d="M25 25 L35 40 L25 45" fill="#6b46c1"/><path d="M75 25 L65 40 L75 45" fill="#6b46c1"/><circle cx="50" cy="55" r="22" fill="#e9d8fd"/><circle cx="42" cy="52" r="4" fill="#333"/><circle cx="58" cy="52" r="4" fill="#333"/><circle cx="42" cy="51" r="1.5" fill="#fff"/><circle cx="58" cy="51" r="1.5" fill="#fff"/></svg>`,
  },
  {
    id: "phoenix",
    name: "Phoenix",
    accent: "#f97316",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="pg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#f56565"/><stop offset="100%" stop-color="#ed8936"/></linearGradient></defs><circle cx="50" cy="50" r="38" fill="url(#pg1)"/><path d="M50 10 L45 30 L55 30 Z" fill="#fbd38d"/><path d="M40 15 L42 32 L48 30 Z" fill="#f6ad55"/><path d="M60 15 L58 32 L52 30 Z" fill="#f6ad55"/><circle cx="50" cy="55" r="20" fill="#fef3c7"/><circle cx="42" cy="52" r="3" fill="#333"/><circle cx="58" cy="52" r="3" fill="#333"/></svg>`,
  },
  {
    id: "hawk",
    name: "Hawk",
    accent: "#facc15",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="38" fill="#718096"/><path d="M50 25 L45 40 L55 40 Z" fill="#f6e05e"/><circle cx="50" cy="55" r="22" fill="#e2e8f0"/><circle cx="40" cy="50" r="4" fill="#333"/><circle cx="60" cy="50" r="4" fill="#333"/><path d="M45 62 L50 58 L55 62" fill="#f6e05e"/></svg>`,
  },
  {
    id: "bear",
    name: "Bear",
    accent: "#b45309",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#8b5a2b"/><circle cx="25" cy="30" r="10" fill="#8b5a2b"/><circle cx="75" cy="30" r="10" fill="#8b5a2b"/><circle cx="50" cy="55" r="25" fill="#d2b48c"/><circle cx="40" cy="48" r="3" fill="#333"/><circle cx="60" cy="48" r="3" fill="#333"/><ellipse cx="50" cy="58" rx="6" ry="4" fill="#333"/></svg>`,
  },
  {
    id: "shadowpanther",
    name: "ShadowPanther",
    accent: "#7c3aed",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="shadow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#4B0082"/><stop offset="100%" stop-color="#000"/></radialGradient></defs><polygon points="50,15 15,50 25,95 75,95 85,50" fill="url(#shadow)"/><polygon points="30,35 20,10 40,25" fill="#2d004d"/><polygon points="70,35 80,10 60,25" fill="#2d004d"/><circle cx="50" cy="55" r="20" fill="#1a0033"/><circle cx="42" cy="52" r="3" fill="#FFFF00"/><circle cx="58" cy="52" r="3" fill="#FFFF00"/><path d="M42 65 Q50 70 58 65" fill="none" stroke="#FFFF00" stroke-width="1.5"/></svg>`,
  },
  {
    id: "firespirit",
    name: "FireSpirit",
    accent: "#ef4444",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><path d="M50 5 C25 25 25 50 30 75 C35 95 65 95 70 75 C75 50 75 25 50 5 Z" fill="#FF4500"/><path d="M50 20 C35 35 40 55 45 70 C50 85 55 85 60 70 C65 55 65 35 50 20 Z" fill="#FFD700"/><circle cx="40" cy="50" r="4" fill="#FFF"/><circle cx="60" cy="50" r="4" fill="#FFF"/><path d="M45 70 Q50 75 55 70" fill="none" stroke="#333" stroke-width="2"/></svg>`,
  },
  {
    id: "moonrabbit",
    name: "MoonRabbit",
    accent: "#c084fc",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="55" r="35" fill="#DCD0FF"/><ellipse cx="38" cy="25" rx="10" ry="25" fill="#DCD0FF"/><ellipse cx="62" cy="25" rx="10" ry="25" fill="#DCD0FF"/><ellipse cx="35" cy="25" rx="8" ry="20" fill="#B7A8FF"/><ellipse cx="65" cy="25" rx="8" ry="20" fill="#B7A8FF"/><circle cx="40" cy="55" r="4" fill="#333"/><circle cx="60" cy="55" r="4" fill="#333"/><path d="M45 65 Q50 68 55 65" fill="none" stroke="#333" stroke-width="2"/><circle cx="50" cy="75" r="8" fill="#FFF" opacity="0.3"/></svg>`,
  },
  {
    id: "tiger",
    name: "Tiger",
    accent: "#fb923c",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40" fill="#FF8C00"/><circle cx="50" cy="55" r="25" fill="#FFF"/><path d="M35 35 L50 45 L65 35" fill="#FF8C00"/><circle cx="40" cy="50" r="3" fill="#333"/><circle cx="60" cy="50" r="3" fill="#333"/><path d="M45 60 Q50 64 55 60" fill="none" stroke="#333" stroke-width="2"/><path d="M30 40 L25 30" stroke="#333" stroke-width="2"/><path d="M70 40 L75 30" stroke="#333" stroke-width="2"/></svg>`,
  },
  {
    id: "snake",
    name: "Snake",
    accent: "#22c55e",
    svg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="35" fill="#48bb78"/><circle cx="50" cy="55" r="25" fill="#9ae6b4"/><circle cx="42" cy="50" r="2.5" fill="#333"/><circle cx="58" cy="50" r="2.5" fill="#333"/><path d="M46 60 Q50 64 54 60" fill="none" stroke="#333" stroke-width="1.5"/><path d="M49 64 L50 70 L51 64" fill="#ef4444"/></svg>`,
  },
];

export type CharacterId = string;

export type CharacterOption = {
  id: CharacterId;
  name: string;
  accent: string;
  svg: string;
  image: ImageSourcePropType;
  imageUri: string;
};

export const CHARACTER_OPTIONS: CharacterOption[] = CHARACTER_INPUTS.map((item) => {
  const imageUri = svgToDataUri(item.svg);
  return {
    ...item,
    imageUri,
    image: { uri: imageUri },
  };
});

const CHARACTER_ALIASES: Record<string, CharacterId> = {
  warrior: "samurai",
  assassin: "shadowpanther",
  monk: "moonrabbit",
};

export const CHARACTER_BY_ID = CHARACTER_OPTIONS.reduce<Record<string, CharacterOption>>(
  (acc, character) => {
    acc[character.id] = character;
    return acc;
  },
  {},
);

Object.entries(CHARACTER_ALIASES).forEach(([legacyId, nextId]) => {
  CHARACTER_BY_ID[legacyId] = CHARACTER_BY_ID[nextId];
});

export function resolveCharacterOption(id?: string | null) {
  if (!id) return CHARACTER_OPTIONS[0];
  return CHARACTER_BY_ID[id] ?? CHARACTER_BY_ID[id.toLowerCase()] ?? CHARACTER_OPTIONS[0];
}
