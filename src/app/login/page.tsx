import LoginForm from "@/components/auth/LoginForm";
import { noticeFromQuery } from "@/lib/auth/messages";

export const metadata = { title: "Log in · chatLOL" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;
  return <LoginForm notice={noticeFromQuery(error, reason)} />;
}
