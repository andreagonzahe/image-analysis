import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { AgeGate } from "@/components/AgeGate";
import { ProfileSurvey } from "@/components/ProfileSurvey";
import { SideNav } from "@/components/SideNav";
import { isAdminUser } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postwise — Posting strategy for creators monetizing on OnlyFans, Fansly, Patreon",
  description:
    "Built for creators monetizing on OnlyFans, Fansly, and Patreon. Routes every photo to the right rung on the content ladder so paid-tier content stays a PPV unlock — not a free X post that undercuts your sale.",
};

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

async function Shell({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  let isAdmin = false;
  if (CLERK_ENABLED) {
    try {
      const { userId } = await auth();
      signedIn = Boolean(userId);
      if (userId) isAdmin = await isAdminUser(userId);
    } catch {
      signedIn = false;
    }
  }

  return (
    <html lang="en">
      <body>
        <AgeGate />
        {CLERK_ENABLED && signedIn && <ProfileSurvey />}
        <div className="app-shell">
          <SideNav clerkEnabled={CLERK_ENABLED} signedIn={signedIn} isAdmin={isAdmin} />
          <div className="main-column">
            {children}
            <footer className="footer">
              <div className="footer-tagline">
                Built for creators monetizing on OnlyFans, Fansly, and Patreon · Your content on your own accounts
              </div>
              <div className="footer-links">
                <Link href="/terms">Terms</Link>
                <span aria-hidden>·</span>
                <Link href="/privacy">Privacy</Link>
                <span aria-hidden>·</span>
                <Link href="/acceptable-use">Acceptable Use</Link>
                <span aria-hidden>·</span>
                <Link href="/how-it-works">How it works</Link>
              </div>
            </footer>
          </div>
        </div>
      </body>
    </html>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  if (CLERK_ENABLED) {
    return (
      <ClerkProvider>
        {/* @ts-expect-error async server component */}
        <Shell>{children}</Shell>
      </ClerkProvider>
    );
  }
  // @ts-expect-error async server component
  return <Shell>{children}</Shell>;
}
