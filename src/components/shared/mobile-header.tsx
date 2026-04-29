"use client";

import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { MobileDrawer } from "./mobile-drawer";
import { Sidebar, type SidebarGroup, type SidebarLink } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";

interface MobileHeaderProps {
  title: string;
  subtitle?: string;
  links?: SidebarLink[];
  groups?: SidebarGroup[];
  matchMode?: "exact" | "prefix";
  collapsibleGroups?: boolean;
  actions?: ReactNode;
}

export function MobileHeader({ title, subtitle, links, groups, matchMode, collapsibleGroups, actions }: MobileHeaderProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-40 mx-3 mt-3 flex h-12 items-center justify-between rounded-xl border border-sidebar-border bg-sidebar/95 px-3 shadow-sm backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-md bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">S</span>
          <span className="text-sm font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle className="border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground" />
          {actions}
          <button
            onClick={() => setOpen(true)}
            className="btn-base btn-cream -mr-1 flex size-8 items-center justify-center rounded-lg"
            aria-label="打开菜单"
          >
            <Menu size={20} />
          </button>
        </div>
      </header>
      <MobileDrawer open={open} onOpenChange={setOpen}>
        <Sidebar
          title={title}
          subtitle={subtitle}
          links={links}
          groups={groups}
          matchMode={matchMode}
          collapsibleGroups={collapsibleGroups}
          railCollapsible={false}
          onNavigate={() => setOpen(false)}
        />
      </MobileDrawer>
    </div>
  );
}
