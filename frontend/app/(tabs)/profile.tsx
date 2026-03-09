import { CharacterAvatar } from "@/components/CharacterAvatar";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/lib/use-wallet";
import { useQuery } from "convex/react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

function shortAddress(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export default function ProfileScreen() {
  const wallet = useWallet();
  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    walletAddress ? { walletAddress } : "skip",
  );

  if (!wallet.connected) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>Profile Locked</Text>
          <Text style={styles.stateCopy}>
            Connect wallet to load your hunter identity, duel record, and vault
            standing.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.stateTitle}>No Profile Data</Text>
          <Text style={styles.stateCopy}>
            Complete registration from the lobby before opening the profile.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalMatches = user.totalWins + user.totalLosses;
  const winRate =
    totalMatches > 0 ? `${Math.round((user.totalWins / totalMatches) * 100)}%` : "0%";
  const level = String(Math.floor(user.xp / 100) + 1).padStart(2, "0");

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTopRow}>
            <CharacterAvatar
              characterId={user.selectedCharacter}
              label={user.username}
              size={96}
            />

            <View style={styles.identityBlock}>
              <Text style={styles.badge}>Hunter Profile</Text>
              <Text style={styles.name}>{user.username}</Text>
              <Text style={styles.tier}>{user.tier}</Text>
              <Text style={styles.wallet}>{shortAddress(user.walletAddress)}</Text>
            </View>

            <View style={styles.levelCard}>
              <Text style={styles.levelValue}>LV {level}</Text>
              <Text style={styles.levelLabel}>current level</Text>
            </View>
          </View>

          <View style={styles.heroStats}>
            <HeroStat label="XP" value={String(user.xp)} />
            <HeroStat label="Win Rate" value={winRate} />
            <HeroStat label="Active Duels" value={String(user.activeDuelCount)} />
            <HeroStat
              label="Vault"
              value={`${user.redemptionVaultBalance.toFixed(2)} SOL`}
            />
          </View>
        </SystemWindow>

        <SystemWindow style={styles.recordWindow}>
          <Text style={styles.sectionLabel}>Combat Record</Text>
          <View style={styles.recordGrid}>
            <RecordCard label="Total Wins" value={String(user.totalWins)} />
            <RecordCard label="Total Losses" value={String(user.totalLosses)} />
            <RecordCard label="Public Wins" value={String(user.publicWins)} />
            <RecordCard label="Public Losses" value={String(user.publicLosses)} />
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>Identity</Text>
          <StatRow label="Wallet Address" value={user.walletAddress} mono />
          <StatRow
            label="Selected Character"
            value={user.selectedCharacter.toUpperCase()}
          />
          <StatRow
            label="Unlocked Characters"
            value={String(user.unlockedCharacters.length)}
          />
          <StatRow label="Owned Items" value={String(user.ownedItems.length)} />
        </SystemWindow>

        <SystemWindow style={styles.vaultWindow}>
          <Text style={styles.sectionLabel}>Vault Standing</Text>
          <Text style={styles.vaultLead}>
            Redemption vault balance represents the recovery amount tied to duel
            outcomes. If it is locked, the next win is what matters.
          </Text>
          <View style={styles.vaultPill}>
            <Text style={styles.vaultPillText}>
              {user.redemptionVaultLocked ? "Locked" : "Available"}
            </Text>
          </View>
          <View style={styles.recordGrid}>
            <RecordCard
              label="Redeemed Total"
              value={`${user.redemptionVaultRedeemedTotal.toFixed(2)} SOL`}
            />
            <RecordCard
              label="Current Balance"
              value={`${user.redemptionVaultBalance.toFixed(2)} SOL`}
            />
          </View>
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStatCard}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

function RecordCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordLabel}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

function StatRow({
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
      <Text style={[styles.rowValue, mono && styles.rowValueMono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 14, paddingBottom: 44 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  stateTitle: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
  },
  stateCopy: {
    marginTop: 8,
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  heroWindow: {
    overflow: "hidden",
    borderColor: C.manaBorder,
    backgroundColor: C.cardAlt,
  },
  heroGlow: {
    position: "absolute",
    top: -34,
    right: -22,
    width: 170,
    height: 170,
    borderRadius: 999,
    backgroundColor: "rgba(255,107,53,0.2)",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  identityBlock: {
    flex: 1,
    gap: 4,
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: C.manaDim,
    borderWidth: 1,
    borderColor: C.manaBorder,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: C.white,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  name: {
    color: C.white,
    fontSize: 24,
    fontWeight: "800",
  },
  tier: {
    color: C.success,
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  wallet: {
    color: C.slate500,
    fontSize: 12,
    fontFamily: "monospace",
  },
  levelCard: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  levelValue: {
    color: C.white,
    fontSize: 20,
    fontWeight: "800",
    fontFamily: "monospace",
  },
  levelLabel: {
    color: C.slate500,
    fontSize: 10,
    fontFamily: "monospace",
    textTransform: "uppercase",
  },
  heroStats: {
    marginTop: 18,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  heroStatCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  heroStatLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  heroStatValue: {
    color: C.white,
    fontSize: 18,
    fontWeight: "800",
  },
  recordWindow: {
    borderColor: C.purpleBorder,
    backgroundColor: "rgba(255,183,3,0.08)",
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  recordGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  recordCard: {
    minWidth: "47%",
    flexGrow: 1,
    borderRadius: 16,
    padding: 14,
    backgroundColor: C.cardAlt,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },
  recordLabel: {
    color: C.slate500,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  recordValue: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLabel: {
    color: C.slate500,
    fontSize: 12,
  },
  rowValue: {
    flexShrink: 1,
    textAlign: "right",
    color: C.white,
    fontSize: 12,
  },
  rowValueMono: {
    fontFamily: "monospace",
  },
  vaultWindow: {
    borderColor: C.success,
    backgroundColor: C.successSoft,
  },
  vaultLead: {
    color: C.slate400,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 12,
  },
  vaultPill: {
    alignSelf: "flex-start",
    marginBottom: 14,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  vaultPillText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
