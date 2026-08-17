import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";

type Params = { params: Promise<{ id: string }> };

/** 更新菜品 */
export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  try {
    const { id } = await params;
    const body = await req.json();

    const data: Prisma.DishUpdateInput = {};
    if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
    if (typeof body.category === "string" && body.category.trim())
      data.category = body.category.trim();
    if (typeof body.description === "string") data.description = body.description.trim() || null;
    if (body.priceYuan !== undefined) {
      const priceCents = Math.round(Number(body.priceYuan) * 100);
      if (!Number.isFinite(priceCents) || priceCents < 0) {
        return NextResponse.json({ error: "价格不正确" }, { status: 400 });
      }
      data.priceCents = priceCents;
    }
    if (typeof body.available === "boolean") data.available = body.available;

    const dish = await prisma.dish.update({ where: { id }, data });
    return NextResponse.json({ dish });
  } catch (e) {
    console.error("[admin dish update]", e);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}

/** 删除菜品 */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  try {
    const { id } = await params;
    await prisma.dish.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin dish delete]", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
