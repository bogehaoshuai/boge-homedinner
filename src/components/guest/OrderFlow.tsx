"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Clock,
  Loader2,
  Minus,
  Plus,
  ShoppingBasket,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Button, Modal, Spinner, Textarea } from "@/components/ui";
import { formatCnDate, weekdayCn, type DateOption } from "@/lib/date";
import SharedOrderItems, { type SharedOrderType } from "@/components/guest/SharedOrderItems";

export type Dish = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  optionGroups: {
    id: string;
    name: string;
    isRequired: boolean;
    options: { id: string; label: string }[];
  }[];
  ingredients: { id: string; name: string; gramsPerServing: number }[];
};

type Slot = { time: string; label: string; available: boolean };

/** 点单行：同一道菜 + 同一组选项 视为一行 */
export type CartLine = {
  dishId: string;
  optionIds: string[];
  quantity: number;
};

function yuan(cents: number) {
  return `¥${(cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 })}`;
}

function lineKey(dishId: string, optionIds: string[]) {
  return `${dishId}::${[...optionIds].sort().join(",")}`;
}

function optionsTextFor(dish: Dish, optionIds: string[]) {
  const map = new Map<string, string>();
  for (const g of dish.optionGroups) {
    const o = g.options.find((x) => optionIds.includes(x.id));
    if (o) map.set(g.name, o.label);
  }
  return Array.from(map.entries())
    .map(([group, choice]) => `${group}:${choice}`)
    .join(" · ");
}

/** 点单草稿存到 sessionStorage：未登录去登录、跳转后回来不丢已选菜品 */
const DRAFT_KEY = "hd_order_draft";

type Draft = { date?: string; slot?: string; cart?: CartLine[]; notes?: string };

function readDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** 兼容旧草稿（cart 是 {dishId: 数量}）与新草稿（cart 是数组） */
function normalizeCart(raw: unknown): CartLine[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (l): l is CartLine =>
          !!l && typeof (l as CartLine).dishId === "string" && (l as CartLine).quantity > 0
      )
      .map((l) => ({ dishId: l.dishId, optionIds: l.optionIds ?? [], quantity: l.quantity }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, number>)
      .filter(([, q]) => q > 0)
      .map(([dishId, quantity]) => ({ dishId, optionIds: [], quantity }));
  }
  return [];
}

export default function OrderFlow({
  dishes,
  dates,
}: {
  dishes: Dish[];
  dates: DateOption[];
}) {
  const router = useRouter();

  // 初始值一律用服务端/默认值，避免 hydration 不匹配；草稿在挂载后统一恢复
  const [date, setDate] = useState(dates[0].value);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [dayBlocked, setDayBlocked] = useState(false);
  const [dayNote, setDayNote] = useState<string | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [notes, setNotes] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; totalCents: number } | null>(null);

  // 口味选择弹窗状态
  const [configuring, setConfiguring] = useState<{
    dish: Dish;
    selected: string[];
  } | null>(null);

  // 该时段共享订单（大家都点了什么，可互相改删）
  const [shared, setShared] = useState<SharedOrderType | null>(null);
  const [sharedState, setSharedState] = useState<"idle" | "loading" | "needsLogin" | "ready">(
    "idle"
  );
  const [sharedError, setSharedError] = useState<string | null>(null);

  const loadSlots = useCallback(async (d: string) => {
    setSlots(null);
    setDayBlocked(false);
    setDayNote(null);
    try {
      const res = await fetch(`/api/slots?date=${d}`);
      const data = await res.json();
      if (res.ok) {
        setSlots(data.slots);
        setDayBlocked(data.dayBlocked);
        setDayNote(data.note);
        // 保留仍在可选列表里的已选时段（如登录跳转回来），否则清空
        setSlot((prev) =>
          prev && data.slots.some((s: Slot) => s.time === prev && s.available) ? prev : null
        );
      } else {
        setSlots([]);
        setSlot(null);
      }
    } catch {
      setSlots([]);
      setSlot(null);
    }
  }, []);

  // 挂载后恢复点单草稿（一次性）
  useEffect(() => {
    const draft = readDraft();
    if (draft?.date && dates.some((x) => x.value === draft.date)) setDate(draft.date);
    if (typeof draft?.slot === "string") setSlot(draft.slot);
    if (draft?.cart !== undefined) setCart(normalizeCart(draft.cart));
    if (typeof draft?.notes === "string") setNotes(draft.notes);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadSlots(date);
  }, [date, loadSlots]);

  /** 拉取该时段共享订单（登录后可见） */
  const refreshShared = useCallback(async (d: string, s: string) => {
    setSharedError(null);
    try {
      const res = await fetch(
        `/api/orders/shared?date=${encodeURIComponent(d)}&timeSlot=${encodeURIComponent(s)}`
      );
      if (res.status === 401) {
        setSharedState("needsLogin");
        setShared(null);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setShared(
          data.order
            ? {
                id: data.order.id,
                status: data.order.status,
                totalCents: data.order.totalCents,
                items: data.order.items,
              }
            : null
        );
        setSharedState("ready");
      } else {
        setShared(null);
        setSharedState("ready");
      }
    } catch {
      setShared(null);
      setSharedState("ready");
    }
  }, []);

  // 选定时段后拉取共享订单，并每 10 秒轮询刷新（让朋友间互相看见）
  useEffect(() => {
    if (!slot || dayBlocked) {
      setShared(null);
      setSharedState("idle");
      return;
    }
    refreshShared(date, slot);
    const timer = setInterval(() => refreshShared(date, slot), 10000);
    return () => clearInterval(timer);
  }, [slot, dayBlocked, date, refreshShared]);

  // 实时保存草稿（hydrated 之后才写，避免覆盖未恢复的草稿）
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ date, slot, cart, notes }));
    } catch {
      // 忽略隐私模式等异常
    }
  }, [hydrated, date, slot, cart, notes]);

  const grouped = useMemo(() => {
    const map = new Map<string, Dish[]>();
    for (const d of dishes) {
      if (!map.has(d.category)) map.set(d.category, []);
      map.get(d.category)!.push(d);
    }
    return Array.from(map.entries());
  }, [dishes]);

  const dishMap = useMemo(() => {
    const m = new Map<string, Dish>();
    for (const d of dishes) m.set(d.id, d);
    return m;
  }, [dishes]);

  const cartCount = cart.reduce((s, l) => s + l.quantity, 0);
  const cartTotal = cart.reduce((s, l) => {
    const d = dishMap.get(l.dishId);
    return s + (d ? d.priceCents * l.quantity : 0);
  }, 0);

  function addToCart(dish: Dish, optionIds: string[], qty = 1) {
    setCart((c) => {
      const key = lineKey(dish.id, optionIds);
      const existing = c.find((l) => lineKey(l.dishId, l.optionIds) === key);
      if (existing) {
        return c.map((l) =>
          lineKey(l.dishId, l.optionIds) === key ? { ...l, quantity: l.quantity + qty } : l
        );
      }
      return [...c, { dishId: dish.id, optionIds, quantity: qty }];
    });
  }

  function removeFromCart(key: string) {
    setCart((c) =>
      c
        .map((l) => (lineKey(l.dishId, l.optionIds) === key ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  /** 点击「+」：有选项（必选或选填）的菜先弹口味选择，否则直接加入 */
  function onAddDish(dish: Dish) {
    if (dish.optionGroups.length > 0) {
      setConfiguring({ dish, selected: [] });
    } else {
      addToCart(dish, []);
    }
  }

  /** 确认弹窗里的选择并加入点单 */
  function confirmConfigured() {
    if (!configuring) return;
    const { dish, selected } = configuring;
    const missing = dish.optionGroups.some(
      (g) => g.isRequired && !g.options.some((o) => selected.includes(o.id))
    );
    if (missing) return; // 必选项没选完，不关闭
    addToCart(dish, selected);
    setConfiguring(null);
  }

  async function submitOrder() {
    if (!slot) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          timeSlot: slot,
          notes,
          items: cart.map((l) => ({ dishId: l.dishId, quantity: l.quantity, optionIds: l.optionIds })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push(`/login?next=${encodeURIComponent("/")}`);
          return;
        }
        setError(data.error || "下单失败，请稍后再试");
        return;
      }
      setSuccess(data.order);
      setCart([]);
      setCartOpen(false);
      setNotes("");
      try {
        window.sessionStorage.removeItem(DRAFT_KEY);
      } catch {
        // 忽略
      }
    } catch {
      setError("网络异常，请检查连接后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // ── 下单成功页 ────────────────────────────
  if (success) {
    return (
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-md rounded-2xl bg-card p-8 text-center shadow-menu">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-scallion/15 text-scallion">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="mt-4 font-display text-2xl font-bold">下单成功</h2>
          <p className="mt-2 text-muted">
            已收到你的订单，主人会收到通知并准备食材。
          </p>
          <div className="mt-4 rounded-lg bg-paper px-4 py-3 text-sm text-ink/80">
            {formatCnDate(date)}（{weekdayCn(date)}）· {slot} · 合计{" "}
            <span className="font-semibold text-cinnabar">{yuan(success.totalCents)}</span>
          </div>
          <div className="mt-4 text-xs text-muted">订单号 #{success.id.slice(-8).toUpperCase()}</div>
          <Button
            className="mt-6 w-full"
            onClick={() => {
              setSuccess(null);
              if (slot) refreshShared(date, slot);
            }}
          >
            再点一单
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      {/* ── 选日子 + 选时间 ─────────────────── */}
      <div className="rounded-2xl border border-line bg-card p-5 shadow-menu sm:p-6">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-cinnabar" />
          <h2 className="font-display text-lg font-bold">选个日子</h2>
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {dates.map((d) => {
            const active = d.value === date;
            return (
              <button
                key={d.value}
                onClick={() => setDate(d.value)}
                className={`flex min-w-[64px] shrink-0 flex-col items-center rounded-xl border px-3 py-2 text-sm transition-colors ${
                  active
                    ? "border-cinnabar bg-cinnabar text-white"
                    : "border-line bg-paper/60 hover:border-cinnabar/40"
                }`}
              >
                <span className={active ? "text-white/80" : "text-muted"}>
                  {d.isToday ? "今天" : d.weekday}
                </span>
                <span className="mt-0.5 font-semibold">{d.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <Clock className="h-5 w-5 text-cinnabar" />
          <h2 className="font-display text-lg font-bold">挑个时间</h2>
        </div>

        {dayBlocked ? (
          <div className="mt-3 rounded-xl bg-cinnabar-light px-4 py-3 text-sm text-cinnabar">
            {dayNote ? `这天不方便：${dayNote}` : "主人这天不方便，换个日子吧"}
          </div>
        ) : slots === null ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted">
            <Spinner /> 正在查询可约时间…
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {slots.map((s) => {
              const active = slot === s.time;
              const disabled = !s.available;
              return (
                <button
                  key={s.time}
                  disabled={disabled}
                  onClick={() => setSlot(s.time)}
                  className={`rounded-lg border px-4 py-2 text-sm transition-colors ${
                    disabled
                      ? "cursor-not-allowed border-line text-ink/25 line-through"
                      : active
                        ? "border-scallion bg-scallion text-white"
                        : "border-line bg-paper/60 hover:border-scallion/50"
                  }`}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 该时段已有点单（共享，可互相改删） ── */}
      {slot && !dayBlocked && (
        <div className="mt-5 rounded-2xl border border-line bg-card p-5 shadow-menu sm:p-6">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-cinnabar" />
            <h2 className="font-display text-lg font-bold">这个时段大家点了</h2>
            {shared && (
              <span className="text-xs text-muted">
                · {shared.items.length} 道菜，待确认时可互相修改
              </span>
            )}
          </div>
          <div className="mt-3">
            {sharedState === "needsLogin" ? (
              <p className="rounded-xl bg-paper/60 px-4 py-3 text-sm text-muted">
                登录后就能看到这个时段大家都点了什么
              </p>
            ) : sharedState === "loading" ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <Spinner /> 加载中…
              </p>
            ) : (
              <>
                <SharedOrderItems
                  order={shared}
                  editable={!!shared && shared.status === "PENDING"}
                  onChanged={() => refreshShared(date, slot)}
                  onError={setSharedError}
                />
                {sharedError && <p className="mt-2 text-sm text-cinnabar">{sharedError}</p>}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── 菜单 ────────────────────────────── */}
      <div className="mt-10">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-cinnabar" />
          <h2 className="font-display text-xl font-bold">今日菜单</h2>
        </div>

        {grouped.map(([category, items]) => (
          <div key={category} className="mt-7">
            <div className="mb-2 flex items-center gap-3">
              <h3 className="font-display text-base font-bold text-cinnabar">{category}</h3>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="divide-y divide-line/70 rounded-2xl border border-line bg-card px-4 shadow-menu sm:px-6">
              {items.map((d) => {
                const lineQty = cart.reduce(
                  (s, l) => (l.dishId === d.id ? s + l.quantity : s),
                  0
                );
                return (
                  <div key={d.id} className="flex items-center gap-3 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline">
                        <span className="font-medium">{d.name}</span>
                        <span className="leader" />
                        <span className="whitespace-nowrap font-display font-bold text-cinnabar">
                          {yuan(d.priceCents)}
                        </span>
                      </div>
                      {d.description && (
                        <p className="mt-0.5 text-[13px] text-muted">{d.description}</p>
                      )}
                      {d.optionGroups.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted">
                          可选：{d.optionGroups.map((g) => g.name).join(" · ")}
                        </p>
                      )}
                      {d.ingredients.length > 0 && (
                        <p className="mt-0.5 text-xs text-ink/50">
                          备料：
                          {d.ingredients.map((ing, i) => (
                            <span key={ing.id}>
                              {i > 0 && " · "}
                              {ing.name} {ing.gramsPerServing}g
                            </span>
                          ))}
                        </p>
                      )}
                    </div>

                    {lineQty === 0 ? (
                      <button
                        onClick={() => onAddDish(d)}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cinnabar text-cinnabar hover:bg-cinnabar hover:text-white"
                        aria-label={`把 ${d.name} 加入点单`}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : (
                      <div className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper/60 px-1 py-0.5">
                        <button
                          onClick={() => {
                            // 同菜多行时减少最后加入的那行；通常只有一行
                            const lines = cart.filter((l) => l.dishId === d.id);
                            removeFromCart(lineKey(lines[lines.length - 1].dishId, lines[lines.length - 1].optionIds));
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-ink/60 hover:bg-ink/5"
                          aria-label={`减少 ${d.name}`}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="min-w-[18px] text-center text-sm font-semibold">
                          {lineQty}
                        </span>
                        <button
                          onClick={() => onAddDish(d)}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-cinnabar hover:bg-cinnabar-light"
                          aria-label={`增加 ${d.name}`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── 底部下单栏 ──────────────────────── */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCartOpen(true)}
              className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-paper border border-line"
              aria-label="查看点菜单"
            >
              <ShoppingBasket className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-cinnabar px-1 text-xs font-bold text-white">
                  {cartCount}
                </span>
              )}
            </button>
            <div>
              <div className="text-xs text-muted">已选</div>
              <div className="font-display text-base font-bold">
                {yuan(cartTotal)}
                {cartTotal > 0 && <span className="ml-1 text-xs font-normal text-muted">{cartCount} 道</span>}
              </div>
            </div>
          </div>
          <Button
            size="lg"
            disabled={cartCount === 0 || !slot || submitting}
            onClick={() => setCartOpen(true)}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {!slot ? "请先选时间" : cartCount === 0 ? "先点几道菜" : "去下单"}
          </Button>
        </div>
      </div>
      <div className="h-20" />

      {/* ── 口味选择弹窗 ───────────────────── */}
      <Modal
        open={!!configuring}
        onClose={() => setConfiguring(null)}
        title={configuring?.dish.name ?? ""}
      >
        {configuring && (
          <div>
            <p className="mb-4 text-sm text-muted">{yuan(configuring.dish.priceCents)} / 份</p>
            {configuring.dish.optionGroups.map((g) => {
              const picked = configuring.selected.find((id) =>
                g.options.some((o) => o.id === id)
              );
              return (
                <div key={g.id} className="mb-4">
                  <div className="mb-2 flex items-baseline gap-2">
                    <span className="text-sm font-semibold">{g.name}</span>
                    {g.isRequired ? (
                      <span className="text-xs text-cinnabar">* 必选</span>
                    ) : (
                      <span className="text-xs text-muted">选填</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!g.isRequired && (
                      <button
                        onClick={() =>
                          setConfiguring((c) =>
                            c
                              ? {
                                  ...c,
                                  selected: c.selected.filter(
                                    (id) => !g.options.some((o) => o.id === id)
                                  ),
                                }
                              : c
                          )
                        }
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          !picked
                            ? "border-scallion bg-scallion text-white"
                            : "border-line bg-paper/60 text-ink/60 hover:border-scallion/50"
                        }`}
                      >
                        不选
                      </button>
                    )}
                    {g.options.map((o) => {
                      const active = configuring.selected.includes(o.id);
                      return (
                        <button
                          key={o.id}
                          onClick={() =>
                            setConfiguring((c) =>
                              c
                                ? {
                                    ...c,
                                    // 同组单选：先去掉本组所有已选
                                    selected: [
                                      ...c.selected.filter(
                                        (id) => !g.options.some((x) => x.id === id)
                                      ),
                                      o.id,
                                    ],
                                  }
                                : c
                            )
                          }
                          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? "border-cinnabar bg-cinnabar text-white"
                              : "border-line bg-paper/60 hover:border-cinnabar/40"
                          }`}
                        >
                          {o.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            <Button
              className="mt-2 w-full"
              size="lg"
              disabled={configuring.dish.optionGroups.some(
                (g) => g.isRequired && !g.options.some((o) => configuring.selected.includes(o.id))
              )}
              onClick={confirmConfigured}
            >
              加入点单
            </Button>
          </div>
        )}
      </Modal>

      {/* ── 点菜单（购物车）抽屉 ────────────── */}
      <Modal open={cartOpen} onClose={() => setCartOpen(false)} title="点菜单">
        {cart.length === 0 ? (
          <div className="py-8 text-center text-muted">还没有点菜，去菜单里挑几道吧</div>
        ) : (
          <div>
            <div className="mb-3 rounded-lg bg-paper px-3 py-2 text-sm text-ink/70">
              {formatCnDate(date)}（{weekdayCn(date)}）·{" "}
              {slot ? slot : "还没选时间"}
            </div>
            <ul className="divide-y divide-line/70">
              {cart.map((l) => {
                const d = dishMap.get(l.dishId);
                if (!d) return null;
                const key = lineKey(l.dishId, l.optionIds);
                const opts = optionsTextFor(d, l.optionIds);
                return (
                  <li key={key} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0">
                      <div className="truncate font-medium">{d.name}</div>
                      {opts && <div className="text-xs text-muted">{opts}</div>}
                      <div className="text-xs text-muted">{yuan(d.priceCents)} / 份</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => removeFromCart(key)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-ink/60 hover:bg-ink/5"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-5 text-center text-sm font-semibold">{l.quantity}</span>
                      <button
                        onClick={() => addToCart(d, l.optionIds)}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-line text-cinnabar hover:bg-cinnabar-light"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-muted">合计</span>
              <span className="font-display text-xl font-bold text-cinnabar">{yuan(cartTotal)}</span>
            </div>

            <div className="mt-3">
              <Textarea
                label="备注（口味、忌口等，选填）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="例如：少辣、多放香菜…"
                rows={2}
              />
            </div>

            {error && <p className="mt-2 text-sm text-cinnabar">{error}</p>}

            <Button className="mt-4 w-full" size="lg" disabled={!slot || submitting} onClick={submitOrder}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {slot ? `确认下单 · ${yuan(cartTotal)}` : "请先返回选择时间"}
            </Button>
            {!slot && (
              <p className="mt-2 text-center text-xs text-muted">
                先在页面顶部选好日期和时间，再回来确认
              </p>
            )}
          </div>
        )}
      </Modal>
    </section>
  );
}
