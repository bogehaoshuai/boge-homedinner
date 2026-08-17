import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";
import { isBookableDate } from "@/lib/date";
import { isTimeSlot } from "@/lib/constants";

/** 不可约时段列表 */
export async function GET() {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  const slots = await prisma.blockedSlot.findMany({
    orderBy: [{ date: "desc" }, { timeFrom: "asc" }],
    take: 200,
  });
  return NextResponse.json({ slots });
}

/** 新增不可约时段：全天屏蔽或某个时间段屏蔽 */
export async function POST(req: Request) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  try {
    const body = await req.json();
    const date = String(body.date ?? "");
    const note = String(body.note ?? "").trim() || null;
    const timeFrom = body.timeFrom ? String(body.timeFrom) : null;
    const timeTo = body.timeTo ? String(body.timeTo) : null;

    if (!isBookableDate(date)) {
      return NextResponse.json({ error: "日期无效或已过期" }, { status: 400 });
    }
    if (timeFrom && !isTimeSlot(timeFrom)) {
      return NextResponse.json({ error: "开始时间无效" }, { status: 400 });
    }
    if (timeTo && !isTimeSlot(timeTo)) {
      return NextResponse.json({ error: "结束时间无效" }, { status: 400 });
    }
    if (timeFrom && timeTo && timeFrom > timeTo) {
      return NextResponse.json({ error: "结束时间需晚于开始时间" }, { status: 400 });
    }
    if (!timeFrom && timeTo) {
      return NextResponse.json({ error: "请选择开始时间（或选择全天）" }, { status: 400 });
    }

    const slot = await prisma.blockedSlot.create({
      data: { date, timeFrom, timeTo, note },
    });
    return NextResponse.json({ slot }, { status: 201 });
  } catch (e) {
    console.error("[admin slot create]", e);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
