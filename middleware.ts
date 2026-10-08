import { NextResponse, type NextRequest } from "next/server";

// Firebase Authentication runs entirely in the browser.
// This middleware does nothing server-side — restrict it to API/admin
// routes only, so all public pages can be served from Vercel's CDN cache.
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only run middleware on API routes and admin pages.
    // Public pages (homepage, learn, mocks, etc.) are intentionally
    // excluded so Vercel CDN can cache them (avoids 100% cache-miss).
    "/api/(.*)",
    "/admin/(.*)",
  ],
};
