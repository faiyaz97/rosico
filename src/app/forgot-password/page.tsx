import Link from "next/link";
import { AuthFrame } from "@/components/auth-frame";
import { ForgotPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AuthFrame quote="A forgotten password should not end a winning streak.">
      <h1>Reset your password</h1>
      <p>
        Enter your account email. We will send a secure reset link if it matches
        an account.
      </p>
      <ForgotPasswordForm />
      <p className="auth-foot">
        <Link href="/login">Back to log in</Link>
      </p>
    </AuthFrame>
  );
}
