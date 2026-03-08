type DuelStatus =
  | "CREATED"
  | "OPEN"
  | "ACTIVE"
  | "COMPLETED"
  | "RESOLVED"
  | "CANCELLED";

type DuelMode = "PUBLIC" | "FRIEND";

export type DuelCopyLike = {
  title?: string;
  description?: string;
  stakeAmount: number;
  mode: DuelMode;
  status: DuelStatus;
  startTime?: number;
};

export function getDuelTitle(duel?: Partial<DuelCopyLike> | null) {
  if (!duel) return "Untitled Duel";
  if (duel.title?.trim()) return duel.title.trim();

  const modeLabel = duel.mode === "FRIEND" ? "Friend" : "Public";
  const statusLabel =
    duel.status === "OPEN"
      ? "Open Challenge"
      : duel.status === "ACTIVE"
        ? "Live Duel"
        : duel.status === "RESOLVED" || duel.status === "COMPLETED"
          ? "Completed Match"
          : duel.status === "CANCELLED"
            ? "Cancelled Match"
            : "Scheduled Duel";

  return `${modeLabel} ${statusLabel} • ${duel.stakeAmount ?? 0} SOL`;
}

export function getDuelDescription(duel?: Partial<DuelCopyLike> | null) {
  if (!duel) return "Waiting for duel details to load.";
  if (duel.description?.trim()) return duel.description.trim();

  if (duel.status === "OPEN") {
    return duel.mode === "FRIEND"
      ? "Waiting for one rival to accept the invite and lock matching stake."
      : "Open to the arena. The first matching rival activates the challenge.";
  }

  if (duel.status === "ACTIVE") {
    return "Daily check-ins are live. Missed windows decide the outcome before final settlement.";
  }

  if (duel.status === "RESOLVED" || duel.status === "COMPLETED") {
    return "The duel outcome has been decided. Review the record and settle the final payout if needed.";
  }

  if (duel.status === "CANCELLED") {
    return "This duel was closed before it became active.";
  }

  return "Escrow is set up and the duel will move forward once the match window opens.";
}

export function formatDuelStatus(status: DuelStatus) {
  switch (status) {
    case "OPEN":
      return "Open";
    case "ACTIVE":
      return "Live";
    case "RESOLVED":
      return "Resolved";
    case "COMPLETED":
      return "Completed";
    case "CANCELLED":
      return "Cancelled";
    default:
      return "Scheduled";
  }
}

export function getDuelNextAction(duel: DuelCopyLike) {
  switch (duel.status) {
    case "OPEN":
      return "Share the invite or wait for an opponent to lock in.";
    case "ACTIVE":
      return "Submit today's proof before the next 24-hour window closes.";
    case "RESOLVED":
    case "COMPLETED":
      return "Settle the duel and review the final record.";
    case "CANCELLED":
      return "Start a new duel when you're ready to play again.";
    default:
      return "Watch the start time and be ready when the duel goes live.";
  }
}

export function formatStartTime(timestamp?: number) {
  if (!timestamp) return "TBD";
  return new Date(timestamp).toLocaleString();
}
