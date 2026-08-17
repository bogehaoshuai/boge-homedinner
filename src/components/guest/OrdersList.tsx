"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Badge, Button } from "@/components/ui";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/constants";
import { formatCnDate, weekdayCn } from "@/lib/date";

type OrderItem = {
  id: string;
  dishName: string;
  quantity: number;
  priceCents: number;
};

export type Order = {
  id: string;
  date: string;
  timeSlot: string;
  notes: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};

export default function OrdersList({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancel(id: string) {
    if (!window.confirm("确定取消这单吗？主人会收到取消通知。")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "取消失败，请稍后再试");
        return;
      }
      setOrders((prev) =>
        prev.map((o) => (o.id === id ? { ...o, status: "CANCELLED" } : o))
      );
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setBusyId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center">
        <p className="text-muted">还没有下过单，去菜单看看有什么想吃的吧</p>
      </div>
    );
  }

  const cancellable = (status: string) => status === "PENDING" || status === "CONFIRMED";

  return (
    <div>
      {error && <p className="mt-4 text-sm text-cinnabar">{error}</p>}
      <ul className="mt-6 space-y-4">
        {orders.map((o) => (
          <li key={o.id} className="rounded-2xl border border-line bg-card p-5 shadow-menu">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-semibold">
                  {formatCnDate(o.date)}（{weekdayCn(o.date)}）
                </span>
                <span className="text-muted">· {o.timeSlot}</span>
              </div>
              <Badge className={ORDER_STATUS_COLOR[o.status]}>
                {ORDER_STATUS_LABEL[o.status]}
              </Badge>
            </div>

            <ul className="mt-3 space-y-1 text-sm text-ink/80">
              {o.items.map((it) => (
                <li key={it.id} className="flex justify-between">
                  <span>{it.dishName}</span>
                  <span className="text-muted">
                    x{it.quantity} · ¥{((it.priceCents * it.quantity) / 100).toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>

            {o.notes && (
              <p className="mt-3 rounded-lg bg-paper px-3 py-2 text-xs text-muted">
                备注：{o.notes}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-3">
              <span className="text-xs text-muted">订单号 #{o.id.slice(-8).toUpperCase()}</span>
              <div className="flex items-center gap-3">
                <span className="text-sm">
                  合计{" "}
                  <span className="font-display font-bold text-cinnabar">
                    ¥{(o.totalCents / 100).toFixed(0)}
                  </span>
                </span>
                {cancellable(o.status) && (
                  <Button size="sm" variant="danger" onClick={() => cancel(o.id)} disabled={busyId === o.id}>
                    {busyId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                    取消订单
                  </Button>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
