import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { isTimeSlot } from "@/lib/constants";
import { isBookableDate } from "@/lib/date";
import { sendUpdateWithTimeout } from "@/lib/order-email";

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

/**
 * 下单：往「共享订单」里追加菜品。
 * 同一（日期 + 午/晚饭）只有一个共享订单，任何人加入都进同一单；
 * 所有人可互相看见，且待确认（PENDING）状态下可互相改删。
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const date: string = String(body.date ?? "");
    const timeSlot: string = String(body.timeSlot ?? "");
    const notes: string = String(body.notes ?? "").trim().slice(0, 200);
    const itemsRaw: unknown = body.items;

    // 基础校验
    if (!isBookableDate(date)) {
      return NextResponse.json({ error: "日期无效或已过期" }, { status: 400 });
    }
    if (!isTimeSlot(timeSlot)) {
      return NextResponse.json({ error: "请选择有效的时间段" }, { status: 400 });
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

    // 取菜品（含选项组与原料），快照名称/价格/选项/原料
    const ids = [...new Set(items.map((i) => i.dishId))];
    const dishes = await prisma.dish.findMany({
      where: { id: { in: ids }, available: true },
      include: {
        optionGroups: { include: { options: true } },
        ingredients: true,
      },
    });
    const dishMap = new Map(dishes.map((d) => [d.id, d]));

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

    // 找到或创建该时段的共享订单（一个 (date, timeSlot) 只有一个）
    let order = await prisma.order.findUnique({
      where: { date_timeSlot: { date, timeSlot } },
    });
    if (order && order.status !== OrderStatus.PENDING) {
      return NextResponse.json(
        { error: "这个时段的订单已被主人确认，无法再点" },
        { status: 409 }
      );
    }
    if (!order) {
      try {
        order = await prisma.order.create({
          data: {
            userId: session.id,
            guestName: session.name,
            date,
            timeSlot,
            status: OrderStatus.PENDING,
            totalCents: 0,
          },
        });
      } catch (e) {
        // 并发：另一个人刚好同时创建了同一时段的订单 → 再查一次并追加
        if ((e as { code?: string }).code === "P2002") {
          order = await prisma.order.findUnique({
            where: { date_timeSlot: { date, timeSlot } },
          });
          if (!order || order.status !== OrderStatus.PENDING) {
            return NextResponse.json(
              { error: "这个时段的订单已被主人确认，无法再点" },
              { status: 409 }
            );
          }
        } else {
          throw e;
        }
      }
    }

    // 追加明细
    await prisma.orderItem.createMany({
      data: validItems.map((it) => ({
        orderId: order.id,
        dishId: it.dishId,
        dishName: it.dishName,
        priceCents: it.priceCents,
        quantity: it.quantity,
        options: it.options.length > 0 ? it.options : undefined,
        ingredients: it.ingredients.length > 0 ? it.ingredients : undefined,
        addedByUserId: session.id,
        addedByName: session.name,
      })),
    });

    // 重算合计 + 追加备注（保留之前别人写的备注）
    const all = await prisma.orderItem.findMany({ where: { orderId: order.id } });
    const totalCents = all.reduce((s, x) => s + x.priceCents * x.quantity, 0);
    const appendedNotes = notes
      ? order.notes
        ? `${order.notes}\n${session.name}：${notes}`.slice(0, 1000)
        : `${session.name}：${notes}`
      : order.notes;

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: { totalCents, notes: appendedNotes },
      include: { items: true },
    });

    // 邮件通知（每次操作都发；等待发送完成再返回，避免 serverless 冻结丢失）
    const origin = new URL(req.url).origin;
    await sendUpdateWithTimeout(updated, "提交了点单", session.name, origin);

    return NextResponse.json(
      {
        ok: true,
        order: { id: updated.id, date, timeSlot, totalCents: updated.totalCents, status: updated.status },
      },
      { status: 201 }
    );
  } catch (e) {
    console.error("[order create]", e);
    return NextResponse.json({ error: "下单失败，请稍后再试" }, { status: 500 });
  }
}

/** 我的点单：返回我参与过的共享订单（按创建时间倒序） */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { items: { some: { addedByUserId: session.id } } },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 50,
  });

  return NextResponse.json({ orders });
}
