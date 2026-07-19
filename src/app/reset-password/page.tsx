import { AuthFrame } from "@/components/auth-frame";
import { ResetPasswordForm } from "@/components/auth-forms";

export const metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  return (
    <AuthFrame quote="Fresh password. Same fierce competition.">
      <h1>Choose a new password</h1>
      <p>Use a password you have not used for another service.</p>
      <ResetPasswordForm />
    </AuthFrame>
  );
}
