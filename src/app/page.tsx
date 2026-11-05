import { redirect } from "next/navigation";
import ChatApp from "@/components/ChatApp";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Server-side check (the middleware also guards this route).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // key: a different user always gets a fresh chat state
  return <ChatApp key={user.id} userId={user.id} userEmail={user.email ?? "Unknown email"} />;
}
