import type { Metadata } from "next";
import Link from "next/link";
import { ClerkProvider, SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { AgeGate } from "@/components/AgeGate";
import "./globals.css";

export const metadata: Metadata = {
  title: "Postwise — Where should I post this?",
  description:
    "Drop an image. Get the best platform to post it on and a caption tuned for that audience, backed by creator-marketing principles.",
};

const CLERK_ENABLED = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

async function Shell({ children }: { children: React.ReactNode }) {
  let signedIn = false;
  if (CLERK_ENABLED) {
    try {
      const { userId } = await auth();
      signedIn = Boolean(userId);
    } catch {
      signedIn = false;
    }
  }

  return (
    <html lang="en">
      <body>
        <AgeGate />
        <div className="app-shell">
          <nav className="nav">
            <Link href="/" className="brand">
              <span className="brand-mark" />
              <span>Postwise</span>
            </Link>
            <div className="nav-links">
              <Link href="/">Analyzer</Link>
              <Link href="/vault">Vault</Link>
              <Link href="/strategy">Strategy</Link>
              <Link href="/how-it-works">How it works</Link>
              {CLERK_ENABLED && !signedIn && (
                <SignInButton mode="modal" />
              )}
              {CLERK_ENABLED && signedIn && (
                <UserButton appearance={{ elements: { avatarBox: { width: 30, height: 30 } } }} />
              )}
            </div>
          </nav>
          {children}
          <footer className="footer">
            <div className="footer-tagline">
              Built for creators · No image storage on our side · Processed on your own Replicate account
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
  // Without Clerk, Shell still runs as async but with signedIn=false
  // @ts-expect-error async server component
  return <Shell>{children}</Shell>;
}
