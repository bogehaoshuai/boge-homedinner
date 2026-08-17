import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import OrdersList from "@/components/guest/OrdersList";

export const metadata: Metadata = { title: "我的订单" };

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const session = await getSession();
  if (!session) redirect("/login?next=/orders");

  const orders = await prisma.order.findMany({
    where: { userId: session.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 50,
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-cinnabar" />
        <h1 className="font-display text-2xl font-bold">我的订单</h1>
      </div>
      <OrdersList
        initialOrders={orders.map((o) => ({
          ...o,
          createdAt: o.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
