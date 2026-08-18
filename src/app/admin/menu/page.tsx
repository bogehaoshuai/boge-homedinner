"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, UtensilsCrossed, X } from "lucide-react";
import { Badge, Button, Input, Modal, Spinner, Textarea } from "@/components/ui";
import { DISH_CATEGORIES } from "@/lib/constants";

type Option = { id: string; label: string; sortOrder: number };
type OptionGroup = {
  id: string;
  name: string;
  isRequired: boolean;
  sortOrder: number;
  options: Option[];
};
type Ingredient = { id: string; name: string; gramsPerServing: number; sortOrder: number };

type Dish = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  category: string;
  available: boolean;
  sortOrder: number;
  optionGroups: OptionGroup[];
  ingredients: Ingredient[];
};

// 编辑器里用本地 key 标识行（新增的行还没有服务端 id）
let k = 0;
function newKey() {
  k += 1;
  return `k${Date.now()}-${k}`;
}

type OptRow = { key: string; label: string };
type GroupRow = { key: string; name: string; isRequired: boolean; options: OptRow[] };
type IngRow = { key: string; name: string; grams: string };

type FormState = {
  id?: string;
  name: string;
  category: string;
  priceYuan: string;
  description: string;
  available: boolean;
  groups: GroupRow[];
  ingredients: IngRow[];
};

function emptyGroup(): GroupRow {
  return { key: newKey(), name: "", isRequired: true, options: [{ key: newKey(), label: "" }] };
}

const emptyForm: FormState = {
  name: "",
  category: "热菜",
  priceYuan: "",
  description: "",
  available: true,
  groups: [],
  ingredients: [],
};

function yuan(cents: number) {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

export default function AdminMenuPage() {
  const [dishes, setDishes] = useState<Dish[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dishes");
      const data = await res.json();
      if (res.ok) setDishes(data.dishes);
      else setError(data.error || "加载失败");
    } catch {
      setError("加载失败");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setForm({
      ...emptyForm,
      groups: [],
      ingredients: [],
    });
    setModalOpen(true);
  }

  function openEdit(d: Dish) {
    setForm({
      id: d.id,
      name: d.name,
      category: d.category,
      priceYuan: yuan(d.priceCents),
      description: d.description ?? "",
      available: d.available,
      groups: d.optionGroups.map((g) => ({
        key: newKey(),
        name: g.name,
        isRequired: g.isRequired,
        options: g.options.map((o) => ({ key: newKey(), label: o.label })),
      })),
      ingredients: d.ingredients.map((ing) => ({
        key: newKey(),
        name: ing.name,
        grams: String(ing.gramsPerServing),
      })),
    });
    setModalOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("请填写菜名");
      return;
    }
    const price = Number(form.priceYuan);
    if (!Number.isFinite(price) || price < 0) {
      setError("价格不正确");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const isEdit = !!form.id;
      const res = await fetch(isEdit ? `/api/admin/dishes/${form.id}` : "/api/admin/dishes", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          priceYuan: price,
          description: form.description.trim(),
          available: form.available,
          optionGroups: form.groups
            .filter((g) => g.name.trim() && g.options.some((o) => o.label.trim()))
            .map((g) => ({
              name: g.name.trim(),
              isRequired: g.isRequired,
              options: g.options
                .map((o) => o.label.trim())
                .filter((label) => label)
                .map((label) => ({ label })),
            })),
          ingredients: form.ingredients
            .map((ing) => ({
              name: ing.name.trim(),
              grams: Math.round(Number(ing.grams)),
            }))
            .filter((ing) => ing.name && Number.isFinite(ing.grams) && ing.grams > 0),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      setModalOpen(false);
      await load();
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function toggleAvailable(d: Dish) {
    const res = await fetch(`/api/admin/dishes/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ available: !d.available }),
    });
    if (res.ok) await load();
  }

  async function remove(d: Dish) {
    if (!window.confirm(`确定删除「${d.name}」吗？此操作不可恢复。`)) return;
    const res = await fetch(`/api/admin/dishes/${d.id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (dishes === null) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> 加载中…
      </div>
    );
  }

  const groups = new Map<string, Dish[]>();
  for (const d of dishes) {
    if (!groups.has(d.category)) groups.set(d.category, []);
    groups.get(d.category)!.push(d);
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-5 w-5 text-cinnabar" />
          <h1 className="font-display text-2xl font-bold">菜品管理</h1>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> 加道菜
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-cinnabar">{error}</p>}

      {dishes.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center text-muted">
          菜单还是空的，点击右上角「加道菜」开始
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {Array.from(groups.entries()).map(([category, items]) => (
            <div key={category}>
              <div className="mb-2 flex items-center gap-3">
                <h2 className="font-display text-base font-bold text-cinnabar">{category}</h2>
                <span className="h-px flex-1 bg-line" />
                <span className="text-xs text-muted">{items.length} 道</span>
              </div>
              <div className="divide-y divide-line/70 rounded-2xl border border-line bg-card shadow-menu">
                {items.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${d.available ? "" : "text-ink/40 line-through"}`}>
                          {d.name}
                        </span>
                        {!d.available && <Badge className="bg-ink/10 text-ink/60">已下架</Badge>}
                      </div>
                      {d.description && (
                        <p className="mt-0.5 truncate text-[13px] text-muted">{d.description}</p>
                      )}
                      {(d.optionGroups.length > 0 || d.ingredients.length > 0) && (
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {d.optionGroups.map((g) => (
                            <span
                              key={g.id}
                              className="rounded-md bg-cinnabar-light/70 px-1.5 py-0.5 text-[11px] text-cinnabar"
                            >
                              {g.name}:{g.options.map((o) => o.label).join("/")}
                            </span>
                          ))}
                          {d.ingredients.map((ing) => (
                            <span
                              key={ing.id}
                              className="rounded-md bg-scallion/10 px-1.5 py-0.5 text-[11px] text-scallion"
                            >
                              {ing.name} {ing.gramsPerServing}g
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="whitespace-nowrap font-display font-bold text-cinnabar">
                      ¥{yuan(d.priceCents)}
                    </div>
                    <button
                      onClick={() => toggleAvailable(d)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                        d.available ? "bg-scallion" : "bg-ink/20"
                      }`}
                      aria-label={d.available ? "下架" : "上架"}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                          d.available ? "left-[22px]" : "left-0.5"
                        }`}
                      />
                    </button>
                    <button
                      onClick={() => openEdit(d)}
                      className="shrink-0 rounded-lg p-2 text-ink/50 hover:bg-ink/5 hover:text-ink"
                      aria-label="编辑"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(d)}
                      className="shrink-0 rounded-lg p-2 text-ink/40 hover:bg-cinnabar-light hover:text-cinnabar"
                      aria-label="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={form.id ? "编辑菜品" : "加道新菜"}
      >
        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <Input
            label="菜名"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="比如：红烧肉"
            maxLength={40}
          />
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-ink/80">分类</span>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px] focus:border-cinnabar/50 focus:outline-none"
              >
                {DISH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="价格（元）"
              type="number"
              min="0"
              step="0.5"
              value={form.priceYuan}
              onChange={(e) => setForm({ ...form, priceYuan: e.target.value })}
              placeholder="0"
            />
          </div>
          <Textarea
            label="描述（选填）"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="比如：慢炖五花，入口即化"
            rows={2}
            maxLength={100}
          />

          {/* ── 口味选项组 ─────────────────────── */}
          <div className="rounded-xl border border-line bg-paper/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">
                口味选项 <span className="font-normal text-muted">（选填）</span>
              </span>
              <button
                type="button"
                onClick={() => setForm({ ...form, groups: [...form.groups, emptyGroup()] })}
                className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink/70 hover:border-cinnabar/40 hover:text-cinnabar"
              >
                <Plus className="h-3.5 w-3.5" /> 加一组
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">
              例：「辣度」→ 微辣 / 中辣 / 重辣。客人点这道菜时必须选必选组里的一个。
            </p>
            {form.groups.length === 0 && (
              <p className="py-1 text-xs text-ink/40">没有选项组，客人直接按份点。</p>
            )}
            <div className="space-y-3">
              {form.groups.map((g, gi) => (
                <div key={g.key} className="rounded-lg border border-line bg-card p-2.5">
                  <div className="flex items-center gap-2">
                    <input
                      value={g.name}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          groups: form.groups.map((x) =>
                            x.key === g.key ? { ...x, name: e.target.value } : x
                          ),
                        })
                      }
                      placeholder="组名，如：辣度"
                      maxLength={10}
                      className="w-28 rounded-md border border-line bg-card px-2 py-1.5 text-sm focus:border-cinnabar/50 focus:outline-none"
                    />
                    <label className="flex items-center gap-1.5 text-xs text-ink/70">
                      <input
                        type="checkbox"
                        checked={g.isRequired}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            groups: form.groups.map((x) =>
                              x.key === g.key ? { ...x, isRequired: e.target.checked } : x
                            ),
                          })
                        }
                        className="h-3.5 w-3.5 accent-cinnabar"
                      />
                      必选
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setForm({ ...form, groups: form.groups.filter((x) => x.key !== g.key) })
                      }
                      className="ml-auto rounded p-1 text-ink/40 hover:text-cinnabar"
                      aria-label="删除这组"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {g.options.map((o, oi) => (
                      <div key={o.key} className="flex items-center gap-1">
                        <input
                          value={o.label}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              groups: form.groups.map((x) =>
                                x.key === g.key
                                  ? {
                                      ...x,
                                      options: x.options.map((y) =>
                                        y.key === o.key ? { ...y, label: e.target.value } : y
                                      ),
                                    }
                                  : x
                              ),
                            })
                          }
                          placeholder={oi === 0 ? "如：微辣" : `选项 ${oi + 1}`}
                          maxLength={10}
                          className="w-20 rounded-md border border-line bg-card px-2 py-1.5 text-sm focus:border-cinnabar/50 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              groups: form.groups.map((x) =>
                                x.key === g.key
                                  ? { ...x, options: x.options.filter((y) => y.key !== o.key) }
                                  : x
                              ),
                            })
                          }
                          className="rounded p-0.5 text-ink/30 hover:text-cinnabar"
                          aria-label="删除选项"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          groups: form.groups.map((x) =>
                            x.key === g.key
                              ? { ...x, options: [...x.options, { key: newKey(), label: "" }] }
                              : x
                          ),
                        })
                      }
                      className="rounded-md border border-dashed border-line px-2 py-1 text-xs text-ink/50 hover:border-cinnabar/40 hover:text-cinnabar"
                    >
                      + 选项
                    </button>
                  </div>
                  {gi < form.groups.length - 1 && <div className="mt-2 h-px bg-line/60" />}
                </div>
              ))}
            </div>
          </div>

          {/* ── 备料清单 ─────────────────────── */}
          <div className="rounded-xl border border-line bg-paper/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">
                备料（每份克重） <span className="font-normal text-muted">（选填）</span>
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm({
                    ...form,
                    ingredients: [...form.ingredients, { key: newKey(), name: "", grams: "" }],
                  })
                }
                className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-xs text-ink/70 hover:border-cinnabar/40 hover:text-cinnabar"
              >
                <Plus className="h-3.5 w-3.5" /> 加原料
              </button>
            </div>
            <p className="mb-2 text-xs text-muted">
              例：牛腩 250g。下单后会在通知邮件里自动按「每份克重 × 份数」汇总采购量。
            </p>
            {form.ingredients.length === 0 && (
              <p className="py-1 text-xs text-ink/40">没有备料，邮件里不展示备料清单。</p>
            )}
            <div className="space-y-2">
              {form.ingredients.map((ing, ii) => (
                <div key={ing.key} className="flex items-center gap-2">
                  <input
                    value={ing.name}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        ingredients: form.ingredients.map((x) =>
                          x.key === ing.key ? { ...x, name: e.target.value } : x
                        ),
                      })
                    }
                    placeholder={ii === 0 ? "原料名，如：牛腩" : `原料 ${ii + 1}`}
                    maxLength={20}
                    className="flex-1 rounded-md border border-line bg-card px-2 py-1.5 text-sm focus:border-cinnabar/50 focus:outline-none"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={ing.grams}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          ingredients: form.ingredients.map((x) =>
                            x.key === ing.key ? { ...x, grams: e.target.value } : x
                          ),
                        })
                      }
                      placeholder="克"
                      className="w-20 rounded-md border border-line bg-card px-2 py-1.5 text-sm focus:border-cinnabar/50 focus:outline-none"
                    />
                    <span className="text-xs text-muted">g</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        ingredients: form.ingredients.filter((x) => x.key !== ing.key),
                      })
                    }
                    className="rounded p-1 text-ink/40 hover:text-cinnabar"
                    aria-label="删除原料"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.available}
              onChange={(e) => setForm({ ...form, available: e.target.checked })}
              className="h-4 w-4 accent-cinnabar"
            />
            上架（朋友可以在菜单里看到）
          </label>

          {error && <p className="text-sm text-cinnabar">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button className="flex-1" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              保存
            </Button>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
