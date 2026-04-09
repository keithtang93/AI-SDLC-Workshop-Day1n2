# PRP 11: Authentication & WebAuthn

## Feature Overview

Passwordless authentication using WebAuthn (Passkeys). Registration and login flows using `@simplewebauthn` library. JWT session tokens (7-day expiry). HTTP-only cookies for secure session storage. Middleware protects authenticated routes. Virtual authenticators for testing. No password fallbacks.

**Core Capabilities:**

- WebAuthn registration (credential creation)
- WebAuthn login (credential verification)
- JWT session management (7-day expiry)
- HTTP-only cookie storage
- Route middleware protection
- Session logout
- Passkey recovery flow
- Virtual authenticators in tests
- Counter field validation

---

## User Stories

### Story 1: First-Time Registration

**As a new user, I want to register using my device's passkey, so that I have secure passwordless access.**

- Acceptance: Navigate to registration page
- Click "Create Passkey"
- Biometric/face recognition prompt
- Account created on first success
- Taken to main app

### Story 2: Return Login

**As a registered user, I want to log in with passkey, so that I don't need a password.**

- Acceptance: Visit app
- Login page shown (no registration)
- Click "Sign In with Passkey"
- Biometric prompt
- Session created
- Redirected to main app

### Story 3: Protected Routes

**As the app, I want to ensure only authenticated users access todos, so that data stays private.**

- Acceptance: Try to visit `/` without session
- Redirected to login
- After login, `/` accessible
- URL state preserved after login

### Story 4: Session Timeout

**As a security feature, I want sessions to expire, so that stolen tokens have limited window.**

- Acceptance: Login creates token with 7-day expiry
- After 7 days, token invalid
- User returns to login

### Story 5: Logout

**As a user, I want to log out, so that I can end my session on shared devices.**

- Acceptance: Click "Logout"
- Session cookie cleared
- Redirected to login
- Previous session token invalid

---

## User Flow

### Registration

1. User visits app
2. No session → login page shown
3. Link: "Don't have account? Create one"
4. User clicks → registration page
5. Input field for username (optional display name)
6. Button: "Create Passkey"
7. Browser calls `navigator.credentials.create()`
8. User performs biometric/face verification
9. Passkey created on device
10. Frontend POSTs challenge response to `/api/auth/register-verify`
11. Server verifies, creates user and authenticator record
12. JWT token issued, stored in HTTP-only cookie
13. User redirected to `/`
14. Main app loaded

### Login

1. User visits app
2. No session → login page shown
3. Button: "Sign In with Passkey"
4. Browser calls `navigator.credentials.get()`
5. User selects passkey (or auto-selects if only one)
6. User performs biometric/face verification
7. Frontend POSTs challenge response to `/api/auth/login-verify`
8. Server verifies, validates counter (prevents cloning)
9. JWT token issued
10. User redirected to `/` or saved URL
11. Main app loaded

### Logout

1. User clicks "Logout" in menu
2. Frontend POSTs to `/api/auth/logout`
3. Server clears session cookie
4. Frontend redirected to login page
5. Session ended

### Protected Routes

1. User tries to access `/`
2. Middleware checks for session cookie
3. If missing → redirect to `/login`
4. If present → validate JWT
5. If valid → allow access
6. If expired → redirect to `/login`

---

## Technical Requirements

### Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  CHECK (TRIM(username) != '')
);

CREATE TABLE authenticators (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credential_id BLOB NOT NULL UNIQUE, -- Base64url encoded
  public_key BLOB NOT NULL, -- CBOR encoded
  sign_count INTEGER NOT NULL DEFAULT 0, -- Counter for clone detection
  transports TEXT, -- JSON: ["usb", "nfc", "ble"]
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used DATETIME,

  CHECK (credential_id IS NOT NULL AND public_key IS NOT NULL)
);
```

### JWT Token Structure

```typescript
interface JWTPayload {
  userId: number;
  username: string;
  iat: number; // issued at
  exp: number; // expires at (7 days)
}

// 7-day expiry in seconds
const TOKEN_EXPIRY = 7 * 24 * 60 * 60;

function createJWT(userId: number, username: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: JWTPayload = {
    userId,
    username,
    iat: now,
    exp: now + TOKEN_EXPIRY,
  };

  return jwt.sign(payload, process.env.JWT_SECRET, {
    algorithm: "HS256",
  });
}

function verifyJWT(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET) as JWTPayload;
  } catch {
    return null;
  }
}
```

### Session Management (lib/auth.ts)

```typescript
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "your-secret-key",
);

export async function createSession(userId: number, username: string) {
  const token = await new SignJWT({
    userId,
    username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;

  if (!token) return null;

  try {
    const verified = await jwtVerify(token, SECRET);
    return verified.payload as { userId: number; username: string };
  } catch {
    return null;
  }
}

export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
```

### WebAuthn Registration Flow

**Step 1: Get Registration Options**

```typescript
// GET /api/auth/register-options
import { generateRegistrationOptions } from "@simplewebauthn/server";

export async function GET() {
  const options = await generateRegistrationOptions({
    rpID: "localhost", // or your domain
    rpName: "Todo App",
    userName: `user_${Date.now()}`,
    userDisplayName: "Todo User",
    attestationType: "direct",
  });

  // Store challenge in session (server-side, temporary)
  // sessionStorage[challenge] = options.challenge

  return NextResponse.json(options);
}
```

**Step 2: Verify Registration**

```typescript
// POST /api/auth/register-verify
import {
  verifyRegistrationResponse,
  isoBase64URL,
} from "@simplewebauthn/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Retrieve stored challenge
  // const challenge = sessionStorage[body.id];

  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge: storedChallenge,
    expectedOrigin: "http://localhost:3000",
    expectedRPID: "localhost",
  });

  if (!verification.verified) {
    return NextResponse.json({ error: "Registration failed" }, { status: 400 });
  }

  // Create user
  const user = db.exec("INSERT INTO users (username) VALUES (?)", [
    `user_${Date.now()}`,
  ]);

  // Store authenticator
  const credentialID = verification.registrationInfo!.credentialID;
  const credentialPublicKey =
    verification.registrationInfo!.credentialPublicKey;

  db.exec(
    "INSERT INTO authenticators (user_id, credential_id, public_key, sign_count) VALUES (?, ?, ?, ?)",
    [
      user.lastID,
      isoBase64URL.fromBuffer(credentialID),
      Buffer.from(credentialPublicKey).toString("base64"),
      verification.registrationInfo!.signCount ?? 0,
    ],
  );

  // Create session
  await createSession(user.lastID, `user_${Date.now()}`);

  return NextResponse.json({ success: true });
}
```

### WebAuthn Login Flow

**Step 1: Get Login Options**

```typescript
// POST /api/auth/login-options
import { generateAuthenticationOptions } from "@simplewebauthn/server";

export async function POST(request: NextRequest) {
  const options = await generateAuthenticationOptions({
    rpID: "localhost",
    timeout: 60000,
  });

  // Store challenge
  // sessionStorage[challenge] = options.challenge

  return NextResponse.json(options);
}
```

**Step 2: Verify Login**

```typescript
// POST /api/auth/login-verify
import {
  verifyAuthenticationResponse,
  isoBase64URL,
} from "@simplewebauthn/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // Get credential from request
  const credentialRawID = isoBase64URL.toBuffer(body.id);

  // Find authenticator in DB
  const authenticator = db
    .prepare("SELECT * FROM authenticators WHERE credential_id = ?")
    .get(isoBase64URL.fromBuffer(credentialRawID));

  if (!authenticator) {
    return NextResponse.json(
      { error: "Credential not found" },
      { status: 400 },
    );
  }

  // Verify response
  const verification = await verifyAuthenticationResponse({
    response: body,
    expectedChallenge: storedChallenge,
    expectedOrigin: "http://localhost:3000",
    expectedRPID: "localhost",
    authenticator: {
      credentialID: credentialRawID,
      credentialPublicKey: Buffer.from(authenticator.public_key, "base64"),
      counter: authenticator.sign_count ?? 0,
    },
  });

  if (!verification.verified) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 400 },
    );
  }

  // Check counter (prevent cloning)
  if (
    verification.authenticationInfo.signCount <= (authenticator.sign_count ?? 0)
  ) {
    return NextResponse.json(
      { error: "Possible authenticator cloning detected" },
      { status: 400 },
    );
  }

  // Update counter
  db.prepare(
    "UPDATE authenticators SET sign_count = ?, last_used = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(verification.authenticationInfo.signCount ?? 0, authenticator.id);

  // Get user
  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(authenticator.user_id);

  // Create session
  await createSession(user.id, user.username);

  return NextResponse.json({ success: true });
}
```

### Middleware Protection

```typescript
// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Public routes (no auth needed)
  if (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/api/auth"
  ) {
    return NextResponse.next();
  }

  // Protected routes
  if (pathname === "/" || pathname === "/calendar") {
    const session = await getSession();
    if (!session) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

---

## UI Components

### Login Page

```tsx
"use client";

import { useState } from "react";
import {
  startAuthentication,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (!browserSupportsWebAuthn()) {
    return (
      <div className="text-center p-6">
        <p className="text-red-600">
          Your browser doesn't support WebAuthn. Please use a modern browser.
        </p>
      </div>
    );
  }

  const handleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get authentication options
      const optionsResponse = await fetch("/api/auth/login-options", {
        method: "POST",
      });
      const options = await optionsResponse.json();

      // Start authentication
      const assertion = await startAuthentication(options);

      // Verify with server
      const verifyResponse = await fetch("/api/auth/login-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });

      if (!verifyResponse.ok) {
        throw new Error("Authentication failed");
      }

      // Success → redirect to home
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-blue-800">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-bold text-center mb-8">Todo App</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? "Signing in..." : "🔐 Sign In with Passkey"}
        </button>

        <p className="text-center text-gray-600 mt-4 text-sm">
          New user?{" "}
          <a href="/register" className="text-blue-600 hover:underline">
            Create passkey
          </a>
        </p>
      </div>
    </div>
  );
}
```

### Registration Page

```tsx
"use client";

import { useState } from "react";
import {
  startRegistration,
  browserSupportsWebAuthn,
} from "@simplewebauthn/browser";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreatePasskey = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get registration options
      const optionsResponse = await fetch("/api/auth/register-options");
      const options = await optionsResponse.json();

      // Start registration
      const attestation = await startRegistration(options);

      // Verify with server
      const verifyResponse = await fetch("/api/auth/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(attestation),
      });

      if (!verifyResponse.ok) {
        throw new Error("Registration failed");
      }

      // Success → redirect to home
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setIsLoading(false);
    }
  };

  if (!browserSupportsWebAuthn()) {
    return (
      <div className="text-center p-6">
        <p className="text-red-600">Your browser doesn't support WebAuthn.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-600 to-green-800">
      <div className="bg-white rounded-lg shadow-2xl p-8 w-96">
        <h1 className="text-3xl font-bold text-center mb-8">Create Account</h1>

        {error && (
          <div className="mb-4 p-4 bg-red-100 text-red-700 rounded">
            {error}
          </div>
        )}

        <button
          onClick={handleCreatePasskey}
          disabled={isLoading}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? "Creating..." : "✨ Create Passkey"}
        </button>

        <p className="text-center text-gray-600 mt-4 text-sm">
          Already have account?{" "}
          <a href="/login" className="text-green-600 hover:underline">
            Sign in here
          </a>
        </p>
      </div>
    </div>
  );
}
```

---

## Edge Cases

1. **Counter Field Undefined**: Use `?? 0` for null-safe access
2. **Multiple Passkeys**: Same user can have multiple authenticators
3. **Lost Passkey**: User locked out (recovery flow out of scope)
4. **Browser Doesn't Support WebAuthn**: Show friendly message
5. **Network Error During Challenge**: Timeout after 60s
6. **Token Expired Mid-Session**: Middleware redirects to login
7. **Same Chrome sync account**: Passkeys are sync'd across devices
8. **Biometric Fails 3 Times**: Device handle retries

---

## Acceptance Criteria

- [ ] Register creates user and authenticator
- [ ] Login verifies counter (prevents cloning)
- [ ] JWT token created with 7-day expiry
- [ ] Session stored in HTTP-only cookie
- [ ] Protected routes redirect without session
- [ ] Logout clears session
- [ ] Middleware protects `/` and `/calendar`
- [ ] WebAuthn verification succeeds
- [ ] Error messages clear for failed auth
- [ ] Virtual authenticators work in Playwright tests

---

## Testing Requirements

### Unit Tests

1. **JWT Token**
   - Creates token with correct payload
   - 7-day expiry set
   - Verification succeeds with valid token
   - Verification fails with expired token

2. **Session Functions**
   - createSession sets HTTP-only cookie
   - getSession reads and verifies JWT
   - clearSession removes cookie

### Integration Tests

1. **WebAuthn Registration**
   - Full registration flow works
   - User created in DB
   - Authenticator recorded

2. **WebAuthn Login**
   - Full login flow works
   - Counter incremented
   - Session created

### E2E Tests (Playwright)

1. **Test: Register New User**

   ```
   - Navigate to /register
   - Click "Create Passkey"
   - Respond to virtual authenticator prompt
   - Verify redirected to /
   - Verify session cookie set
   ```

2. **Test: Login Existing User**

   ```
   - Clear session cookie
   - Navigate to /login
   - Click "Sign In with Passkey"
   - Respond to authenticator
   - Verify redirected to /
   ```

3. **Test: Protected Route**

   ```
   - Clear session
   - Try to visit /
   - Verify redirected to /login
   - Complete login
   - Verify / loads
   ```

4. **Test: Logout**
   ```
   - Login user
   - Click "Logout"
   - Verify redirected to /login
   - Verify session cookie gone
   ```

\*\*Playwright Virtual Authenticator Setup:`

```typescript
// playwright.config.ts
export default {
  use: {
    // ...
    chromeArgs: [
      "--enable-features=WebAuthenticationResidentKeyServerTransport",
    ],
  },
};

// tests/auth.spec.ts
test("Register user", async ({ browser }) => {
  const context = await browser.newContext();

  // Enable virtual authenticator
  const cdpSession = await context.newCDPSession(await context.newPage());
  await cdpSession.send("WebAuthn.enable");
  await cdpSession.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      isUserVerifyingPlatformAuthenticator: true,
    },
  });

  const page = await context.newPage();
  await page.goto("http://localhost:3000/register");
  await page.click('button:has-text("Create Passkey")');

  // Virtual authenticator auto-responds
  // ...
});
```

---

## Out of Scope

- ❌ Password fallback
- ❌ Social login (Google, GitHub)
- ❌ Email verification
- ❌ Two-factor authentication
- ❌ Passkey recovery
- ❌ Multiple device sync
- ❌ Account deletion
- ❌ Permission scopes

---

## Success Metrics

1. **Security**: JWT tokens secure, counter prevents cloning
2. **Usability**: Registration and login < 10 seconds
3. **Reliability**: Works on iOS, Android, macOS, Windows
4. **Performance**: Auth requests < 200ms
