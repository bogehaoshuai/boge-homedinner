import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHost, isResponse } from "@/lib/admin-guard";
import { parseOptionGroups, parseIngredients } from "@/lib/dish-input";

/** 菜品列表（含下架、口味选项组、备料清单，供管理） */
export async function GET() {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  const dishes = await prisma.dish.findMany({
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

/** 新建菜品（可同时写入口味选项组与备料清单） */
export async function POST(req: Request) {
  const guard = await requireHost();
  if (isResponse(guard)) return guard;

  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const category = String(body.category ?? "热菜").trim();
    const description = String(body.description ?? "").trim() || null;
    // 兼容两种传参：priceYuan（元）或 priceCents（分）
    const priceYuan =
      body.priceYuan !== undefined
        ? Number(body.priceYuan)
        : body.priceCents !== undefined
          ? Number(body.priceCents) / 100
          : Number.NaN;
    const priceCents = Math.round(priceYuan * 100);

    if (!name || name.length > 40) {
      return NextResponse.json({ error: "菜名不能为空且不超过 40 字" }, { status: 400 });
    }
    if (!Number.isFinite(priceCents) || priceCents < 0) {
      return NextResponse.json({ error: "请输入正确的价格" }, { status: 400 });
    }

    const optionGroups = parseOptionGroups(body.optionGroups);
    const ingredients = parseIngredients(body.ingredients);

    const dish = await prisma.dish.create({
      data: {
        name,
        category,
        description,
        priceCents,
        available: body.available !== false,
        sortOrder: Number(body.sortOrder) || 0,
        optionGroups: {
          create: optionGroups.map((g, gi) => ({
            name: g.name,
            isRequired: g.isRequired,
            sortOrder: gi,
            options: { create: g.options.map((o, oi) => ({ label: o.label, sortOrder: oi })) },
          })),
        },
        ingredients: {
          create: ingredients.map((ing, ii) => ({
            name: ing.name,
            gramsPerServing: ing.grams,
            sortOrder: ii,
          })),
        },
      },
      include: {
        optionGroups: { include: { options: true } },
        ingredients: true,
      },
    });
    return NextResponse.json({ dish }, { status: 201 });
  } catch (e) {
    console.error("[admin dish create]", e);
    return NextResponse.json({ error: "创建失败" }, { status: 500 });
  }
}
