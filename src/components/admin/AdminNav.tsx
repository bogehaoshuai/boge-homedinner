"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarX2,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  UtensilsCrossed,
} from "lucide-react";
import { logout } from "@/lib/use-user";

const links = [
  { href: "/admin", label: "总览", icon: LayoutDashboard },
  { href: "/admin/menu", label: "菜品管理", icon: UtensilsCrossed },
  { href: "/admin/orders", label: "订单", icon: ClipboardList },
  { href: "/admin/schedule", label: "不可约时间", icon: CalendarX2 },
];

export default function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <aside className="flex w-full flex-col border-b border-line bg-card md:w-56 md:border-b-0 md:border-r md:min-h-[calc(100vh-4rem)]">
      <div className="hidden items-center gap-2 px-4 py-5 md:flex">
        <span className="seal h-9 w-9 text-lg">宴</span>
        <div>
          <div className="font-display text-base font-bold leading-tight">管理后台</div>
          <div className="text-xs text-muted">主人专用</div>
        </div>
      </div>

      <nav className="flex gap-1 overflow-x-auto px-2 py-2 md:flex-col md:px-3 md:py-2">
        {links.map((l) => {
          const active = pathname === l.href;
          const Icon = l.icon;
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-cinnabar-light font-medium text-cinnabar"
                  : "text-ink/70 hover:bg-ink/5 hover:text-ink"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{l.label}</span>
            </Link>
          );
        })}
        <button
          onClick={async () => {
            await logout();
            router.refresh();
          }}
          className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink/50 hover:bg-ink/5 hover:text-ink"
        >
          <LogOut className="h-4 w-4" />
          <span>退出</span>
        </button>
      </nav>
    </aside>
  );
}
