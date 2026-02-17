"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Library,
  Upload,
  FolderOpen,
  BarChart3,
  LogOut,
  GitCompareArrows,
} from "lucide-react";

const navItems = [
  { href: "/library", label: "Library", icon: Library },
  { href: "/upload", label: "Upload", icon: Upload },
  { href: "/compare", label: "Compare", icon: GitCompareArrows },
  { href: "/collections", label: "Collections", icon: FolderOpen },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="flex h-full w-56 flex-col border-r">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-6 w-6"
          strokeWidth="1.5"
          stroke="currentColor"
        >
          <path
            d="M12 3C12 3 12 8 12 12C12 16 12 21 12 21"
            strokeLinecap="round"
          />
          <path
            d="M12 7C14.5 7 16.5 5.5 16.5 3.5"
            strokeLinecap="round"
          />
          <path
            d="M12 12C9 12 6.5 10 6.5 7.5"
            strokeLinecap="round"
          />
          <path
            d="M12 17C15 17 17.5 15 17.5 12.5"
            strokeLinecap="round"
          />
        </svg>
        <span className="text-base font-semibold tracking-tight">Resonance</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                isActive
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t px-2 py-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-foreground text-sm h-8"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}
