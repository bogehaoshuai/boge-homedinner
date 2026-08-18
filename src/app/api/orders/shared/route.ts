import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isTimeSlot } from "@/lib/constants";
import { isBookableDate } from "@/lib/date";

/**
 * 查询某个（日期 + 午/晚饭）的共享订单（含全部条目），供点单页展示「大家都点了什么」。
 * GET /api/orders/shared?date=2026-08-18&timeSlot=晚饭
 */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || "";
  const timeSlot = searchParams.get("timeSlot") || "";

  if (!isBookableDate(date) || !isTimeSlot(timeSlot)) {
    return NextResponse.json({ error: "参数无效" }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { date_timeSlot: { date, timeSlot } },
    include: { items: true },
  });

  return NextResponse.json({ order });
}
