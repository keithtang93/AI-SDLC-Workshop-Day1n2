const challengeStore = new Map<string, string>();

export function setChallenge(username: string, challenge: string): void {
  challengeStore.set(username, challenge);
}

export function consumeChallenge(username: string): string | null {
  const challenge = challengeStore.get(username) ?? null;
  if (challenge) {
    challengeStore.delete(username);
  }
  return challenge;
}
