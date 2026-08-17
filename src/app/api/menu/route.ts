import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 公开菜单：只返回当前上架的菜品 */
export async function GET() {
  const dishes = await prisma.dish.findMany({
    where: { available: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  return NextResponse.json({ dishes });
}
