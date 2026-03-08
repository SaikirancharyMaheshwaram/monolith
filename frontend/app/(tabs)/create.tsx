import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/lib/use-wallet";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FLOW_STEPS = [
  {
    title: "Lose Duel",
    body: "25% of your stake is pushed into the Redemption Vault and the vault enters lock mode.",
  },
  {
    title: "Win Again",
    body: "Your next duel win breaks the lock and reopens the vault for redemption.",
  },
  {
    title: "Redeem",
    body: "Use the redeem button to release the unlocked vault balance back toward your wallet flow.",
  },
];

function formatVaultStatus(balance: number, locked: boolean) {
  if (balance <= 0) return "EMPTY";
  return locked ? "LOCKED" : "READY";
}

function formatTimestamp(value?: number) {
  return value ? new Date(value).toLocaleString() : "Not yet";
}

export default function RedemptionVaultScreen() {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const [redeemLoading, setRedeemLoading] = useState(false);

  const redeemVault = useMutation(api.users.redeemVault.redeemVault);
  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>REDEMPTION VAULT</Text>
          <Text style={styles.sub}>Connect wallet to load vault status.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>NO HUNTER PROFILE</Text>
          <Text style={styles.sub}>Create your account in the lobby first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const vaultBalance = user.redemptionVaultBalance ?? 0;
  const vaultLocked = user.redemptionVaultLocked ?? false;
  const vaultStatus = formatVaultStatus(vaultBalance, vaultLocked);
  const canRedeem = vaultBalance > 0 && !vaultLocked && !redeemLoading;

  const handleRedeem = async () => {
    setRedeemLoading(true);
    try {
      const result = await redeemVault({ userId: user._id });
      Alert.alert(
        "Vault redeemed",
        `${result.amountRedeemed.toFixed(2)} SOL was released from your redemption vault for ${result.walletAddress}.`,
      );
    } catch (error: any) {
      Alert.alert("Redeem failed", error?.message ?? "Could not redeem vault.");
    } finally {
      setRedeemLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <Text style={styles.badge}>Second Chance Economy</Text>
          <Text style={styles.heroTitle}>Your losses are trapped until you earn your comeback.</Text>
          <Text style={styles.heroSubtitle}>
            Lose a duel and part of your stake gets stored in the Redemption Vault. Win again to unlock it. Redeem once your momentum returns.
          </Text>

          <View style={styles.heroStats}>
            <VaultStat label="Vault Balance" value={`${vaultBalance.toFixed(2)} SOL`} />
            <VaultStat label="Vault Status" value={vaultStatus} highlight />
            <VaultStat label="Lifetime Redeemed" value={`${(user.redemptionVaultRedeemedTotal ?? 0).toFixed(2)} SOL`} />
          </View>
        </SystemWindow>

        <SystemWindow style={vaultLocked ? styles.lockedWindow : styles.readyWindow}>
          <Text style={styles.sectionLabel}>Vault Core</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, vaultLocked ? styles.statusBadgeLocked : styles.statusBadgeReady]}>
              <Text style={[styles.statusBadgeText, vaultLocked ? styles.statusBadgeTextLocked : styles.statusBadgeTextReady]}>
                {vaultStatus}
              </Text>
            </View>
            <Text style={styles.statusHint}>
              {vaultLocked
                ? "A fresh win is required before redemption unlocks."
                : vaultBalance > 0
                  ? "Vault is open. Redeem is available now."
                  : "No trapped funds right now."}
            </Text>
          </View>

          <View style={styles.timelineGrid}>
            <TimelineCard label="Locked At" value={formatTimestamp(user.redemptionVaultLockedAt)} />
            <TimelineCard label="Unlocked At" value={formatTimestamp(user.redemptionVaultUnlockedAt)} />
            <TimelineCard label="Last Redeem" value={formatTimestamp(user.redemptionVaultRedeemedAt)} />
          </View>

          <View style={styles.redeemPanel}>
            <Text style={styles.redeemTitle}>Redeem Window</Text>
            <Text style={styles.redeemCopy}>
              Redemption only opens after a comeback win. If the vault is locked, jump back into a duel and clear the lock with a win.
            </Text>
            <GateButton
              label={redeemLoading ? "Redeeming..." : "Redeem To Wallet"}
              onPress={handleRedeem}
              disabled={!canRedeem}
            />
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>Vault Game Loop</Text>
          <View style={styles.flowList}>
            {FLOW_STEPS.map((step, index) => (
              <View key={step.title} style={styles.flowCard}>
                <View style={styles.stepPill}>
                  <Text style={styles.stepPillText}>{index + 1}</Text>
                </View>
                <View style={styles.flowBody}>
                  <Text style={styles.flowTitle}>{step.title}</Text>
                  <Text style={styles.flowCopy}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>
        </SystemWindow>

        <SystemWindow style={styles.actionWindow}>
          <Text style={styles.sectionLabel}>Hunter Readout</Text>
          <InfoRow label="Player" value={`@${user.username}`} />
          <InfoRow label="Tier" value={user.tier} />
          <InfoRow label="Total Wins" value={String(user.totalWins)} />
          <InfoRow label="Total Losses" value={String(user.totalLosses)} />
          <InfoRow label="Wallet" value={user.walletAddress} mono />
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

function VaultStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.heroStatCard, highlight && styles.heroStatCardHighlight]}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={[styles.heroStatValue, highlight && styles.heroStatValueHighlight]}>{value}</Text>
    </View>
  );
}

function TimelineCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timelineCard}>
      <Text style={styles.timelineLabel}>{label}</Text>
      <Text style={styles.timelineValue}>{value}</Text>
    </View>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && styles.infoValueMono]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 16,
    gap: 14,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    backgroundColor: C.bg,
  },
  title: {
    color: C.mana,
    fontFamily: "monospace",
    fontSize: 14,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  sub: {
    color: C.slate400,
    fontSize: 12,
    marginTop: 6,
    textTransform: "uppercase",
    fontFamily: "monospace",
    textAlign: "center",
  },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: "rgba(42,20,8,0.97)",
  },
  heroGlow: {
    position: "absolute",
    right: -34,
    top: -32,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,138,31,0.16)",
  },
  badge: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.purple,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  heroTitle: {
    color: C.white,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 10,
    maxWidth: 580,
  },
  heroSubtitle: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  heroStats: {
    gap: 10,
  },
  heroStatCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  heroStatCardHighlight: {
    borderColor: C.manaBorder,
    backgroundColor: C.manaDim,
  },
  heroStatLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  heroStatValue: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
  },
  heroStatValueHighlight: {
    color: C.mana,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  lockedWindow: {
    borderColor: "rgba(255,107,26,0.34)",
    backgroundColor: "rgba(255,107,26,0.09)",
  },
  readyWindow: {
    borderColor: C.success,
    backgroundColor: "rgba(255,210,111,0.08)",
  },
  statusRow: {
    gap: 10,
    marginBottom: 16,
  },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusBadgeLocked: {
    backgroundColor: "rgba(255,107,26,0.16)",
    borderColor: "rgba(255,107,26,0.34)",
  },
  statusBadgeReady: {
    backgroundColor: "rgba(255,210,111,0.16)",
    borderColor: "rgba(255,210,111,0.34)",
  },
  statusBadgeText: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statusBadgeTextLocked: {
    color: C.white,
  },
  statusBadgeTextReady: {
    color: C.coal,
  },
  statusHint: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
  },
  timelineGrid: {
    gap: 10,
  },
  timelineCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  timelineLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  timelineValue: {
    color: C.white,
    fontSize: 13,
    lineHeight: 20,
  },
  redeemPanel: {
    marginTop: 16,
    gap: 10,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "rgba(35,19,9,0.4)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  redeemTitle: {
    color: C.white,
    fontSize: 18,
    fontWeight: "700",
  },
  redeemCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  flowList: {
    gap: 10,
  },
  flowCard: {
    flexDirection: "row",
    gap: 12,
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  stepPill: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.mana,
  },
  stepPillText: {
    color: C.coal,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  flowBody: {
    flex: 1,
    gap: 4,
  },
  flowTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: "700",
  },
  flowCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  actionWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  infoLabel: {
    color: C.slate400,
    fontSize: 12,
  },
  infoValue: {
    flex: 1,
    textAlign: "right",
    color: C.white,
    fontSize: 12,
  },
  infoValueMono: {
    fontFamily: "monospace",
    fontSize: 11,
  },
});
