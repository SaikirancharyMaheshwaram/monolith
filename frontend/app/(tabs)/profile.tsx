import { CHARACTER_BY_ID } from "@/components/characters";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { useWallet } from "@/lib/use-wallet";
import { useQuery } from "convex/react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
          <Text style={styles.title}>HUNTER PROFILE</Text>
          <Text style={styles.sub}>Connect wallet to load profile.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.title}>NO PROFILE DATA</Text>
          <Text style={styles.sub}>Complete onboarding in Lobby.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const avatar = CHARACTER_BY_ID[user.selectedCharacter as keyof typeof CHARACTER_BY_ID]?.image;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow style={styles.heroWindow}>
          <View style={styles.heroRow}>
            {avatar ? <Image source={avatar} style={styles.avatar} /> : <View style={styles.avatarFallback} />}
            <View style={styles.heroMeta}>
              <Text style={styles.name}>{user.username}</Text>
              <Text style={styles.sub}>{user.tier}</Text>
              <Text style={styles.wallet} selectable>{user.walletAddress}</Text>
            </View>
          </View>
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>PROGRESSION</Text>
          <StatRow label="XP" value={String(user.xp)} />
          <StatRow label="Active Duels" value={String(user.activeDuelCount)} />
          <StatRow label="Vault Balance" value={`${user.redemptionVaultBalance.toFixed(2)} SOL`} />
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>COMBAT RECORD</Text>
          <StatRow label="Total Wins" value={String(user.totalWins)} />
          <StatRow label="Total Losses" value={String(user.totalLosses)} />
          <StatRow label="Public Wins" value={String(user.publicWins)} />
          <StatRow label="Public Losses" value={String(user.publicLosses)} />
        </SystemWindow>

        <SystemWindow>
          <Text style={styles.sectionLabel}>LOADOUT</Text>
          <StatRow label="Selected Character" value={user.selectedCharacter.toUpperCase()} />
          <StatRow label="Unlocked" value={String(user.unlockedCharacters.length)} />
          <StatRow label="Items" value={String(user.ownedItems.length)} />
        </SystemWindow>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll: { padding: 16, gap: 12, paddingBottom: 44 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
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
    marginTop: 4,
    textTransform: "uppercase",
    fontFamily: "monospace",
  },
  heroWindow: {
    borderColor: C.manaBorder,
    backgroundColor: "rgba(0,209,255,0.05)",
  },
  heroRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.manaBorder,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  heroMeta: {
    flex: 1,
  },
  name: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  wallet: {
    marginTop: 8,
    color: C.slate500,
    fontSize: 11,
    fontFamily: "monospace",
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  rowLabel: {
    color: C.slate400,
    fontSize: 12,
  },
  rowValue: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 12,
  },
});
