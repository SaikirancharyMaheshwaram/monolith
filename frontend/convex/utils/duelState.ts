export function assertActive(status: string) {
  if (status !== "ACTIVE") {
    throw new Error("Duel not active");
  }
}