import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowlistEnabled, isUserAllowed } from "@/lib/auth";

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

// Routes a non-allowlisted signed-in user CAN still reach. Without these the
// redirect to /access-denied would loop, and the sign-out button there would
// have nowhere to call back to.
const isAlwaysAllowed = createRouteMatcher([
  "/access-denied",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/auth-state",
  "/api/health(.*)",
  "/api/debug/whoami", // lets a denied user check WHY they were denied
]);

export default CLERK_ENABLED
  ? clerkMiddleware(async (auth, req) => {
      if (!isAllowlistEnabled()) return NextResponse.next();
      if (isAlwaysAllowed(req)) return NextResponse.next();
      const { userId } = await auth();
      if (!userId) return NextResponse.next(); // anonymous — Clerk decides what to do
      const ok = await isUserAllowed(userId);
      if (ok) return NextResponse.next();
      // Signed in, but not on the list. Send to the friendly access-denied page.
      const url = req.nextUrl.clone();
      url.pathname = "/access-denied";
      return NextResponse.redirect(url);
    })
  : function passthrough(_req: NextRequest) {
      return NextResponse.next();
    };

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
