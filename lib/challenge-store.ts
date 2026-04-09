// In-memory challenge stores for WebAuthn registration and login flows.
// Separated from route files because Next.js route modules must only export route handlers.

export const registrationChallengeStore = new Map<string, string>()
export const loginChallengeStore = new Map<string, string>()
