"use client";

import { useCallback, useState } from "react";
import { Badge } from "@/components/ui";
import { ORDER_STATUS_LABEL, ORDER_STATUS_COLOR } from "@/lib/constants";
import { formatCnDate, weekdayCn } from "@/lib/date";
import SharedOrderItems, {
  type SharedItem,
  type SharedOrderType,
} from "@/components/guest/SharedOrderItems";

type Order = SharedOrderType & {
  date: string;
  timeSlot: string;
  notes: string | null;
  createdAt: string;
  items: SharedItem[];
};

/**
 * 我的点单：显示我参与过的共享订单。
 * 同一（日期+午/晚饭）是一个共享订单；待确认状态下可对任一条目改数量/删除。
 */
export default function OrdersList({ initialOrders }: { initialOrders: Order[] }) {
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (res.ok) setOrders(data.orders);
    } catch {
      // 静默，保留当前列表
    }
  }, []);

  if (orders.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center">
        <p className="text-muted">还没有下过单，去菜单看看有什么想吃的吧</p>
      </div>
    );
  }

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
                <span className="text-xs text-muted">· 你参与的点单</span>
              </div>
              <Badge className={ORDER_STATUS_COLOR[o.status]}>
                {ORDER_STATUS_LABEL[o.status]}
              </Badge>
            </div>

            <div className="mt-3">
              <SharedOrderItems
                order={o}
                editable={o.status === "PENDING"}
                onChanged={load}
                onError={setError}
              />
            </div>

            {o.notes && (
              <p className="mt-3 whitespace-pre-line rounded-lg bg-paper px-3 py-2 text-xs text-muted">
                备注：{o.notes}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
