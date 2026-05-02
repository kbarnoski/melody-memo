import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/nav/sidebar";
import { PillarNav } from "@/components/nav/pillar-nav";
import { StudioTracker } from "./studio-tracker";
import { ProfilePrompt } from "@/components/ui/profile-prompt";

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-black">
      <PillarNav />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <StudioTracker />
        <ProfilePrompt />
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden pt-14 md:pt-0"
          style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}
        >
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 md:pb-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
