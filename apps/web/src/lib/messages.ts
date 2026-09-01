export function isSpamLimitExceeded(messagesInLastHour: number): boolean {
  return messagesInLastHour >= 3;
}
