import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TIME_SLOTS, mealLabel } from "@/lib/constants";
import { isBookableDate } from "@/lib/date";

/**
 * 查询某一天的可约时段
 * GET /api/slots?date=2026-08-20
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || "";

  if (!isBookableDate(date)) {
    return NextResponse.json({ error: "日期无效或已过期" }, { status: 400 });
  }

  const blocked = await prisma.blockedSlot.findMany({ where: { date } });

  const wholeDayBlocked = blocked.some((b) => b.timeFrom === null);
  const note = blocked.find((b) => b.note)?.note ?? null;

  const slots = TIME_SLOTS.map((time) => {
    let available = !wholeDayBlocked;
    if (available) {
      for (const b of blocked) {
        const from = b.timeFrom ?? "00:00";
        const to = b.timeTo ?? "23:59";
        if (from <= time && time <= to) {
          available = false;
          break;
        }
      }
    }
    return { time, label: mealLabel(time), available };
  });

  return NextResponse.json({ date, dayBlocked: wholeDayBlocked, note, slots });
}
