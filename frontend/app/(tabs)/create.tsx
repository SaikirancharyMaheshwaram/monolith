import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { useWallet } from "@/lib/use-wallet";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const FLOW_STEPS = [
  "Connect wallet and create a challenge with SOL escrow.",
  "Enter battle and keep up daily check-ins until resolution.",
  "Withdraw if your redemption vault is open, or win the next duel to unlock it.",
];

type VaultSnapshot = {
  vaultAddress: string;
  exists: boolean;
  owner: string | null;
  isLocked: boolean;
  lockedLamports: number;
  balanceSol: number;
  accountLamports: number;
};

function formatStatus(snapshot: VaultSnapshot | null) {
  if (!snapshot?.exists || snapshot.lockedLamports <= 0) return "EMPTY";
  return snapshot.isLocked ? "LOCKED" : "READY";
}

function shortAddress(value: string | null) {
  if (!value) return "Unavailable";
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export default function RedemptionVaultScreen() {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";
  const connected = wallet.connected;
  const sending = wallet.sending;
  const getRedemptionVaultInfo = wallet.getRedemptionVaultInfo;
  const redeemVault = wallet.redeemVault;
  const getBalance = wallet.getBalance;

  const [vault, setVault] = useState<VaultSnapshot | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loadingVault, setLoadingVault] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );

  const loadVault = useCallback(async () => {
    if (!connected) {
      setVault(null);
      setWalletBalance(null);
      return;
    }

    setLoadingVault(true);
    try {
      const [vaultInfo, balance] = await Promise.all([
        getRedemptionVaultInfo(),
        getBalance(),
      ]);
      setVault(vaultInfo);
      setWalletBalance(balance);
    } catch (error) {
      console.error("Failed to load redemption vault", error);
      Alert.alert(
        "Vault load failed",
        "Could not load on-chain redemption vault state.",
      );
    } finally {
      setLoadingVault(false);
    }
  }, [connected, getBalance, getRedemptionVaultInfo]);

  useEffect(() => {
    void loadVault();
  }, [loadVault, walletAddress]);

  const handleRedeem = async () => {
    setRedeeming(true);
    try {
      const result = await redeemVault();
      await loadVault();
      Alert.alert(
        "Redeemed",
        `${result.redeemedSol.toFixed(4)} SOL was sent from your redemption vault to your wallet.`,
      );
    } catch (error: any) {
      Alert.alert(
        "Redeem failed",
        error?.message ?? "Could not redeem the vault.",
      );
    } finally {
      setRedeeming(false);
    }
  };

  if (!connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>REDEMPTION VAULT</Text>
          <Text style={styles.sub}>
            Connect wallet to load your on-chain vault.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const status = formatStatus(vault);
  const canRedeem =
    !!vault?.exists &&
    vault.lockedLamports > 0 &&
    !vault.isLocked &&
    !redeeming &&
    !sending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={loadingVault}
            onRefresh={() => {
              void loadVault();
            }}
            tintColor={C.mana}
          />
        }
      >
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <Text style={styles.badge}>Vault Control</Text>
          <Text style={styles.heroTitle}>
            Your redemption vault is the safety layer behind lost duels.
          </Text>
          <Text style={styles.heroSubtitle}>
            This page reads the real on-chain vault PDA. If it is unlocked, you
            can withdraw immediately. If it is locked, the next duel win is
            what opens recovery access.
          </Text>

          <View style={styles.heroStats}>
            <StatCard
              label="Vault Balance"
              value={`${(vault?.balanceSol ?? 0).toFixed(4)} SOL`}
            />
            <StatCard label="Vault Status" value={status} highlight />
            <StatCard
              label="Wallet Balance"
              value={
                walletBalance === null
                  ? "..."
                  : `${walletBalance.toFixed(4)} SOL`
              }
            />
          </View>
        </SystemWindow>

        <SystemWindow
          style={status === "LOCKED" ? styles.lockedWindow : styles.readyWindow}
        >
          <Text style={styles.sectionLabel}>Vault State</Text>
          <View style={styles.statusWrap}>
            <View
              style={[
                styles.statusPill,
                status === "LOCKED"
                  ? styles.statusPillLocked
                  : styles.statusPillReady,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  status === "LOCKED"
                    ? styles.statusPillTextLocked
                    : styles.statusPillTextReady,
                ]}
              >
              {status}
            </Text>
          </View>
          <Text style={styles.statusCopy}>
              {status === "LOCKED"
                ? "Funds are trapped in the redemption vault. Win the next duel to unlock them."
                : status === "READY"
                  ? "Vault is unlocked. Redeem now to move funds back to your wallet."
                  : "No locked recovery funds found in your vault PDA."}
            </Text>
          </View>

          <View style={styles.grid}>
            <InfoCard
              label="Vault PDA"
              value={vault?.vaultAddress ?? "Loading..."}
              mono
            />
            <InfoCard
              label="Vault Owner"
              value={vault?.owner ?? walletAddress}
              mono
            />
            <InfoCard
              label="Locked Lamports"
              value={String(vault?.lockedLamports ?? 0)}
              mono
            />
            <InfoCard
              label="Account Exists"
              value={vault?.exists ? "Yes" : "No"}
            />
          </View>

          <View style={styles.redeemPanel}>
            <Text style={styles.redeemTitle}>Move Funds Back To Wallet</Text>
            <Text style={styles.redeemCopy}>
              Redeem calls the real on-chain `redeemVault` instruction. This is
              not a simulated dashboard action.
            </Text>
            <View style={styles.actionStack}>
              <GateButton
                label={redeeming ? "Redeeming..." : "Redeem To Wallet"}
                onPress={handleRedeem}
                disabled={!canRedeem}
              />
              <GateButton
                label={loadingVault ? "Refreshing..." : "Refresh Vault"}
                variant="ghost"
                onPress={() => {
                  void loadVault();
                }}
                disabled={loadingVault || redeeming}
              />
            </View>
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>Game Flow</Text>
          <View style={styles.flowList}>
            {FLOW_STEPS.map((step, index) => (
              <View key={step} style={styles.flowRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.flowText}>{step}</Text>
              </View>
            ))}
          </View>
        </SystemWindow>

        <SystemWindow style={styles.metaWindow}>
          <Text style={styles.sectionLabel}>Hunter Readout</Text>
          <Row
            label="Player"
            value={user ? `@${user.username}` : "Profile missing"}
          />
          <Row label="Tier" value={user?.tier ?? "Unsynced"} />
          <Row label="Wallet" value={walletAddress} mono />
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlight && styles.statCardHighlight]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>
        {value}
      </Text>
    </View>
  );
}

function InfoCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoCardLabel}>{label}</Text>
      <Text
        style={[styles.infoCardValue, mono && styles.mono]}
        numberOfLines={2}
      >
        {mono ? (shortAddress(value) === "Unavailable" ? value : value) : value}
      </Text>
    </View>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, mono && styles.mono]} numberOfLines={1}>
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
    backgroundColor: C.cardAlt,
  },
  heroGlow: {
    position: "absolute",
    right: -34,
    top: -32,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.2)",
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
  statCard: {
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  statCardHighlight: {
    backgroundColor: C.manaDim,
    borderColor: C.manaBorder,
  },
  statLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  statValue: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
  },
  statValueHighlight: {
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
    borderColor: "rgba(255,75,75,0.34)",
    backgroundColor: C.dangerSoft,
  },
  readyWindow: {
    borderColor: C.success,
    backgroundColor: C.successSoft,
  },
  statusWrap: {
    gap: 10,
    marginBottom: 16,
  },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillLocked: {
    backgroundColor: C.dangerSoft,
    borderColor: "rgba(255,75,75,0.34)",
  },
  statusPillReady: {
    backgroundColor: C.successSoft,
    borderColor: "rgba(0,245,160,0.34)",
  },
  statusPillText: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statusPillTextLocked: {
    color: C.danger,
  },
  statusPillTextReady: {
    color: C.success,
  },
  statusCopy: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
  },
  grid: {
    gap: 10,
  },
  infoCard: {
    borderRadius: 14,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  infoCardLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  infoCardValue: {
    color: C.white,
    fontSize: 13,
    lineHeight: 19,
  },
  mono: {
    fontFamily: "monospace",
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
  actionStack: {
    gap: 10,
  },
  flowList: {
    gap: 10,
  },
  flowRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.03)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.mana,
  },
  stepBadgeText: {
    color: C.coal,
    fontFamily: "monospace",
    fontWeight: "800",
  },
  flowText: {
    flex: 1,
    color: C.slate400,
    fontSize: 13,
    lineHeight: 19,
  },
  metaWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,179,71,0.08)",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLabel: {
    color: C.slate400,
    fontSize: 12,
  },
  rowValue: {
    flex: 1,
    textAlign: "right",
    color: C.white,
    fontSize: 12,
  },
});
