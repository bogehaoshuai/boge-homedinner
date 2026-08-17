"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ClipboardList, X } from "lucide-react";
import { Badge, Button, Spinner } from "@/components/ui";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/constants";
import { formatCnDate, weekdayCn } from "@/lib/date";

type OrderItem = {
  id: string;
  dishName: string;
  quantity: number;
  priceCents: number;
};

type Order = {
  id: string;
  guestName: string;
  date: string;
  timeSlot: string;
  notes: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
  items: OrderItem[];
};

const STATUS_ORDER = ["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (date) params.set("date", date);
      if (status) params.set("status", status);
      const res = await fetch(`/api/admin/orders?${params.toString()}`);
      const data = await res.json();
      if (res.ok) setOrders(data.orders);
      else setError(data.error || "加载失败");
    } catch {
      setError("加载失败");
    }
  }, [date, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function updateStatus(id: string, next: string) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) await load();
  }

  const grouped = useMemo(() => {
    if (!orders) return [];
    const map = new Map<string, Order[]>();
    for (const o of orders) {
      if (!map.has(o.date)) map.set(o.date, []);
      map.get(o.date)!.push(o);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [orders]);

  if (orders === null) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> 加载中…
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-cinnabar" />
        <h1 className="font-display text-2xl font-bold">订单管理</h1>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink/70">按日期筛选</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-cinnabar/50 focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-ink/70">按状态筛选</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-lg border border-line bg-card px-3 py-2 text-sm focus:border-cinnabar/50 focus:outline-none"
          >
            <option value="">全部状态</option>
            {STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {(date || status) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDate("");
              setStatus("");
            }}
          >
            清除筛选
          </Button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-cinnabar">{error}</p>}

      {orders.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center text-muted">
          没有符合条件的订单
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {grouped.map(([d, list]) => (
            <div key={d}>
              <div className="mb-3 flex items-center gap-3">
                <h2 className="font-display text-lg font-bold">
                  {formatCnDate(d)}
                  <span className="ml-2 text-sm font-normal text-muted">{weekdayCn(d)}</span>
                </h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-muted">{list.length} 单</span>
              </div>

              <div className="space-y-3">
                {list.map((o) => (
                  <div key={o.id} className="rounded-2xl border border-line bg-card p-4 shadow-menu sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{o.guestName}</span>
                        <span className="text-sm text-muted">· {o.timeSlot}</span>
                        <Badge className={ORDER_STATUS_COLOR[o.status]}>
                          {ORDER_STATUS_LABEL[o.status]}
                        </Badge>
                      </div>
                      <span className="font-display font-bold text-cinnabar">
                        ¥{(o.totalCents / 100).toFixed(0)}
                      </span>
                    </div>

                    <div className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1 text-sm text-ink/80 sm:grid-cols-2">
                      {o.items.map((it) => (
                        <div key={it.id} className="flex justify-between">
                          <span>{it.dishName}</span>
                          <span className="text-muted">×{it.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {o.notes && (
                      <p className="mt-2 rounded-lg bg-paper px-3 py-2 text-xs text-muted">
                        备注：{o.notes}
                      </p>
                    )}

                    <div className="mt-3 flex items-center justify-between border-t border-line/70 pt-3">
                      <span className="text-xs text-muted">#{o.id.slice(-8).toUpperCase()}</span>
                      <div className="flex gap-2">
                        {o.status === "PENDING" && (
                          <Button size="sm" onClick={() => updateStatus(o.id, "CONFIRMED")}>
                            <Check className="h-4 w-4" /> 确认接单
                          </Button>
                        )}
                        {o.status === "CONFIRMED" && (
                          <Button size="sm" variant="secondary" onClick={() => updateStatus(o.id, "COMPLETED")}>
                            <Check className="h-4 w-4" /> 已完成
                          </Button>
                        )}
                        {!["CANCELLED", "COMPLETED"].includes(o.status) && (
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => updateStatus(o.id, "CANCELLED")}
                          >
                            <X className="h-4 w-4" /> 取消
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
