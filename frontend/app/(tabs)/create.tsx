import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useWalletStore } from "@/stores/use-wallet-store";

export default function CreateDuel() {
  const createDuel = useMutation(api.duels.createFriendDuel.createFriendDuel);
  const playerPubKey = useWalletStore((s) => s.publicKey);

  const [player1, setPlayer1] = useState(playerPubKey?.toString() ?? "");
  const [stakeAmount, setStakeAmount] = useState("1");
  const [startTime, setStartTime] = useState(new Date());
  const [showPickerIOS, setShowPickerIOS] = useState(false);

  function openAndroidPicker() {
    // First open date picker
    DateTimePickerAndroid.open({
      value: startTime,
      mode: "date",
      onChange: (event, selectedDate) => {
        if (event.type === "set" && selectedDate) {
          // Then open time picker
          DateTimePickerAndroid.open({
            value: selectedDate,
            mode: "time",
            is24Hour: true,
            onChange: (event2, selectedTime) => {
              if (event2.type === "set" && selectedTime) {
                // Merge date + time
                const merged = new Date(selectedDate);
                merged.setHours(selectedTime.getHours());
                merged.setMinutes(selectedTime.getMinutes());
                setStartTime(merged);
              }
            },
          });
        }
      },
    });
  }

  async function handleCreate() {
    try {
      const utcTimestamp = startTime.getTime();

      const duelId = await createDuel({
        player1,
        stakeAmount: parseInt(stakeAmount),
        startTime: utcTimestamp,
      });

      Alert.alert("✅ Success", `Duel created with ID: ${duelId}`);
    } catch (error: any) {
      Alert.alert("❌ Error", error.message);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚔️ Create a Friend Duel</Text>

      <TextInput
        style={styles.input}
        placeholder="Wallet Address (Player 1)"
        value={player1}
        onChangeText={setPlayer1}
        editable={false} // wallet address is fixed
      />

      <TextInput
        style={styles.input}
        placeholder="Stake Amount"
        keyboardType="numeric"
        value={stakeAmount}
        onChangeText={setStakeAmount}
      />

      <View style={styles.dateContainer}>
        <Text style={styles.label}>Start Time</Text>
        <Button
          title={startTime.toLocaleString()}
          onPress={() =>
            Platform.OS === "android"
              ? openAndroidPicker()
              : setShowPickerIOS(true)
          }
          color="#FF9800"
        />
      </View>

      {Platform.OS === "ios" && showPickerIOS && (
        <DateTimePicker
          value={startTime}
          mode="datetime"
          display="inline"
          onChange={(event, selectedDate) => {
            if (event.type === "set" && selectedDate) {
              setStartTime(selectedDate);
            }
          }}
        />
      )}

      <Button title="🚀 Create Duel" onPress={handleCreate} color="#4CAF50" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 30,
    backgroundColor: "#121212", // dark background
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 25,
    textAlign: "center",
    color: "#FFFFFF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#444",
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    backgroundColor: "#1E1E1E",
    fontSize: 16,
    color: "#FFF",
  },
  dateContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginBottom: 8,
    color: "#AAA",
  },
});
