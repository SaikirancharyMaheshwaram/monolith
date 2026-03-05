import { query } from "../_generated/server";
import { v } from "convex/values";

export const getDuelProgress = query({
  args: {
    duelId: v.id("duels"),
  },

  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.duelId);

    if (!duel) throw new Error("Duel not found");

    const submissions = await ctx.db
      .query("submissions")
      .filter((q) => q.eq(q.field("duelId"), args.duelId))
      .collect();

    const p1Days: number[] = [];
    const p2Days: number[] = [];

    for (const s of submissions) {
      if (s.player === duel.player1) p1Days.push(s.dayNumber);
      if (s.player === duel.player2) p2Days.push(s.dayNumber);
    }

    return {
      player1: duel.player1,
      player2: duel.player2,
      p1Days,
      p2Days,
    };
  },
});
