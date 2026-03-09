import { v } from "convex/values";
import { query } from "../_generated/server";
import { enrichDuel } from "./helpers";

export const getDuelById = query({
  args: { id: v.id("duels") },
  handler: async (ctx, args) => {
    const duel = await ctx.db.get(args.id);
    return enrichDuel(ctx, duel);
  },
});
