import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";
import { noticeFromQuery } from "@/lib/auth/messages";

export const metadata = { title: "Reset password · chatLOL" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;
  return <ForgotPasswordForm notice={noticeFromQuery(error, reason)} />;
}
