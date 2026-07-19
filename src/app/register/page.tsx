import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { RegisterForm } from "@/components/auth-forms";

export const metadata = { title: "Create account" };

export default function RegisterPage() {
  return (
    <AuthFrame quote="Start the rivalry. Keep the history.">
      <h1>Create your account</h1>
      <p>Your first group is only a minute away.</p>
      <RegisterForm />
      <p className="auth-foot">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </AuthFrame>
  );
}
