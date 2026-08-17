"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LayoutDashboard, LogOut } from "lucide-react";
import { useUser, logout } from "@/lib/use-user";
import { APP_NAME } from "@/lib/constants";

export default function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useUser();

  // 管理后台有自己的导航，不显示公共头部
  if (pathname.startsWith("/admin")) return null;

  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-paper/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="seal h-9 w-9 text-lg">宴</span>
          <span className="font-display text-xl font-bold tracking-wide">
            {APP_NAME}
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/orders"
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
          >
            <ClipboardList className="h-4 w-4" />
            <span className="hidden sm:inline">我的订单</span>
          </Link>

          {user?.role === "HOST" && (
            <Link
              href="/admin"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-cinnabar hover:bg-cinnabar/10"
            >
              <LayoutDashboard className="h-4 w-4" />
              <span className="hidden sm:inline">管理后台</span>
            </Link>
          )}

          {isLoggedIn ? (
            <button
              onClick={async () => {
                await logout();
                router.refresh();
              }}
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-ink/70 hover:bg-ink/5 hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">退出</span>
            </button>
          ) : (
            <Link
              href="/login"
              className="ml-1 rounded-lg bg-cinnabar px-4 py-2 text-sm font-medium text-white hover:bg-cinnabar-dark"
            >
              登录
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
