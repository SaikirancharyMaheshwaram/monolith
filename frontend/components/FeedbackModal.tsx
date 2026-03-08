import { C } from "@/components/lobby-theme";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type FeedbackTone = "success" | "error";

type Props = {
  visible: boolean;
  tone: FeedbackTone;
  title: string;
  message: string;
  onClose: () => void;
};

export function FeedbackModal({
  visible,
  tone,
  title,
  message,
  onClose,
}: Props) {
  const isSuccess = tone === "success";

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.card, isSuccess ? styles.successCard : styles.errorCard]}>
          <View style={[styles.badge, isSuccess ? styles.successBadge : styles.errorBadge]}>
            <Text style={[styles.badgeText, isSuccess ? styles.successBadgeText : styles.errorBadgeText]}>
              {isSuccess ? "SUCCESS" : "ERROR"}
            </Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <TouchableOpacity onPress={onClose} style={styles.button}>
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(11,6,3,0.86)",
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 10,
    backgroundColor: "rgba(35,19,9,0.98)",
  },
  successCard: {
    borderColor: C.success,
  },
  errorCard: {
    borderColor: "rgba(255,107,26,0.45)",
  },
  badge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  successBadge: {
    backgroundColor: "rgba(255,210,111,0.18)",
  },
  errorBadge: {
    backgroundColor: "rgba(255,107,26,0.18)",
  },
  badgeText: {
    fontFamily: "monospace",
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  successBadgeText: {
    color: C.success,
  },
  errorBadgeText: {
    color: C.white,
  },
  title: {
    color: C.white,
    fontSize: 22,
    fontWeight: "800",
  },
  message: {
    color: C.slate400,
    fontSize: 13,
    lineHeight: 20,
  },
  button: {
    marginTop: 8,
    borderRadius: 14,
    backgroundColor: C.mana,
    alignItems: "center",
    paddingVertical: 14,
  },
  buttonText: {
    color: C.coal,
    fontFamily: "monospace",
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
});
