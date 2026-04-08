# PRP 11: Authentication (WebAuthn)

## Feature Overview
Implement passwordless authentication using WebAuthn and passkeys. Users should be able to register, log in, maintain a secure session via HTTP-only cookies, and access protected routes only when authenticated.

## Dependencies
- Cross-cutting infrastructure feature.
- Must follow repo guidance in [.github/copilot-instructions.md](../.github/copilot-instructions.md) for WebAuthn libraries, JWT sessions, cookie handling, and middleware.

## User Stories
- As a new user, I can register with a username and passkey.
- As an existing user, I can log in with my passkey.
- As an authenticated user, I stay signed in for the configured session duration.
- As an unauthenticated user, I am redirected away from protected routes.
- As an authenticated user, I can log out immediately.

## User Flow
1. User visits `/login`.
2. User starts registration or login.
3. Client requests challenge options from the server.
4. Browser interacts with the authenticator using `@simplewebauthn/browser`.
5. Client posts the WebAuthn response to the verification endpoint.
6. Server verifies credentials and creates a session cookie.
7. Middleware grants access to protected routes until logout or session expiry.

## Technical Requirements

### Data Model
- `users` table.
- `authenticators` table with fields needed by `@simplewebauthn/server`.
- Use safe handling for authenticator counters with `?? 0` as documented in repo guidance.

### API Endpoints
- `POST /api/auth/register-options`
- `POST /api/auth/register-verify`
- `POST /api/auth/login-options`
- `POST /api/auth/login-verify`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Session Management
- Implement `lib/auth.ts` with helpers such as:
  - `createSession`
  - `getSession`
  - `deleteSession`
- Use JWT-backed, HTTP-only cookies with 7-day expiry.
- Configure secure and same-site cookie behavior appropriately for production.

### Route Protection
- `middleware.ts` protects `/` and `/calendar` and any other application routes requiring auth.
- Authenticated users visiting `/login` may be redirected to the main app.

### WebAuthn Implementation Rules
- Use `@simplewebauthn/server` and `@simplewebauthn/browser`.
- Handle base64url encoding properly for credential IDs.
- Set RP ID, RP name, and origin from environment variables for production readiness.

### Interface Surface
- Login page with registration and login flows.
- Logout action in authenticated UI.
- Loading and error states for challenge generation and verification.

## UI Components
- Auth messaging should make passkey flows understandable to non-technical users.
- Error messages should distinguish between unsupported browser/device, registration failure, and verification failure.

## Edge Cases
- Browser or device lacks WebAuthn support.
- Duplicate username registration rules need clear definition.
- Authenticator counter undefined.
- Session cookie invalid or expired.
- User attempts to access protected routes unauthenticated.
- RP ID or origin misconfigured in production.

## Acceptance Criteria
- New users can register with passkeys.
- Existing users can log in with passkeys.
- Session persists for the configured duration.
- Logout clears the session immediately.
- Protected routes require authentication.
- `/api/auth/me` reflects session state correctly.

## Testing Requirements

### E2E
- Register a new user with a virtual authenticator.
- Log in with an existing user.
- Log out and verify session removal.
- Attempt to access protected routes while unauthenticated.
- Verify authenticated users are redirected away from `/login` if that behavior is adopted.

### Unit
- JWT creation and verification.
- Session cookie helpers.
- Authenticator counter normalization.

## Out of Scope
- Password fallback.
- Social login providers.
- Account recovery flows beyond what passkey providers support.

## Success Metrics
- Authentication succeeds reliably in supported browsers.
- Session security aligns with production cookie best practices.
- Route protection is enforced consistently across the app.