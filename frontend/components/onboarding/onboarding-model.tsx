import { useState } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  FlatList,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import { useMutation } from "convex/react";

import { useWalletStore } from "@/stores/use-wallet-store";
import { api } from "@/convex/_generated/api";
import { KeyboardAvoidingView, Platform } from "react-native";
import { ThemedText } from "../themed-text";
const CHARACTERS = [
  { id: "warrior", name: "Warrior" },
  { id: "assassin", name: "Assassin" },
  { id: "monk", name: "Monk" },
];

export default function OnboardingModal() {
  const [isVisible, setIsVisible] = useState(true);
  const createUser = useMutation(api.users.createUser.createUser);

  const publicKey = useWalletStore((s) => s.publicKey);
  const setStatus = useWalletStore((s) => s.setStatus);

  const [username, setUsername] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState("warrior");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // async function handleCreate() {
  //   if (!publicKey) return;
  //   if (username.length < 3) return;

  //   setLoading(true);

  //   try {
  //     await createUser({
  //       walletAddress: publicKey.toBase58(),
  //       username,
  //       selectedCharacter,
  //     });

  //     setStatus("authenticated");
  //   } catch (err) {
  //     console.error(err);
  //   } finally {
  //     setLoading(false);
  //   }
  // }
  //
  async function handleCreate() {
    if (!publicKey) return;
    if (username.length < 3) return;
    setLoading(true);
    try {
      setError("");
      const result = await createUser({
        walletAddress: publicKey.toBase58(),
        username,
        selectedCharacter,
      });

      setStatus("authenticated");
      setIsVisible(false);
    } catch (err) {
      console.error(err);
      setError("Username already taken");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1 }}
    >
      <Modal transparent animationType="fade" visible={isVisible}>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <View style={styles.container}>
              <Text style={styles.title}>Enter the Arena</Text>

              <Text style={styles.label}>Choose Username</Text>

              <TextInput
                placeholder="username"
                value={username}
                onChangeText={setUsername}
                style={styles.input}
              />
              <ThemedText style={{marginBottom:5}}>{error ? error : ""}</ThemedText>

              <Text style={styles.label}>Select Character</Text>

              <FlatList
                horizontal
                data={CHARACTERS}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const selected = selectedCharacter === item.id;

                  return (
                    <Pressable
                      onPress={() => setSelectedCharacter(item.id)}
                      style={[
                        styles.character,
                        selected && styles.characterSelected,
                      ]}
                    >
                      <Text style={styles.characterText}>{item.name}</Text>
                    </Pressable>
                  );
                }}
              />

              <Pressable
                style={styles.button}
                disabled={loading}
                onPress={handleCreate}
              >
                <Text style={styles.buttonText}>
                  {loading ? "Creating..." : "Enter Arena"}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.button, { backgroundColor: "#444" }]}
                onPress={() => setIsVisible(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },

  container: {
    width: "85%",
    backgroundColor: "#111",
    borderRadius: 16,
    padding: 24,
  },

  title: {
    fontSize: 24,
    color: "white",
    fontWeight: "bold",
    marginBottom: 20,
  },

  label: {
    color: "#aaa",
    marginBottom: 6,
  },

  input: {
    backgroundColor: "#222",
    borderRadius: 8,
    padding: 12,
    color: "white",
    marginBottom: 20,
  },

  character: {
    backgroundColor: "#222",
    padding: 16,
    marginRight: 10,
    borderRadius: 10,
  },

  characterSelected: {
    backgroundColor: "#4f46e5",
  },

  characterText: {
    color: "white",
  },

  button: {
    marginTop: 20,
    backgroundColor: "#4f46e5",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  buttonText: {
    color: "white",
    fontWeight: "bold",
  },
});
