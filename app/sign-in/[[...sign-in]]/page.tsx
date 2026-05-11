import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
      <SignIn appearance={{ elements: { rootBox: { width: "100%", maxWidth: 420 } } }} />
    </main>
  );
}
