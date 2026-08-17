import { NextResponse } from "next/server";
import { OrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { sendOrderCancelledEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

/**
 * 朋友自助取消自己的订单
 * PATCH /api/orders/:id   body: { action: "cancel" }
 * 仅允许订单本人操作，且订单处于 PENDING / CONFIRMED 状态。
 */
export async function PATCH(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录", code: "UNAUTHENTICATED" }, { status: 401 });
  }

  const { id } = await params;

  // 条件更新：同时校验「订单存在 + 属于本人 + 状态可取消」，避免并发下覆盖已完成的订单
  const result = await prisma.order.updateMany({
    where: {
      id,
      userId: session.id,
      status: { in: [OrderStatus.PENDING, OrderStatus.CONFIRMED] },
    },
    data: { status: OrderStatus.CANCELLED },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "该订单当前状态不可取消" }, { status: 400 });
  }

  const updated = await prisma.order.findUnique({
    where: { id },
    include: { items: true },
  });

  // 通知主人（尽力而为，不阻塞取消）
  if (updated) {
    void sendOrderCancelledEmail({
      orderId: updated.id,
      guestName: updated.guestName,
      date: updated.date,
      timeSlot: updated.timeSlot,
    });
  }

  return NextResponse.json({ order: updated });
}
