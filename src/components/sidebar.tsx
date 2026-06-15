"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Calendar,
  ListTodo,
  TrendingUp,
  FolderKanban,
  Clapperboard,
  Megaphone,
  BarChart3,
  GitBranch,
  FileCheck,
  HelpCircle,
  BookOpen,
  Settings,
  ChevronLeft,
  PanelLeftOpen,
  ChevronDown,
  Menu,
  X,
  Radar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchTrigger, GlobalSearch } from "@/components/global-search";
import { NotificationsCenter } from "@/components/notifications-center";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";

const STORAGE_KEY = "curiostudio-sidebar-collapsed";
const GROUPS_KEY = "curiostudio-sidebar-groups";
const COLLAPSED_WIDTH = "w-16";

type NavItem = { href: string; icon: React.ComponentType<{ className?: string }>; label: string; abbr: string };

const NAV_GROUPS: { id: string; label: string; defaultCollapsed?: boolean; items: NavItem[] }[] = [
  {
    id: "today",
    label: "TODAY",
    items: [
      { href: "/", icon: LayoutDashboard, label: "Dashboard", abbr: "Home" },
      { href: "/calendar", icon: Calendar, label: "Calendar", abbr: "Cal" },
      { href: "/queue", icon: ListTodo, label: "Queue", abbr: "Queue" },
    ],
  },
  {
    id: "create",
    label: "CREATE",
    items: [
      { href: "/discover", icon: TrendingUp, label: "Discover", abbr: "Find" },
      { href: "/projects", icon: FolderKanban, label: "Projects", abbr: "Proj" },
      { href: "/studio", icon: Clapperboard, label: "Studio", abbr: "Studio" },
    ],
  },
  {
    id: "grow",
    label: "GROW",
    items: [
      { href: "/leads", icon: Radar, label: "Insider Tracker", abbr: "Leads" },
      { href: "/marketing", icon: Megaphone, label: "Marketing", abbr: "Mktg" },
      { href: "/analytics", icon: BarChart3, label: "Analytics", abbr: "Stats" },
    ],
  },
  {
    id: "operate",
    label: "OPERATE",
    defaultCollapsed: true,
    items: [
      { href: "/workflows", icon: GitBranch, label: "Workflows", abbr: "Flow" },
      { href: "/processes", icon: FileCheck, label: "Processes", abbr: "SOP" },
    ],
  },
  {
    id: "learn",
    label: "LEARN",
    defaultCollapsed: true,
    items: [
      { href: "/help", icon: HelpCircle, label: "Help", abbr: "Help" },
      { href: "/docs", icon: BookOpen, label: "Docs", abbr: "Docs" },
    ],
  },
  {
    id: "system",
    label: "SYSTEM",
    defaultCollapsed: true,
    items: [{ href: "/settings", icon: Settings, label: "Settings", abbr: "Set" }],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href === "/studio") return pathname.startsWith("/studio");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLink({
  href,
  icon: Icon,
  label,
  abbr,
  active,
  collapsed,
  onNavigate,
}: {
  href: string;
  icon: NavItem["icon"];
  label: string;
  abbr: string;
  active: boolean;
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex rounded-lg text-sm transition-colors w-full",
        collapsed
          ? "flex-col items-center justify-center min-h-[48px] px-1 py-1.5 gap-0.5"
          : "flex-row items-center gap-2.5 px-2.5 py-2",
        active
          ? "bg-accent/10 text-accent"
          : "text-muted hover:text-foreground hover:bg-card-hover"
      )}
    >
      <Icon className={cn("shrink-0", collapsed ? "w-5 h-5" : "w-4 h-4")} />
      {collapsed ? (
        <span className="text-[9px] leading-none font-medium truncate max-w-full">{abbr}</span>
      ) : (
        <span className="truncate flex-1 text-left">{label}</span>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip content={label} side="right">
        {link}
      </Tooltip>
    );
  }

  return link;
}

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setCollapsed(true);
    try {
      const g = localStorage.getItem(GROUPS_KEY);
      if (g) {
        setCollapsedGroups(JSON.parse(g));
      } else {
        const defaults: Record<string, boolean> = {};
        for (const group of NAV_GROUPS) {
          if (group.defaultCollapsed) defaults[group.id] = true;
        }
        setCollapsedGroups(defaults);
      }
    } catch {
      /* ignore */
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }

  function expandSidebar() {
    if (!collapsed) return;
    setCollapsed(false);
    localStorage.setItem(STORAGE_KEY, "false");
  }

  function toggleGroup(id: string) {
    setCollapsedGroups((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      localStorage.setItem(GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const sidebarContent = (
    <>
      <div className="shrink-0 border-b border-border">
        {collapsed ? (
          <button
            type="button"
            onClick={expandSidebar}
            className="w-full flex flex-col items-center justify-center gap-0.5 py-2.5 hover:bg-card-hover transition-colors"
            title="Expand sidebar"
            aria-label="Expand sidebar"
          >
            <PanelLeftOpen className="w-5 h-5 text-accent" />
          </button>
        ) : null}

        <div className={cn("flex items-center", collapsed ? "justify-center p-2" : "gap-2 p-3")}>
          <Link
            href="/"
            className={cn("flex items-center min-w-0", collapsed ? "justify-center" : "gap-2")}
            onClick={() => setMobileOpen(false)}
            title={collapsed ? "CurioStudio" : undefined}
          >
            <Image
              src="/logo.png"
              alt="CurioStudio"
              width={32}
              height={32}
              className="shrink-0 rounded-lg"
            />
            {!collapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-sm text-white truncate">CurioStudio</h1>
                <p className="text-[10px] text-muted">Content Business OS</p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <button
              type="button"
              onClick={toggleCollapsed}
              className="ml-auto p-1.5 rounded-lg hover:bg-card-hover text-muted hidden lg:flex items-center justify-center"
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className={cn("shrink-0", collapsed ? "px-2 py-1.5" : "px-2 py-1")}>
        <SearchTrigger collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin px-2 py-1 space-y-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-muted/80 tracking-wider hover:text-foreground"
              >
                {group.label}
                <ChevronDown
                  className={cn("w-3 h-3 transition-transform", collapsedGroups[group.id] && "-rotate-90")}
                />
              </button>
            )}
            {(!collapsedGroups[group.id] || collapsed) && (
              <div className={cn(collapsed ? "space-y-0.5" : "space-y-0.5")}>
                {group.items.map(({ href, icon, label, abbr }) => (
                  <NavLink
                    key={href}
                    href={href}
                    icon={icon}
                    label={label}
                    abbr={abbr}
                    active={isActive(pathname, href)}
                    collapsed={collapsed}
                    onNavigate={() => setMobileOpen(false)}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div
        className={cn(
          "shrink-0 border-t border-border flex items-center",
          collapsed ? "justify-center p-2" : "p-2"
        )}
      >
        <NotificationsCenter collapsed={collapsed} />
      </div>
    </>
  );

  return (
    <TooltipProvider>
      <GlobalSearch />

      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-40 p-2 rounded-lg bg-card border border-border"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <aside
        className={cn(
          "hidden lg:flex shrink-0 bg-card/50 flex-col h-screen sticky top-0 transition-all duration-200",
          collapsed ? `${COLLAPSED_WIDTH} border-r border-border` : "w-56 border-r border-border"
        )}
      >
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-56 bg-card border-r border-border flex flex-col h-full animate-slide-up">
            <button
              type="button"
              className="absolute top-3 right-3 p-1 rounded hover:bg-card-hover"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}
    </TooltipProvider>
  );
}
