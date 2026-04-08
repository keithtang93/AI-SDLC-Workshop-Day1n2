# PRP 11: Authentication (WebAuthn / Passkeys)

## Feature Overview

Implement passwordless authentication using WebAuthn and passkeys, backed by JWT cookie sessions and route protection middleware. This is the security foundation for the rest of the todo app.

Project-specific rules that must be followed:

- Use `@simplewebauthn/server` and `@simplewebauthn/browser`
- Store session tokens as **HTTP-only cookies** with a **7-day expiry**
- Protect `/` and `/calendar` through `middleware.ts`
- Use `counter ?? 0` when passing authenticator counters into verification calls
- Use `isoBase64URL` for credential id conversions where needed

---

## Why This Feature Matters

Every user must see only their own data. WebAuthn improves both usability and security by removing passwords while still supporting strong, phishing-resistant authentication.

---

## User Stories

### Core user stories
- As a user, I can register with a passkey instead of a password.
- As a user, I can log in with my passkey on supported devices.
- As a user, my session stays active for up to 7 days unless I log out.

### Supporting user stories
- As an unauthenticated visitor, I am redirected to `/login` when accessing protected routes.
- As an authenticated user, I skip the login page and go directly to the app.
- As a user, I can log out immediately and clear my session.

---

## Canonical Acceptance Criteria

- [ ] Registration works with passkey
- [ ] Login works with passkey
- [ ] Session persists 7 days
- [ ] Logout clears session immediately
- [ ] Protected routes secured

---

## User Flow

### Registration
1. User visits `/login`.
2. User enters a username and chooses `Register`.
3. Client calls `POST /api/auth/register-options`.
4. Browser starts passkey registration via `@simplewebauthn/browser`.
5. Client sends the attestation response to `POST /api/auth/register-verify`.
6. Server verifies the credential, stores it, and creates a session cookie.
7. User is redirected to the main app.

### Login
1. User chooses an existing username.
2. Client calls `POST /api/auth/login-options`.
3. Browser starts authentication via the passkey prompt.
4. Client sends the assertion response to `POST /api/auth/login-verify`.
5. Server verifies the assertion and sets the session cookie.

### Logout
1. User clicks `Logout`.
2. Client calls `POST /api/auth/logout`.
3. Session cookie is deleted immediately.
4. User is redirected back to `/login`.

---

## Technical Requirements

### 1. File Ownership

- `lib/db.ts` - `users` and `authenticators` tables, user/authenticator helpers
- `lib/auth.ts` - `createSession`, `getSession`, `deleteSession`
- `app/api/auth/register-options/route.ts`
- `app/api/auth/register-verify/route.ts`
- `app/api/auth/login-options/route.ts`
- `app/api/auth/login-verify/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/me/route.ts`
- `middleware.ts` - route protection
- `app/login/page.tsx` - register/login UI
- `tests/01-authentication.spec.ts` - Playwright with virtual authenticators

### 2. Data Model

Recommended interfaces:

```ts
export interface User {
  id: string
  username: string
  created_at: string
}

export interface Authenticator {
  id: string
  user_id: string
  credential_id: string
  credential_public_key: string
  counter: number
  transports?: string | null
  created_at: string
}
```

Important null safety:

```ts
counter: authenticator.counter ?? 0
```

### 3. Session Rules

- JWT in HTTP-only cookie
- 7-day expiry
- `secure: true` in production
- `sameSite` configured appropriately
- `getSession()` must be checked at the start of protected routes

---

## API Contract

### `POST /api/auth/register-options`
Return a WebAuthn registration challenge for a new username.

### `POST /api/auth/register-verify`
Verify attestation response, persist authenticator, create session.

### `POST /api/auth/login-options`
Return a WebAuthn authentication challenge for an existing user.

### `POST /api/auth/login-verify`
Verify assertion response and create session.

### `POST /api/auth/logout`
Delete the session cookie.

### `GET /api/auth/me`
Return the current session user, if authenticated.

**Shared route pattern**

```ts
const session = await getSession()
if (!session) {
  return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
}
```

---

## Frontend / UX Requirements

### Login Page
- single `/login` page with register and login actions
- simple username entry
- clear call-to-action for passkey-based auth
- helpful error state if the browser does not support WebAuthn

### Authenticated Experience
- show a `Logout` button in the app shell or header
- redirect unauthenticated access attempts to `/login`
- redirect authenticated users away from the login page to `/`

### Browser Interaction
- use `@simplewebauthn/browser` methods to start registration/authentication
- handle cancellation and unsupported-device errors gracefully

---

## Step-by-Step Implementation Plan

1. **Create user/authenticator tables in `lib/db.ts`**
   - include foreign key from authenticator to user
   - keep credential ids unique

2. **Implement session helpers in `lib/auth.ts`**
   - create JWT
   - read/verify JWT
   - delete cookie on logout

3. **Add registration routes**
   - generate options
   - verify attestation
   - store authenticator with `isoBase64URL` where required

4. **Add login routes**
   - generate assertion options
   - verify authentication response
   - pass `counter ?? 0` safely into verifier

5. **Protect routes in `middleware.ts`**
   - require auth for `/` and `/calendar`
   - allow `/login` and auth APIs through

6. **Build `app/login/page.tsx`**
   - register + login flows
   - clear loading and error states

7. **Add logout and current-user checks**
   - `GET /api/auth/me`
   - `POST /api/auth/logout`

8. **Add Playwright coverage**
   - use virtual authenticators
   - verify register, login, logout, and redirect flows

---

## Edge Cases

1. Duplicate username during registration
2. Browser does not support WebAuthn
3. Authenticator counter is `undefined` and must fallback with `?? 0`
4. Credential id encoding mismatch (`base64` vs `base64url`)
5. Expired or tampered JWT session cookie
6. User attempts to access another page directly without authentication

---

## Testing Requirements

### Required E2E scenarios
- Register a new user with a virtual authenticator
- Login as an existing user
- Logout and verify session is cleared
- Unauthenticated access to protected routes redirects to `/login`
- Authenticated access to `/login` redirects back to the app

### Suggested verification commands

```bash
npm run lint
npm run build
npx playwright test tests/01-authentication.spec.ts
```

---

## Security and Quality Notes

- Never log credential material or JWT secrets
- Validate all usernames and WebAuthn payloads server-side
- Keep cookies HTTP-only and secure in production
- Scope every DB query to the authenticated user

---

## Out of Scope

This PRP does **not** define:
- password-based fallback authentication
- multi-factor recovery flows
- social login providers

---

## Success Metrics

- Registration and login work smoothly with passkeys
- Protected routes remain inaccessible without a valid session
- Session persistence and logout behavior match expectations exactly

---

## Reference Sources

- `../EVALUATION.md`
- `../USER_GUIDE.md`
- `../.github/copilot-instructions.md`
- `./01-todo-crud-operations.md`
