import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = { title: "New password · chatLOL" };

// The middleware only lets signed-in users reach this page; the reset link signs them in first.
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
