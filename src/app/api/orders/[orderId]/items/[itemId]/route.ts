import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendUpdateWithTimeout } from "@/lib/order-email";

type Params = { params: Promise<{ orderId: string; itemId: string }> };

/**
 * 修改 / 删除共享订单里的某道菜。
 * 规则：只有「待确认」（PENDING）状态可改删；任何登录用户都可就条目操作（互相可见、互相改删）。
 * PATCH  /api/orders/:orderId/items/:itemId   body: { quantity: n }
 * DELETE /api/orders/:orderId/items/:itemId
 */

export async function PATCH(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const { orderId, itemId } = await params;
    const body = await req.json();
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(body.quantity) || 1)));

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json(
        { error: "这个时段的订单已被主人确认，无法修改" },
        { status: 409 }
      );
    }
    if (!order.items.some((i) => i.id === itemId)) {
      return NextResponse.json({ error: "菜品不存在" }, { status: 404 });
    }

    await prisma.orderItem.update({ where: { id: itemId }, data: { quantity } });

    const updated = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!updated) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }
    const totalCents = updated.items.reduce((s, x) => s + x.priceCents * x.quantity, 0);
    const refreshed = await prisma.order.update({
      where: { id: orderId },
      data: { totalCents },
      include: { items: true },
    });

    const origin = new URL(req.url).origin;
    await sendUpdateWithTimeout(refreshed, "修改了点单", session.name, origin);

    return NextResponse.json({ ok: true, order: refreshed });
  } catch (e) {
    console.error("[order item update]", e);
    return NextResponse.json({ error: "修改失败，请稍后再试" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  try {
    const { orderId, itemId } = await params;

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) {
      return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    }
    if (order.status !== OrderStatus.PENDING) {
      return NextResponse.json(
        { error: "这个时段的订单已被主人确认，无法修改" },
        { status: 409 }
      );
    }
    if (!order.items.some((i) => i.id === itemId)) {
      return NextResponse.json({ error: "菜品不存在" }, { status: 404 });
    }

    await prisma.orderItem.delete({ where: { id: itemId } });

    // 删空了就把这个时段的共享订单整个删掉，恢复为空时段
    const remaining = await prisma.orderItem.findMany({ where: { orderId } });
    if (remaining.length === 0) {
      await prisma.order.delete({ where: { id: orderId } });
      return NextResponse.json({ ok: true, empty: true });
    }

    const totalCents = remaining.reduce((s, x) => s + x.priceCents * x.quantity, 0);
    const refreshed = await prisma.order.update({
      where: { id: orderId },
      data: { totalCents },
      include: { items: true },
    });

    const origin = new URL(req.url).origin;
    await sendUpdateWithTimeout(refreshed, "移除了菜品", session.name, origin);

    return NextResponse.json({ ok: true, order: refreshed });
  } catch (e) {
    console.error("[order item delete]", e);
    return NextResponse.json({ error: "删除失败，请稍后再试" }, { status: 500 });
  }
}
