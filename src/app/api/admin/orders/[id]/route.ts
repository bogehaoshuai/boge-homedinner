import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";
import { ORDER_STATUS_LABEL } from "@/lib/constants";

type Params = { params: Promise<{ id: string }> };

/** 更新订单状态 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  try {
    const { id } = await params;
    const body = await req.json();
    const status = String(body.status ?? "");

    if (!(status in ORDER_STATUS_LABEL)) {
      return NextResponse.json({ error: "无效的订单状态" }, { status: 400 });
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: status as never },
      include: { items: true },
    });
    return NextResponse.json({ order });
  } catch (e) {
    console.error("[admin order update]", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
