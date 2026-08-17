import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatus } from "@prisma/client";
import { CalendarX2, CheckCircle2, ClipboardList, UtensilsCrossed } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { todayStr, formatCnDate, weekdayCn } from "@/lib/date";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/constants";
import { Badge, Button } from "@/components/ui";

export const metadata: Metadata = { title: "管理总览" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const today = todayStr();
  const [pendingCount, todayCount, dishCount, blockedCount, todayOrders, recentOrders] =
    await Promise.all([
      prisma.order.count({ where: { status: "PENDING" } }),
      prisma.order.count({
        where: { date: today, status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] } },
      }),
      prisma.dish.count(),
      prisma.blockedSlot.count({ where: { date: { gte: today } } }),
      prisma.order.findMany({
        where: { date: today },
        orderBy: { timeSlot: "asc" },
        include: { items: true, user: { select: { name: true } } },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        include: { items: true, user: { select: { name: true } } },
        take: 8,
      }),
    ]);

  const stats = [
    { label: "待确认订单", value: pendingCount, href: "/admin/orders", icon: ClipboardList },
    { label: "今日预订", value: todayCount, href: "/admin/orders", icon: CheckCircle2 },
    { label: "在售菜品", value: dishCount, href: "/admin/menu", icon: UtensilsCrossed },
    { label: "近期不可约", value: blockedCount, href: "/admin/schedule", icon: CalendarX2 },
  ];

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl font-bold">总览</h1>
      <p className="mt-1 text-sm text-muted">
        {formatCnDate(today)}（{weekdayCn(today)}）
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="rounded-2xl border border-line bg-card p-4 shadow-menu transition-colors hover:border-cinnabar/40"
            >
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </div>
              <div className="mt-2 font-display text-3xl font-black text-ink">{s.value}</div>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">今日订单</h2>
          <Link href="/admin/orders">
            <Button variant="ghost" size="sm">
              查看全部 →
            </Button>
          </Link>
        </div>

        {todayOrders.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-10 text-center text-muted">
            今天还没有订单
          </div>
        ) : (
          <ul className="mt-3 space-y-3">
            {todayOrders.map((o) => (
              <li key={o.id} className="rounded-2xl border border-line bg-card p-4 shadow-menu">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{o.guestName}</span>
                    <span className="text-muted">· {o.timeSlot}</span>
                  </div>
                  <Badge className={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/75">
                  {o.items.map((it) => (
                    <span key={it.id}>
                      {it.dishName} ×{it.quantity}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-display text-lg font-bold">最新订单</h2>
        {recentOrders.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-10 text-center text-muted">
            还没有任何订单，把网址发给朋友试试吧
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line/70 rounded-2xl border border-line bg-card px-4 shadow-menu sm:px-5">
            {recentOrders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div>
                  <span className="font-medium">
                    {o.guestName} · {formatCnDate(o.date)} {o.timeSlot}
                  </span>
                  <span className="ml-2 text-muted">
                    {o.items.map((it) => it.dishName).join("、")}
                  </span>
                </div>
                <Badge className={ORDER_STATUS_COLOR[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
