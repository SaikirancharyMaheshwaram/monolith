import { ConvexReactClient } from "convex/react";

export const convexClient = new ConvexReactClient(
  process.env.EXPO_PUBLIC_CONVEX_URL!,
);
