import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";

type Params = { params: Promise<{ id: string }> };

/** 删除不可约时段 */
export async function DELETE(_req: Request, { params }: Params) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  try {
    const { id } = await params;
    await prisma.blockedSlot.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[admin slot delete]", e);
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
