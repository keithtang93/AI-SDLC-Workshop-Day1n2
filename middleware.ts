import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-me",
);

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get("session-token")?.value;
  if (!token) {
    return false;
  }

  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  const isAuthPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/api/auth");
  const isPublicAsset =
    pathname.startsWith("/_next") || pathname === "/favicon.ico";

  if (isPublicAsset || isAuthPath) {
    return NextResponse.next();
  }

  const protectedPath = pathname === "/" || pathname.startsWith("/calendar");
  if (!protectedPath) {
    return NextResponse.next();
  }

  const authenticated = await isAuthenticated(request);
  if (!authenticated) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/.*|_next/static|_next/image|favicon.ico).*)"],
};
