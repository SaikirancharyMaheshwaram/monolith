import { Doc } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

export type DuelWithParticipants = Doc<"duels"> & {
  player1User: Doc<"users"> | null;
  player2User: Doc<"users"> | null;
};

export async function enrichDuel(
  ctx: QueryCtx,
  duel: Doc<"duels"> | null,
): Promise<DuelWithParticipants | null> {
  if (!duel) return null;

  const [player1User, player2User] = await Promise.all([
    ctx.db.get(duel.player1),
    duel.player2 ? ctx.db.get(duel.player2) : Promise.resolve(null),
  ]);

  return {
    ...duel,
    player1User,
    player2User,
  };
}

export async function enrichDuels(
  ctx: QueryCtx,
  duels: Doc<"duels">[],
): Promise<DuelWithParticipants[]> {
  return Promise.all(duels.map((duel) => enrichDuel(ctx, duel))) as Promise<
    DuelWithParticipants[]
  >;
}
