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
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

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
        {/* Premium Vault Hero */}
        <View style={styles.vaultHero}>
          <View style={styles.vault3d}>
            <View style={styles.vaultCube}>
              <View style={styles.vaultFace}>
                <View style={styles.vaultDialPremium} />
              </View>
            </View>
            <View style={styles.vaultLockIcon}>
              <Feather name="lock" size={24} color={C.white} />
            </View>
          </View>
        </View>

        <View style={styles.headerCentered}>
          <Text style={styles.headerTitleText}>Redemption Vault</Text>
          <Text style={styles.headerSubtitle}>
            Your locked funds await liberation
          </Text>
        </View>

        {/* Premium Vault Amount Card */}
        <View style={styles.vaultAmountCard}>
          <View style={styles.vaultStatusBadge}>
            <Feather name="lock" size={14} color={C.white} />
            <Text style={styles.vaultStatusBadgeText}>LOCKED FUNDS</Text>
          </View>
          <View style={styles.vaultAmountRow}>
            <Text style={styles.vaultAmountValue}>
              {(vault?.lockedLamports ? vault.lockedLamports / 1e9 : 0).toFixed(
                2,
              )}
            </Text>
            <Text style={styles.vaultAmountUnit}>SOL</Text>
          </View>
          <Text style={styles.vaultSource}>Locked from past duels</Text>
          <View style={styles.vaultUnlockHint}>
            <FontAwesome5
              name="bolt"
              size={12}
              color={C.mana}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.vaultUnlockHintText}>
              Win any duel to unlock your redemption and claim back your locked
              SOL.
            </Text>
          </View>
        </View>

        <SystemWindow
          style={status === "LOCKED" ? styles.lockedWindow : styles.readyWindow}
        >
          <Text style={styles.sectionLabel}>Vault Action</Text>
          <View style={styles.redeemPanel}>
            <Text style={styles.redeemTitle}>Move Funds Back To Wallet</Text>
            <Text style={styles.redeemCopy}>
              Redeem calls the real on-chain `redeemVault` instruction.
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
      </ScrollView>
    </SafeAreaView>
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
  headerCentered: {
    alignItems: "center",
    marginBottom: 24,
  },
  headerTitleText: {
    fontFamily: "monospace" /* Display-like font equivalent available */,
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
    color:
      C.danger /* Placeholder since text gradients are tricky in plain RN text, could use standard color */,
    textAlign: "center",
  },
  headerSubtitle: {
    color: C.slate400,
    fontSize: 13,
    textAlign: "center",
  },
  vaultHero: {
    alignItems: "center",
    marginVertical: 20,
  },
  vault3d: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  vaultCube: {
    width: 60,
    height: 60,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  vaultFace: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  vaultDialPremium: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.danger,
    opacity: 0.8,
  },
  vaultLockIcon: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
  },
  vaultAmountCard: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  vaultStatusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 16,
    gap: 6,
  },
  vaultStatusBadgeText: {
    color: C.white,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  vaultAmountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 8,
  },
  vaultAmountValue: {
    color: C.white,
    fontSize: 48,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  vaultAmountUnit: {
    color: C.slate400,
    fontSize: 16,
    fontWeight: "600",
  },
  vaultSource: {
    color: C.slate500,
    fontSize: 13,
    marginBottom: 20,
  },
  vaultUnlockHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 107, 53, 0.1)",
    padding: 12,
    borderRadius: 12,
  },
  vaultUnlockHintText: {
    color: C.mana,
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
  },
  vaultStatsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },
  vaultStatBox: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  vaultStatValue: {
    fontFamily: "monospace",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  vaultStatLabel: {
    fontSize: 9,
    color: "#555",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  historyList: {
    marginTop: 8,
  },
  historyItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  historyItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  historyIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  historyTitle: {
    color: C.white,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  historyTime: {
    color: "#555",
    fontSize: 10,
  },
  historyValue: {
    color: C.success,
    fontWeight: "700",
    fontFamily: "monospace",
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
