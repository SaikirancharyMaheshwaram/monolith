import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const redeemVault = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) throw new Error("User not found");

    if (user.redemptionVaultBalance <= 0) {
      throw new Error("No funds available in redemption vault");
    }

    if (user.redemptionVaultLocked) {
      throw new Error("Vault is locked. Win a duel to unlock redemption.");
    }

    const amountRedeemed = user.redemptionVaultBalance;
    const now = Date.now();

    await ctx.db.patch(args.userId, {
      redemptionVaultBalance: 0,
      redemptionVaultRedeemedAt: now,
      redemptionVaultRedeemedTotal:
        (user.redemptionVaultRedeemedTotal ?? 0) + amountRedeemed,
    });

    return {
      amountRedeemed,
      walletAddress: user.walletAddress,
      redeemedAt: now,
    };
  },
});
