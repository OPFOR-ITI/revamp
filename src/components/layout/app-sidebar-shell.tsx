"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronsUpDown,
  Loader2,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import type { AppNavGroup } from "@/components/layout/app-navigation";
import { AppSidebarNav } from "@/components/layout/app-sidebar-nav";
import { authClient } from "@/lib/auth-client";
import { formatUserRolesLabel } from "@/lib/access-control";
import type { UserRole } from "@/lib/constants";

function getViewerInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppSidebarShell({
  viewer,
  title,
  description,
  navGroups,
  children,
  nominalRollCount,
}: {
  viewer: {
    name: string;
    email: string;
    roles?: UserRole[];
  };
  title: string;
  description?: string;
  navGroups: AppNavGroup[];
  children: React.ReactNode;
  nominalRollCount?: string | number;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const viewerInitials = getViewerInitials(viewer.name);
  const rolesLabel =
    viewer.roles && viewer.roles.length ? formatUserRolesLabel(viewer.roles) : null;

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <SidebarProvider
      defaultOpen
      className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(79,120,67,0.14),_transparent_42%),linear-gradient(180deg,_#f4f0e3_0%,_#ebe5d4_45%,_#e1e7d9_100%)]"
    >
      <Sidebar variant="inset" collapsible="icon" className="border-sidebar-border/70">
        <SidebarHeader className="gap-2 p-3">
          <div className="rounded-2xl border border-sidebar-border/80 bg-white/70 px-3 py-3 shadow-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-900/55">
              Revamp
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-900">
              Daily operations board
            </p>
          </div>
        </SidebarHeader>

        <SidebarContent>
          <AppSidebarNav groups={navGroups} />
        </SidebarContent>

        <SidebarSeparator />

        <SidebarFooter className="gap-3 p-3">
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <SidebarMenuButton
                  size="lg"
                  className="bg-[linear-gradient(135deg,_rgba(49,80,42,0.96),_rgba(87,103,53,0.88))] text-white hover:bg-[linear-gradient(135deg,_rgba(55,88,46,0.98),_rgba(95,112,59,0.9))] hover:text-white data-active:bg-[linear-gradient(135deg,_rgba(55,88,46,0.98),_rgba(95,112,59,0.9))] data-[state=open]:bg-white/10"
                  render={<DropdownMenuTrigger />}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg bg-white/14 text-xs font-semibold text-white">
                    {viewerInitials || "U"}
                  </div>
                  <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{viewer.name}</span>
                      {nominalRollCount !== undefined ? (
                        <span className="rounded-md bg-white/12 px-1.5 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-emerald-50/90">
                          {nominalRollCount}
                        </span>
                      ) : null}
                    </div>
                    <span className="truncate text-xs text-emerald-100/75">
                      {viewer.email}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto size-4 text-emerald-50/80" />
                </SidebarMenuButton>
                <DropdownMenuContent side="top" align="end">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="px-2 py-2">
                      <div className="flex items-center gap-3">
                        <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-900 text-xs font-semibold text-white">
                          {viewerInitials || "U"}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {viewer.name}
                          </p>
                          <p className="truncate text-xs font-normal text-muted-foreground">
                            {viewer.email}
                          </p>
                        </div>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  {rolesLabel ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem disabled>
                          <ShieldCheck className="size-4" />
                          Roles
                          <span className="ml-auto text-xs text-muted-foreground">
                            {rolesLabel}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                  {nominalRollCount !== undefined ? (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem disabled>
                          <UserRound className="size-4" />
                          Nominal Roll
                          <span className="ml-auto text-xs text-muted-foreground">
                            {nominalRollCount}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  ) : null}
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => {
                        void handleSignOut();
                      }}
                      disabled={isSigningOut}
                    >
                      {isSigningOut ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogOut className="size-4" />
                      )}
                      Sign out
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-transparent">
        <div className="flex min-h-svh flex-col">
          <header className="sticky top-0 z-20 border-b border-emerald-950/10 bg-background/80 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-start gap-3 px-4 py-3 sm:items-center sm:px-6">
              <SidebarTrigger className="mt-0.5 shrink-0 sm:mt-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-900/55">
                  Revamp operations board
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h1 className="text-lg font-semibold tracking-tight text-zinc-950">
                    {title}
                  </h1>
                  {rolesLabel ? (
                    <Badge
                      variant="outline"
                      className="border-emerald-950/10 bg-white/70 text-zinc-700"
                    >
                      {rolesLabel}
                    </Badge>
                  ) : null}
                </div>
                {description ? (
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-zinc-600">
                    {description}
                  </p>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 px-4 py-4 sm:px-6">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
