export function daysUntilLabel(dateIso: string, now = new Date()) {
  const date = new Date(dateIso);
  const days = Math.ceil((date.getTime() - now.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d left";
  return `${days}d left`;
}
