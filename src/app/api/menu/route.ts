import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/** 公开菜单：只返回当前上架的菜品（含口味选项组与原料克重） */
export async function GET() {
  const dishes = await prisma.dish.findMany({
    where: { available: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
    include: {
      optionGroups: {
        orderBy: { sortOrder: "asc" },
        include: { options: { orderBy: { sortOrder: "asc" } } },
      },
      ingredients: { orderBy: { sortOrder: "asc" } },
    },
  });
  return NextResponse.json({ dishes });
}
