import { CharacterAvatar } from "@/components/CharacterAvatar";
import { CHARACTER_OPTIONS, CharacterId } from "@/components/characters";
import { C } from "@/components/lobby-theme";
import { api } from "@/convex/_generated/api";
import { useWalletStore } from "@/stores/use-wallet-store";
import { useMutation } from "convex/react";
import { useState } from "react";
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

export default function OnboardingModal() {
  const [isVisible, setIsVisible] = useState(true);
  const createUser = useMutation(api.users.createUser.createUser);

  const publicKey = useWalletStore((s) => s.publicKey);
  const setStatus = useWalletStore((s) => s.setStatus);

  const [username, setUsername] = useState("");
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterId>("samurai");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!publicKey) return;
    if (username.trim().length < 3) return;

    setLoading(true);
    try {
      setError("");
      await createUser({
        walletAddress: publicKey,
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
              <Text style={styles.title}>SYSTEM REGISTRATION</Text>

              <Text style={styles.label}>Choose Username</Text>

              <TextInput
                placeholder="username"
                placeholderTextColor={C.slate600}
                value={username}
                onChangeText={setUsername}
                style={styles.input}
                autoCapitalize="none"
              />
              {!!error && <Text style={styles.error}>{error}</Text>}

              <Text style={styles.label}>Select Character</Text>

              <FlatList
                horizontal
                data={CHARACTER_OPTIONS}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ gap: 10 }}
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
                      <CharacterAvatar characterId={item.id} label={item.name} size={90} />
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
    width: "88%",
    backgroundColor: "#111",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.manaBorder,
    padding: 20,
  },

  title: {
    fontSize: 14,
    color: C.mana,
    fontFamily: "monospace",
    letterSpacing: 2,
    marginBottom: 16,
  },

  label: {
    color: C.slate400,
    marginBottom: 8,
    fontFamily: "monospace",
    textTransform: "uppercase",
    fontSize: 11,
  },

  input: {
    backgroundColor: "#1b2532",
    borderRadius: 8,
    padding: 12,
    color: "white",
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },

  error: {
    color: "#ff7f7f",
    marginBottom: 10,
    fontSize: 11,
  },

  character: {
    width: 110,
    backgroundColor: "#1b2532",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.glassBorder,
  },

  characterSelected: {
    borderColor: C.mana,
    backgroundColor: C.manaDim,
  },

  characterText: {
    color: "white",
    textAlign: "center",
    fontFamily: "monospace",
    textTransform: "uppercase",
    fontSize: 10,
  },

  button: {
    marginTop: 18,
    backgroundColor: C.mana,
    padding: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  buttonText: {
    color: C.black,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});
