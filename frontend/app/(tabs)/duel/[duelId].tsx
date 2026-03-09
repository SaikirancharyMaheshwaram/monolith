import { DuelDetailScreen } from "@/components/DuelDetailScreen";
import { useLocalSearchParams } from "expo-router";

export default function DuelGateScreen() {
  const { duelId } = useLocalSearchParams<{ duelId?: string }>();
  return <DuelDetailScreen duelIdValue={duelId} />;
}
