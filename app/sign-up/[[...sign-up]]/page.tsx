import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main style={{ display: "flex", justifyContent: "center", paddingTop: 48 }}>
      <SignUp appearance={{ elements: { rootBox: { width: "100%", maxWidth: 420 } } }} />
    </main>
  );
}
