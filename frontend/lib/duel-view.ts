import { Doc, Id } from "@/convex/_generated/dataModel";

export type DuelWithParticipants = Doc<"duels"> & {
  title?: string;
  description?: string;
  player1User?: Doc<"users"> | null;
  player2User?: Doc<"users"> | null;
};

const CONVEX_ID_PATTERN = /^[a-z0-9]+$/i;

export function toDuelId(value?: string | string[] | null): Id<"duels"> | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length < 24 || !CONVEX_ID_PATTERN.test(trimmed)) {
    return null;
  }
  return trimmed as Id<"duels">;
}

export function getParticipantLabel(
  duel: DuelWithParticipants | null | undefined,
  side: "player1" | "player2",
): string {
  if (!duel) return "Unknown";

  const profile = side === "player1" ? duel.player1User : duel.player2User;
  if (profile?.username) return `@${profile.username}`;
  if (profile?.walletAddress) return shortenWallet(profile.walletAddress);

  const fallbackId = side === "player1" ? duel.player1 : duel.player2;
  if (!fallbackId) return side === "player2" ? "Waiting for rival" : "Unknown";

  return `#${String(fallbackId).slice(0, 6)}`;
}

export function shortenWallet(value?: string | null) {
  if (!value) return "Unknown";
  if (value.length <= 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
