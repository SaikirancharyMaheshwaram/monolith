import "../lib/polyfills";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useWalletStore } from "@/stores/use-wallet-store";
import OnboardingModal from "@/components/onboarding/onboarding-model";

export const unstable_settings = {
  anchor: "(tabs)",
};
const convex = new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
  unsavedChangesWarning: false,
});

export default function RootLayout() {
  const status = useWalletStore((s) => s.status);

  return (
    <ConvexProvider client={convex}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="modal"
          options={{ presentation: "modal", title: "Modal" }}
        />
      </Stack>
      <StatusBar style="auto" />
      {status === "onboarding" && <OnboardingModal />}
    </ConvexProvider>
  );
}
