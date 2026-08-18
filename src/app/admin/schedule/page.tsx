"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarX2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button, Input, Modal, Spinner } from "@/components/ui";
import { TIME_SLOTS } from "@/lib/constants";
import { formatCnDate, weekdayCn } from "@/lib/date";

type Blocked = {
  id: string;
  date: string;
  timeFrom: string | null;
  timeTo: string | null;
  note: string | null;
};

function todayInputValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export default function AdminSchedulePage() {
  const [slots, setSlots] = useState<Blocked[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    date: todayInputValue(),
    wholeDay: true,
    timeFrom: "午饭",
    timeTo: "晚饭",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/slots");
      const data = await res.json();
      if (res.ok) setSlots(data.slots);
    } catch {
      setSlots([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          note: form.note,
          timeFrom: form.wholeDay ? null : form.timeFrom,
          timeTo: form.wholeDay ? null : form.timeTo,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        return;
      }
      setModalOpen(false);
      setForm({ date: todayInputValue(), wholeDay: true, timeFrom: "午饭", timeTo: "晚饭", note: "" });
      await load();
    } catch {
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/slots/${id}`, { method: "DELETE" });
    if (res.ok) await load();
  }

  if (slots === null) {
    return (
      <div className="flex items-center gap-2 text-muted">
        <Spinner /> 加载中…
      </div>
    );
  }

  const upcoming = slots.filter((s) => s.date >= todayInputValue());

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarX2 className="h-5 w-5 text-cinnabar" />
          <h1 className="font-display text-2xl font-bold">不可约时间</h1>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> 屏蔽时间段
        </Button>
      </div>
      <p className="mt-1 text-sm text-muted">屏蔽后，朋友在对应日期/时段将无法下单。</p>

      {upcoming.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line bg-card/60 px-6 py-14 text-center text-muted">
          暂时没有屏蔽任何时间
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {upcoming.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-menu sm:px-5">
              <div>
                <div className="font-medium">
                  {formatCnDate(s.date)}（{weekdayCn(s.date)}）
                  <span className="ml-2 text-cinnabar">
                    {s.timeFrom ? `${s.timeFrom} ~ ${s.timeTo ?? "—"}` : "全天"}
                  </span>
                </div>
                {s.note && <p className="mt-0.5 text-sm text-muted">{s.note}</p>}
              </div>
              <button
                onClick={() => remove(s.id)}
                className="shrink-0 rounded-lg p-2 text-ink/40 hover:bg-cinnabar-light hover:text-cinnabar"
                aria-label="删除"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="屏蔽时间段">
        <div className="space-y-4">
          <Input
            label="日期"
            type="date"
            value={form.date}
            min={todayInputValue()}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />

          <div className="flex items-center gap-2 rounded-lg border border-line bg-paper/60 px-3 py-2.5">
            <input
              id="wholeDay"
              type="checkbox"
              checked={form.wholeDay}
              onChange={(e) => setForm({ ...form, wholeDay: e.target.checked })}
              className="h-4 w-4 accent-cinnabar"
            />
            <label htmlFor="wholeDay" className="text-sm">
              全天不可约
            </label>
          </div>

          {!form.wholeDay && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/80">从</span>
                <select
                  value={form.timeFrom}
                  onChange={(e) => setForm({ ...form, timeFrom: e.target.value })}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px]"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-ink/80">到</span>
                <select
                  value={form.timeTo}
                  onChange={(e) => setForm({ ...form, timeTo: e.target.value })}
                  className="w-full rounded-lg border border-line bg-card px-3 py-2.5 text-[15px]"
                >
                  {TIME_SLOTS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <Input
            label="备注（朋友会看到，选填）"
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            placeholder="比如：回老家、出差"
            maxLength={60}
          />

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
