import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";
import { ORDER_STATUS_LABEL } from "@/lib/constants";

/** 全部订单（可按日期/状态筛选） */
export async function GET(req: Request) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const status = searchParams.get("status");

  const orders = await prisma.order.findMany({
    where: {
      ...(date ? { date } : {}),
      ...(status && status in ORDER_STATUS_LABEL ? { status: status as never } : {}),
    },
    orderBy: [{ date: "desc" }, { timeSlot: "asc" }, { createdAt: "desc" }],
    include: { items: true, user: { select: { name: true, email: true } } },
    take: 200,
  });

  return NextResponse.json({ orders });
}
