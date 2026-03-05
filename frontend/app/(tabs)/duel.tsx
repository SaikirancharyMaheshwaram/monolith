import { GateButton } from "@/components/GateButton";
import { SystemWindow } from "@/components/SystemWindow";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useWallet } from "@/lib/use-wallet";
import { useUserStore } from "@/stores/userStore";
import { useMutation, useQuery } from "convex/react";
import * as Linking from "expo-linking";
import { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STAKES = [0.1, 0.5, 1, 2];
const START_MINUTES = [10, 30, 60, 120];

export default function DuelHubScreen() {
  const wallet = useWallet();
  const publicKey = useUserStore((s) => s.walletAddress);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [stakeAmount, setStakeAmount] = useState(STAKES[2]);
  const [startInMins, setStartInMins] = useState(START_MINUTES[1]);
  const [createLoading, setCreateLoading] = useState(false);

  const createFriendDuel = useMutation(
    api.duels.createFriendDuel.createFriendDuel,
  );
  const cancelOpenDuel = useMutation(api.duels.cancelOpenDuel.cancelOpenDuel);

  const walletAddress = wallet.publicKey?.toBase58() ?? "";

  const user = useQuery(
    api.users.getUserByWallet.getUserByWallet,
    publicKey ? { walletAddress:publicKey } : "skip",
  );

  const duels = useQuery(
    api.duels.getUserDuels.getUserDuels,
    user ? { userId: user._id } : "skip",
  );

  const activeDuels = (duels ?? []).filter((d) => d.status === "ACTIVE");
  const openDuels = (duels ?? []).filter((d) => d.status === "OPEN");
  const historyDuels = (duels ?? []).filter(
    (d) =>
      d.status === "COMPLETED" ||
      d.status === "RESOLVED" ||
      d.status === "CANCELLED",
  );

  const handleCreateInvite = async () => {
    if (!walletAddress) return;

    setCreateLoading(true);
    try {
      const duelId = await createFriendDuel({
        player1: walletAddress,
        stakeAmount,
        startTime: Date.now() + startInMins * 60 * 1000,
      });

      setShowCreateModal(false);
      await shareInviteLink(String(duelId));
    } catch (error: any) {
      Alert.alert(
        "Create failed",
        error?.message ?? "Could not create duel invite",
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const shareInviteLink = async (duelId: string) => {
    const inviteUrl = Linking.createURL("/", { queryParams: { duelId } });
    await Share.share({
      message: `Join my gate: ${inviteUrl}`,
      url: inviteUrl,
    });
  };

  const handleCancelOpen = async (duel: Doc<"duels">) => {
    if (!user) return;
    try {
      await cancelOpenDuel({ duelId: duel._id, caller: user._id });
      Alert.alert("Gate cancelled", "Open duel cancelled.");
    } catch (error: any) {
      Alert.alert("Cancel failed", error?.message ?? "Could not cancel duel");
    }
  };

  // if (!wallet.connected) {
  //   return (
  //     <SafeAreaView style={styles.safeArea}>
  //       <View style={styles.centered}>
  //         <Text style={styles.header}>DUEL TERMINAL</Text>
  //         <Text style={styles.sub}>Connect wallet to view your duels.</Text>
  //       </View>
  //     </SafeAreaView>
  //   );
  // }

  // if (user === undefined || duels === undefined) {
  //   return (
  //     <SafeAreaView style={styles.safeArea}>
  //       <View style={styles.centered}>
  //         <Text style={styles.header}>SYNCING DUEL LOGS...</Text>
  //       </View>
  //     </SafeAreaView>
  //   );
  // }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <Text style={styles.header}>NO HUNTER PROFILE</Text>
          <Text style={styles.sub}>Complete registration on Home first.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SystemWindow>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionLabel}>DUEL TERMINAL</Text>
              <Text style={styles.sub}>
                {user.username} • {user.tier}
              </Text>
            </View>
            <View style={styles.livePill}>
              <Text style={styles.livePillText}>
                {activeDuels.length} ACTIVE
              </Text>
            </View>
          </View>
          <View style={styles.topActions}>
            <GateButton
              label="Invite Friend"
              onPress={() => setShowCreateModal(true)}
            />
          </View>
        </SystemWindow>

        <Section title="ACTIVE GATES" emptyText="No active gate running.">
          {activeDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              mineId={user._id}
              onShare={shareInviteLink}
            />
          ))}
        </Section>

        <Section title="OPEN INVITES" emptyText="No open invites.">
          {openDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              mineId={user._id}
              onShare={shareInviteLink}
              onCancel={handleCancelOpen}
            />
          ))}
        </Section>

        <Section title="DUEL HISTORY" emptyText="No completed duels yet.">
          {historyDuels.map((duel) => (
            <DuelCard
              key={duel._id}
              duel={duel}
              mineId={user._id}
              onShare={shareInviteLink}
              compact
            />
          ))}
        </Section>
      </ScrollView>

      <Modal transparent visible={showCreateModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>FORGE INVITE GATE</Text>

            <Text style={styles.modalLabel}>Stake</Text>
            <View style={styles.chipRow}>
              {STAKES.map((value) => {
                const selected = value === stakeAmount;
                return (
                  <Chip
                    key={value}
                    label={`${value} SOL`}
                    selected={selected}
                    onPress={() => setStakeAmount(value)}
                  />
                );
              })}
            </View>

            <Text style={styles.modalLabel}>Starts in</Text>
            <View style={styles.chipRow}>
              {START_MINUTES.map((value) => {
                const selected = value === startInMins;
                return (
                  <Chip
                    key={value}
                    label={`${value}m`}
                    selected={selected}
                    onPress={() => setStartInMins(value)}
                  />
                );
              })}
            </View>

            <View style={styles.actionStack}>
              <GateButton
                label={createLoading ? "Forging..." : "Create Invite"}
                onPress={handleCreateInvite}
                disabled={createLoading}
              />
              <GateButton
                label="Close"
                variant="ghost"
                onPress={() => setShowCreateModal(false)}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Section({
  title,
  emptyText,
  children,
}: {
  title: string;
  emptyText: string;
  children: React.ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : children ? 1 : 0;

  return (
    <SystemWindow>
      <Text style={styles.sectionLabel}>{title}</Text>
      {count === 0 ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : (
        <View style={styles.list}>{children}</View>
      )}
    </SystemWindow>
  );
}

function DuelCard({
  duel,
  mineId,
  onShare,
  onCancel,
  compact,
}: {
  duel: Doc<"duels">;
  mineId: Doc<"users">["_id"];
  onShare: (duelId: string) => Promise<void>;
  onCancel?: (duel: Doc<"duels">) => Promise<void>;
  compact?: boolean;
}) {
  const isCreator = duel.player1 === mineId;
  const showInviteActions = duel.status === "OPEN" && isCreator;

  return (
    <View style={[styles.card, compact && styles.compactCard]}>
      <View style={styles.rowBetween}>
        <Text style={styles.cardTitle}>{duel.mode} GATE</Text>
        <Text
          style={[
            styles.status,
            duel.status === "ACTIVE" && styles.statusActive,
          ]}
        >
          {duel.status}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.meta}>Stake: {duel.stakeAmount} SOL</Text>
        <Text style={styles.meta}>
          Start:{" "}
          {duel.startTime ? new Date(duel.startTime).toLocaleString() : "TBD"}
        </Text>
      </View>

      {showInviteActions ? (
        <View style={styles.inlineActions}>
          <TouchableOpacity
            onPress={() => void onShare(String(duel._id))}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonText}>Share Invite</Text>
          </TouchableOpacity>

          {onCancel ? (
            <TouchableOpacity
              onPress={() => void onCancel(duel)}
              style={styles.inlineButtonDanger}
            >
              <Text style={styles.inlineButtonText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: C.bg,
  },
  scroll: {
    padding: 16,
    gap: 12,
    paddingBottom: 44,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  header: {
    fontFamily: "monospace",
    fontSize: 13,
    letterSpacing: 2,
    color: C.mana,
    textTransform: "uppercase",
  },
  sub: {
    color: C.slate500,
    marginTop: 8,
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  sectionLabel: {
    fontFamily: "monospace",
    fontSize: 10,
    color: C.mana,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  livePill: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: C.manaDim,
  },
  livePillText: {
    color: C.mana,
    fontSize: 10,
    fontFamily: "monospace",
    letterSpacing: 1,
  },
  topActions: {
    marginTop: 10,
  },
  list: {
    gap: 10,
  },
  empty: {
    color: C.slate600,
    fontStyle: "italic",
    fontSize: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: C.glassBorder,
    backgroundColor: "rgba(255,255,255,0.02)",
    borderRadius: 6,
    padding: 12,
    gap: 8,
  },
  compactCard: {
    opacity: 0.8,
  },
  cardTitle: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 11,
    letterSpacing: 1,
  },
  status: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1,
  },
  statusActive: {
    color: C.green,
  },
  metaRow: {
    gap: 4,
  },
  meta: {
    color: C.slate400,
    fontSize: 11,
    fontFamily: "monospace",
  },
  inlineActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  inlineButton: {
    borderWidth: 1,
    borderColor: C.manaBorder,
    backgroundColor: C.manaDim,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  inlineButtonDanger: {
    borderWidth: 1,
    borderColor: C.purpleBorder,
    backgroundColor: C.purpleDim,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 4,
  },
  inlineButtonText: {
    color: C.white,
    fontFamily: "monospace",
    fontSize: 10,
    textTransform: "uppercase",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.82)",
    justifyContent: "center",
    padding: 18,
  },
  modalCard: {
    backgroundColor: "rgba(6,15,28,0.98)",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.manaBorder,
    padding: 18,
    gap: 10,
  },
  modalTitle: {
    color: C.mana,
    fontSize: 12,
    fontFamily: "monospace",
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  modalLabel: {
    color: C.slate400,
    fontSize: 11,
    fontFamily: "monospace",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 6,
  },
  chip: {
    borderWidth: 1,
    borderColor: C.slate700,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  chipSelected: {
    borderColor: C.mana,
    backgroundColor: C.manaDim,
  },
  chipText: {
    color: C.slate400,
    fontFamily: "monospace",
    fontSize: 11,
    textTransform: "uppercase",
  },
  chipTextSelected: {
    color: C.mana,
  },
  actionStack: {
    gap: 10,
  },
});
