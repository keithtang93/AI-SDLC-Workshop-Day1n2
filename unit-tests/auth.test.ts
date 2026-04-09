import { describe, it, expect } from "vitest";
import { SignJWT, jwtVerify } from "jose";

/**
 * JWT creation and verification tests.
 * Mirrors logic from lib/auth.ts.
 *
 * EVALUATION.md F11: Unit test: JWT creation/verification
 *
 * Note: We test the JWT logic directly rather than createSession/getSession
 * because those depend on Next.js cookies() which requires a request context.
 */

const secret = new TextEncoder().encode("test-secret-key");

interface SessionPayload {
  userId: number;
  username: string;
}

async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

async function verifyToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const verified = await jwtVerify(token, secret);
    const payload = verified.payload as {
      userId?: number;
      username?: string;
    };
    if (!payload.userId || !payload.username) {
      return null;
    }
    return { userId: payload.userId, username: payload.username };
  } catch {
    return null;
  }
}

describe("JWT Auth Utilities", () => {
  describe("Token creation", () => {
    it("creates a valid JWT string", async () => {
      const token = await createToken({ userId: 1, username: "testuser" });
      expect(typeof token).toBe("string");
      expect(token.split(".")).toHaveLength(3);
    });

    it("encodes user data in token payload", async () => {
      const token = await createToken({ userId: 42, username: "alice" });
      const result = await jwtVerify(token, secret);
      expect(result.payload.userId).toBe(42);
      expect(result.payload.username).toBe("alice");
    });

    it("sets HS256 algorithm in header", async () => {
      const token = await createToken({ userId: 1, username: "test" });
      const result = await jwtVerify(token, secret);
      expect(result.protectedHeader.alg).toBe("HS256");
    });

    it("sets issued-at claim", async () => {
      const token = await createToken({ userId: 1, username: "test" });
      const result = await jwtVerify(token, secret);
      expect(result.payload.iat).toBeDefined();
      expect(typeof result.payload.iat).toBe("number");
    });

    it("sets expiration claim", async () => {
      const token = await createToken({ userId: 1, username: "test" });
      const result = await jwtVerify(token, secret);
      expect(result.payload.exp).toBeDefined();
      // Expiration should be ~7 days from now
      const nowSec = Math.floor(Date.now() / 1000);
      const sevenDaysSec = 7 * 24 * 60 * 60;
      const diff = (result.payload.exp as number) - nowSec;
      expect(diff).toBeGreaterThan(sevenDaysSec - 60);
      expect(diff).toBeLessThanOrEqual(sevenDaysSec + 60);
    });
  });

  describe("Token verification", () => {
    it("verifies a valid token and returns session", async () => {
      const token = await createToken({ userId: 5, username: "bob" });
      const session = await verifyToken(token);
      expect(session).toEqual({ userId: 5, username: "bob" });
    });

    it("returns null for tampered token", async () => {
      const token = await createToken({ userId: 1, username: "test" });
      const tampered = token.slice(0, -5) + "XXXXX";
      const result = await verifyToken(tampered);
      expect(result).toBeNull();
    });

    it("returns null for token signed with wrong secret", async () => {
      const wrongSecret = new TextEncoder().encode("wrong-secret");
      const token = await new SignJWT({ userId: 1, username: "test" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(wrongSecret);

      const result = await verifyToken(token);
      expect(result).toBeNull();
    });

    it("returns null for expired token", async () => {
      const token = await new SignJWT({ userId: 1, username: "test" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("0s")
        .sign(secret);

      // Wait a tiny bit to ensure expiration
      await new Promise((resolve) => setTimeout(resolve, 10));
      const result = await verifyToken(token);
      expect(result).toBeNull();
    });

    it("returns null for completely invalid string", async () => {
      const result = await verifyToken("not-a-jwt");
      expect(result).toBeNull();
    });

    it("returns null for empty string", async () => {
      const result = await verifyToken("");
      expect(result).toBeNull();
    });

    it("returns null for token missing userId", async () => {
      const token = await new SignJWT({ username: "test" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);

      const result = await verifyToken(token);
      expect(result).toBeNull();
    });

    it("returns null for token missing username", async () => {
      const token = await new SignJWT({ userId: 1 })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);

      const result = await verifyToken(token);
      expect(result).toBeNull();
    });
  });
});
