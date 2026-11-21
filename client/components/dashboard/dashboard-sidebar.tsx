"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FolderKanban,
  Clock3,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { SiteLogo } from "@/components/layout/site-logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { authClient, type AuthUser } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

type SidebarUser = Pick<AuthUser, "name" | "email" | "image">;

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Workspaces", href: "/dashboard#workspaces", icon: FolderKanban },
  { label: "Recent Activity", href: "/dashboard#recent", icon: Clock3 },
  { label: "Settings", href: "/dashboard", icon: Settings, disabled: true },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/dashboard" && pathname === "/dashboard";
        const content = (
          <>
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
            {item.disabled && (
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/60">
                Soon
              </span>
            )}
          </>
        );

        if (item.disabled) {
          return (
            <span
              key={item.label}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground/50"
            >
              {content}
            </span>
          );
        }

        const isHash = item.href.includes("#");
        const className = cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          active
            ? "bg-white/[0.06] text-foreground"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
        );

        if (isHash) {
          return (
            <a
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={className}
            >
              {content}
            </a>
          );
        }

        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            className={className}
          >
            {content}
          </Link>
        );
      })}
    </nav>
  );
}

function UserFooter({
  user,
  onLogout,
}: {
  user?: SidebarUser;
  onLogout: () => void;
}) {
  const initials = (user?.name || user?.email || "U")
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="mt-auto border-t border-white/5 p-3">
      <div className="flex items-center gap-3 rounded-xl px-2 py-2">
        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-gradient-to-br from-[#477BFF]/30 to-[#42D8F5]/20 text-xs font-medium text-foreground">
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {user?.name || "User"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user?.email || ""}
          </p>
        </div>
      </div>
      <Button
        variant="ghost"
        onClick={onLogout}
        className="mt-1 w-full justify-start gap-3 rounded-xl px-3 text-muted-foreground hover:bg-white/[0.04] hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Log out
      </Button>
    </div>
  );
}

function SidebarBody({
  user,
  onLogout,
  onNavigate,
}: {
  user?: SidebarUser;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center border-b border-white/5 px-4">
        <SiteLogo href="/dashboard" />
      </div>
      <NavLinks onNavigate={onNavigate} />
      <UserFooter user={user} onLogout={onLogout} />
    </div>
  );
}

export function DashboardSidebar({ user }: { user?: SidebarUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      queryClient.clear();
      await authClient.signOut();
    } finally {
      router.replace("/login");
      router.refresh();
      setLoggingOut(false);
      setOpen(false);
    }
  };

  return (
    <>
      <aside className="hidden w-64 shrink-0 border-r border-white/5 bg-[#070a12]/60 backdrop-blur-xl lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
        <SidebarBody user={user} onLogout={handleLogout} />
      </aside>

      <div className="fixed left-4 top-4 z-40 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-xl border-white/10 bg-[#101522]/80 backdrop-blur"
                aria-label="Open menu"
                disabled={loggingOut}
              />
            }
          >
            <Menu className="h-4 w-4" />
          </SheetTrigger>
          <SheetContent
            side="left"
            showCloseButton={false}
            className="w-[280px] border-white/10 bg-[#070a12] p-0 sm:max-w-[280px]"
          >
            <SidebarBody
              user={user}
              onLogout={handleLogout}
              onNavigate={() => setOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
