"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { signOut } from "next-auth/react";
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ThemeToggle } from "./theme-toggle";

export interface SidebarLink {
  href: string;
  label: string;
  icon: ReactNode;
  description?: string;
}

export interface SidebarGroup {
  label: string;
  links: SidebarLink[];
  defaultCollapsed?: boolean;
}

interface SidebarProps {
  title: string;
  subtitle?: string;
  links?: SidebarLink[];
  groups?: SidebarGroup[];
  matchMode?: "exact" | "prefix";
  collapsibleGroups?: boolean;
  railCollapsible?: boolean;
  headerAction?: ReactNode;
  onNavigate?: () => void;
}

export function Sidebar({
  title,
  subtitle,
  links = [],
  groups,
  matchMode = "prefix",
  collapsibleGroups = false,
  railCollapsible = true,
  headerAction,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const navGroups = useMemo(() => groups ?? [{ label: "导航", links }], [groups, links]);
  const [signingOut, setSigningOut] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const shouldCollapseRail = railCollapsible && railCollapsed;

  const isActive = (href: string) =>
    matchMode === "exact" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    onNavigate?.();

    try {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    navGroups.reduce<Record<string, boolean>>((acc, group) => {
      const hasActive = group.links.some((link) => isActive(link.href));
      acc[group.label] = !hasActive && Boolean(group.defaultCollapsed) && collapsibleGroups;
      return acc;
    }, {}),
  );


  return (
    <aside
      className={cn(
        "nav-rail flex h-full flex-col overflow-hidden rounded-xl text-sidebar-foreground transition-[width] duration-200 ease-out",
        shouldCollapseRail ? "w-[4.75rem]" : "w-[15rem]",
      )}
    >
      <div className={cn("border-b border-sidebar-border py-4", shouldCollapseRail ? "px-3" : "px-4")}>
        <div className={cn("flex items-center", shouldCollapseRail ? "flex-col gap-2" : "gap-2.5")}>
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">
            S
          </div>
          {!shouldCollapseRail && (
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold tracking-[-0.02em]">{title}</p>
              {subtitle && (
                <p className="mt-0.5 truncate text-xs text-sidebar-foreground/55">{subtitle}</p>
              )}
            </div>
          )}
          {!shouldCollapseRail && <ThemeToggle className="border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground/62 hover:bg-sidebar-accent hover:text-sidebar-foreground" />}
          {!shouldCollapseRail && headerAction}
          {railCollapsible && (
            <button
              type="button"
              className="btn-base flex size-7 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground/62 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label={shouldCollapseRail ? "展开侧边栏" : "收起侧边栏"}
              title={shouldCollapseRail ? "展开侧边栏" : "收起侧边栏"}
              onClick={() => setRailCollapsed((value) => !value)}
            >
              {shouldCollapseRail ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
            </button>
          )}
        </div>
      </div>
      <nav
        className={cn("flex-1 space-y-4 overflow-y-auto py-3", shouldCollapseRail ? "px-2" : "px-3")}
        aria-label={`${title} 导航`}
      >
        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className="space-y-2">
            {(() => {
              const hasActive = group.links.some((link) => isActive(link.href));
              const isCollapsed =
                collapsibleGroups &&
                !shouldCollapseRail &&
                (collapsedGroups[group.label] ?? Boolean(group.defaultCollapsed));
              const isOpen = shouldCollapseRail || !isCollapsed;

              return (
                <>
                  {collapsibleGroups && !shouldCollapseRail ? (
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-md px-2.5 py-1 text-left text-[0.68rem] font-medium tracking-wide text-sidebar-foreground/45 transition-colors hover:bg-sidebar-accent/40 hover:text-sidebar-foreground/70"
                      aria-controls={`sidebar-group-${group.label}`}
                      aria-expanded={isOpen}
                      onClick={() =>
                        setCollapsedGroups((prev) => ({
                          ...prev,
                          [group.label]: !(prev[group.label] ?? (!hasActive && Boolean(group.defaultCollapsed))),
                        }))
                      }
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        className={cn(
                          "size-3.5 transition-transform duration-200",
                          isOpen ? "rotate-0" : "-rotate-90",
                        )}
                      />
                    </button>
                  ) : shouldCollapseRail && groupIndex > 0 ? (
                    <div className="mx-auto h-px w-6 bg-sidebar-border/70" aria-hidden />
                  ) : !shouldCollapseRail ? (
                    <p className="px-2.5 text-[0.68rem] font-medium tracking-wide text-sidebar-foreground/38">
                      {group.label}
                    </p>
                  ) : null}
                  <div
                    id={`sidebar-group-${group.label}`}
                    className={cn("space-y-1", !isOpen && "hidden")}
                  >
                    {group.links.map((link) => {
                      const active = isActive(link.href);

                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={onNavigate}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "nav-link-premium group flex items-center rounded-lg py-2 text-sm",
                            shouldCollapseRail ? "justify-center px-0" : "gap-2.5 px-2.5",
                            active
                              ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium"
                              : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                          )}
                          aria-label={shouldCollapseRail ? link.label : undefined}
                          title={shouldCollapseRail ? link.label : undefined}
                        >
                          <span
                            className={cn(
                              "flex size-7 items-center justify-center rounded-md transition-colors",
                              active ? "bg-white/18 text-sidebar-primary-foreground" : "text-sidebar-foreground/52 group-hover:text-sidebar-foreground"
                            )}
                          >
                            {link.icon}
                          </span>
                          {!shouldCollapseRail && <span className="min-w-0 flex-1 truncate">{link.label}</span>}
                          {active && !shouldCollapseRail && <span className="size-1.5 rounded-full bg-sidebar-primary-foreground/80" aria-hidden />}
                        </Link>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </nav>
      <div className={cn("space-y-2 border-t border-sidebar-border py-3", shouldCollapseRail ? "px-2" : "px-3")}>
        {shouldCollapseRail && <ThemeToggle className="w-full border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground/62 hover:bg-sidebar-accent hover:text-sidebar-foreground" />}
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className={cn(
            "btn-base btn-cream flex w-full items-center rounded-lg py-2 text-sm font-medium text-sidebar-foreground/75 hover:text-sidebar-foreground",
            shouldCollapseRail ? "justify-center px-0" : "gap-2 px-2.5 text-left",
          )}
          aria-label={signingOut ? "退出中" : "退出登录"}
          title={shouldCollapseRail ? (signingOut ? "退出中..." : "退出登录") : undefined}
        >
          <LogOut className="size-4 shrink-0" />
          {shouldCollapseRail ? <span className="sr-only">{signingOut ? "退出中..." : "退出登录"}</span> : signingOut ? "退出中..." : "退出登录"}
        </button>
      </div>
    </aside>
  );
}
