export function calculateTier(publicWins: number) {
  if (publicWins >= 15) return "Shadow";
  if (publicWins >= 7) return "Elite";
  if (publicWins >= 3) return "Hunter";
  return "Initiate";
}
