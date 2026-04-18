import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function BatchAnalyzeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const adminEmail = process.env.ADMIN_EMAIL;

  if (!user || !adminEmail || user.email?.toLowerCase().trim() !== adminEmail.toLowerCase().trim()) {
    redirect("/library");
  }

  return <>{children}</>;
}
