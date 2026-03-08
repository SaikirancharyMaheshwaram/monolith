import { query } from "../_generated/server";

export const getOpenDuels = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    const openDuels = await ctx.db
      .query("duels")
      .withIndex("by_status", (q) => q.eq("status", "OPEN"))
      .collect();

    return openDuels.filter((duel) => !duel.player2 && (duel.startTime ?? 0) > now);
  },
});
