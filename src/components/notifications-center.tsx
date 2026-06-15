"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check } from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export function NotificationsCenter({ collapsed }: { collapsed?: boolean }) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setItems(data.notifications ?? []);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, []);

  async function markRead(id: string) {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    load();
  }

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    load();
  }

  const unread = items.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`relative rounded-lg hover:bg-card-hover flex flex-col items-center justify-center ${
          collapsed ? "w-full min-h-[52px] gap-0.5 px-1 py-2" : "p-2"
        }`}
        title={collapsed ? "Notifications" : "Notifications"}
      >
        <Bell className="w-5 h-5 text-muted shrink-0" />
        {collapsed && <span className="text-[9px] leading-none font-medium text-muted">Alerts</span>}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-accent text-[10px] text-white flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full left-0 mb-2 w-72 max-h-80 overflow-y-auto bg-card border border-border rounded-xl shadow-xl z-50 scrollbar-thin">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-xs font-semibold">Notifications</span>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-[10px] text-accent hover:underline">
                  Mark all read
                </button>
              )}
            </div>
            {items.length === 0 ? (
              <p className="p-4 text-xs text-muted">No notifications yet</p>
            ) : (
              items.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  className={`px-3 py-2 border-b border-border/50 text-xs ${n.read ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {n.href ? (
                        <Link href={n.href} onClick={() => setOpen(false)} className="font-medium hover:text-accent">
                          {n.title}
                        </Link>
                      ) : (
                        <p className="font-medium">{n.title}</p>
                      )}
                      <p className="text-muted mt-0.5 line-clamp-2">{n.message}</p>
                    </div>
                    {!n.read && (
                      <button onClick={() => markRead(n.id)} className="shrink-0 p-1 hover:text-accent">
                        <Check className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
