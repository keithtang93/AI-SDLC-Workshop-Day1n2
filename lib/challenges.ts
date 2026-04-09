// In-memory challenge stores for WebAuthn registration and login flows.
// Uses globalThis to survive Next.js dev server module reloads.
// Suitable for single-server deployments (workshop/dev use).

const globalStore = globalThis as unknown as {
  _registrationChallengeStore?: Map<string, string>
  _loginChallengeStore?: Map<string, string>
}

if (!globalStore._registrationChallengeStore) {
  globalStore._registrationChallengeStore = new Map<string, string>()
}
if (!globalStore._loginChallengeStore) {
  globalStore._loginChallengeStore = new Map<string, string>()
}

export const registrationChallengeStore = globalStore._registrationChallengeStore
export const loginChallengeStore = globalStore._loginChallengeStore
