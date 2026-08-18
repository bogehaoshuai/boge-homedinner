"use client";

import { useState } from "react";
import { Loader2, Minus, Plus, Trash2 } from "lucide-react";

export type SharedItem = {
  id: string;
  dishName: string;
  quantity: number;
  priceCents: number;
  options: unknown;
  addedBy?: string | null;
  addedByName?: string | null;
};

export type SharedOrderType = {
  id: string;
  status: string;
  totalCents: number;
  items: SharedItem[];
};

function optionsText(it: SharedItem): string {
  if (!Array.isArray(it.options)) return "";
  return it.options
    .map((o) => {
      const g = o as { group?: string; choice?: string };
      return `${g.group ?? ""}:${g.choice ?? ""}`;
    })
    .filter((s) => s !== ":")
    .join(" · ");
}

function yuan(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

/**
 * 共享订单的条目列表（含改数量 / 删除）。
 * 任何登录用户都可就任一条目操作（待确认状态下）；主人确认后锁定。
 */
export default function SharedOrderItems({
  order,
  editable,
  onChanged,
  onError,
}: {
  order: SharedOrderType | null;
  editable: boolean;
  onChanged: () => void;
  onError?: (msg: string) => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!order || order.items.length === 0) {
    return (
      <p className="rounded-xl bg-paper/60 px-4 py-3 text-sm text-muted">
        这个时段还没有人点单，来点第一单吧
      </p>
    );
  }

  async function mutate(method: "PATCH" | "DELETE", itemId: string, quantity?: number) {
    if (!order) return;
    setBusyId(itemId);
    try {
      const res = await fetch(`/api/orders/${order.id}/items/${itemId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "PATCH" ? JSON.stringify({ quantity }) : undefined,
      });
      const data = await res.json();
      if (!res.ok) {
        onError?.(data.error || "操作失败");
        return;
      }
      onChanged();
    } catch {
      onError?.("网络异常，请重试");
    } finally {
      setBusyId(null);
    }
  }

  const locked = !editable;

  return (
    <div className="rounded-xl border border-line bg-card p-4">
      {locked && (
        <p className="mb-3 rounded-lg bg-gold/15 px-3 py-2 text-xs text-gold">
          该时段订单已被主人确认，只能看不能改
        </p>
      )}
      <ul className="divide-y divide-line/60">
        {order.items.map((it) => {
          const opts = optionsText(it);
          const busy = busyId === it.id;
          return (
            <li key={it.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {(it.addedBy || it.addedByName) && (
                    <span className="mr-1 text-xs text-cinnabar">
                      {it.addedBy || it.addedByName}
                    </span>
                  )}
                  <span className="font-medium">{it.dishName}</span>
                  {opts && <span className="ml-1 text-xs text-muted">{opts}</span>}
                </div>
                <div className="text-xs text-muted">{yuan(it.priceCents)} / 份</div>
              </div>

              {locked ? (
                <span className="shrink-0 text-sm text-muted">×{it.quantity}</span>
              ) : (
                <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper/60 px-1 py-0.5">
                  <button
                    onClick={() =>
                      it.quantity <= 1
                        ? mutate("DELETE", it.id)
                        : mutate("PATCH", it.id, it.quantity - 1)
                    }
                    disabled={busy}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5 disabled:opacity-40"
                    aria-label="减少数量"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="min-w-[18px] text-center text-sm font-semibold">
                    {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : it.quantity}
                  </span>
                  <button
                    onClick={() => mutate("PATCH", it.id, it.quantity + 1)}
                    disabled={busy}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-cinnabar hover:bg-cinnabar-light disabled:opacity-40"
                    aria-label="增加数量"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => mutate("DELETE", it.id)}
                    disabled={busy}
                    className="flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-cinnabar-light hover:text-cinnabar disabled:opacity-40"
                    aria-label="删除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2">
        <span className="text-xs text-muted">共 {order.items.length} 道菜</span>
        <span className="text-sm">
          合计{" "}
          <span className="font-display font-bold text-cinnabar">
            {yuan(order.totalCents)}
          </span>
        </span>
      </div>
    </div>
  );
}
