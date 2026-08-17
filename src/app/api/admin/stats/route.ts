import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";
import { todayStr } from "@/lib/date";

/** 管理后台看板数据 */
export async function GET() {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

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

  return NextResponse.json({
    stats: { pendingCount, todayCount, dishCount, blockedCount },
    todayOrders,
    recentOrders,
    today,
  });
}
