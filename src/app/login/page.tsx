import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { LoginForm } from "@/components/auth-forms";

export const metadata = { title: "Log in" };

export default function LoginPage() {
  return (
    <AuthFrame>
      <h1>Welcome back</h1>
      <p>Sign in to get back to your groups.</p>
      <LoginForm />
      <p className="auth-foot">
        New to Rosica? <Link href="/register">Create an account</Link>
      </p>
    </AuthFrame>
  );
}
