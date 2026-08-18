import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isTimeSlot } from "@/lib/constants";
import { isBookableDate } from "@/lib/date";
import { sendOrderNotificationEmail } from "@/lib/email";

type OrderItemInput = {
  dishId: string;
  quantity: number;
  optionIds: string[];
};

type EmailItem = {
  dishId: string;
  dishName: string;
  priceCents: number;
  quantity: number;
  options: { group: string; choice: string }[];
  ingredients: { name: string; gramsPerServing: number }[];
};

/** 下单 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const date: string = String(body.date ?? "");
    const timeSlot: string = String(body.timeSlot ?? "");
    const notes: string = String(body.notes ?? "").slice(0, 300);
    const itemsRaw: unknown = body.items;

    // 基础校验
    if (!isBookableDate(date)) {
      return NextResponse.json({ error: "日期无效或已过期" }, { status: 400 });
    }
    if (!isTimeSlot(timeSlot)) {
      return NextResponse.json({ error: "请选择有效的时间席" }, { status: 400 });
    }
    if (!Array.isArray(itemsRaw) || itemsRaw.length === 0) {
      return NextResponse.json({ error: "请至少点一道菜" }, { status: 400 });
    }

    const items: OrderItemInput[] = itemsRaw
      .map((it: unknown) => {
        const o = it as { dishId?: string; quantity?: number; optionIds?: unknown };
        return {
          dishId: String(o.dishId ?? ""),
          quantity: Math.max(1, Math.floor(Number(o.quantity) || 1)),
          optionIds: Array.isArray(o.optionIds)
            ? o.optionIds.filter((x): x is string => typeof x === "string")
            : [],
        };
      })
      .filter((it) => it.dishId);

    if (items.length === 0) {
      return NextResponse.json({ error: "请选择有效的菜品" }, { status: 400 });
    }

    // 校验时段未被主人屏蔽
    const blocked = await prisma.blockedSlot.findFirst({
      where: {
        date,
        OR: [
          // 全天屏蔽
          { timeFrom: null },
          // 时间段屏蔽：timeFrom <= 下单时间，且（timeTo 为空表示直到当天结束）
          {
            timeFrom: { lte: timeSlot },
            OR: [{ timeTo: null }, { timeTo: { gte: timeSlot } }],
          },
        ],
      },
    });
    if (blocked) {
      return NextResponse.json({ error: "这个时段主人不方便，换一个吧" }, { status: 400 });
    }

    // 取菜品（含选项组与原料），快照名称/价格/选项/原料，计算合计
    const ids = [...new Set(items.map((i) => i.dishId))];
    const dishes = await prisma.dish.findMany({
      where: { id: { in: ids }, available: true },
      include: {
        optionGroups: { include: { options: true } },
        ingredients: true,
      },
    });
    const dishMap = new Map(dishes.map((d) => [d.id, d]));

    let totalCents = 0;
    const validItems: EmailItem[] = [];
    for (const it of items) {
      const dish = dishMap.get(it.dishId);
      if (!dish) continue;

      // 校验所选选项属于该菜，且必选组都已选
      const allOptions = dish.optionGroups.flatMap((g) => g.options);
      const selected = allOptions.filter((o) => it.optionIds.includes(o.id));
      const selectedGroupIds = new Set(selected.map((o) => o.groupId));
      const missingRequired = dish.optionGroups.some(
        (g) => g.isRequired && !selectedGroupIds.has(g.id)
      );
      if (missingRequired) {
        return NextResponse.json(
          { error: `「${dish.name}」还有必选的口味没选` },
          { status: 400 }
        );
      }

      const optionsSnapshot = selected.map((o) => {
        const g = dish.optionGroups.find((grp) => grp.id === o.groupId);
        return { group: g?.name ?? "", choice: o.label };
      });

      totalCents += dish.priceCents * it.quantity;
      validItems.push({
        dishId: dish.id,
        dishName: dish.name,
        priceCents: dish.priceCents,
        quantity: it.quantity,
        options: optionsSnapshot,
        ingredients: dish.ingredients.map((ing) => ({
          name: ing.name,
          gramsPerServing: ing.gramsPerServing,
        })),
      });
    }
    if (validItems.length === 0) {
      return NextResponse.json({ error: "所选菜品不可用，请刷新菜单" }, { status: 400 });
    }

    // 写入订单 + 明细（事务）
    const order = await prisma.order.create({
      data: {
        userId: session.id,
        guestName: session.name,
        date,
        timeSlot,
        notes: notes || null,
        totalCents,
        items: {
          create: validItems.map((it) => ({
            dishId: it.dishId,
            dishName: it.dishName,
            priceCents: it.priceCents,
            quantity: it.quantity,
            options: it.options.length > 0 ? it.options : undefined,
            ingredients: it.ingredients.length > 0 ? it.ingredients : undefined,
          })),
        },
      },
    });

    // 邮件通知（尽力而为，不阻塞下单）；用请求 origin 拼链接，避免指向 localhost
    const origin = new URL(req.url).origin;
    void sendOrderNotificationEmail(
      {
        orderId: order.id,
        guestName: order.guestName,
        date: order.date,
        timeSlot: order.timeSlot,
        notes: order.notes,
        totalCents: order.totalCents,
        items: validItems,
      },
      origin
    );

    return NextResponse.json(
      { ok: true, order: { id: order.id, date, timeSlot, totalCents } },
      { status: 201 }
    );
  } catch (e) {
    console.error("[order create]", e);
    return NextResponse.json({ error: "下单失败，请稍后再试" }, { status: 500 });
  }
}

/** 我的订单 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 50,
  });

  return NextResponse.json({ orders });
}
