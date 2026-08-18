/**
 * 解析管理端传来的「口味选项组」与「备料清单」，
 * 清洗非法项（空组名 / 无选项的组 / 无效克重会被跳过）。
 */

export type OptionInput = { label: string };
export type OptionGroupInput = { name: string; isRequired: boolean; options: OptionInput[] };
export type IngredientInput = { name: string; grams: number };

export function parseOptionGroups(raw: unknown): OptionGroupInput[] {
  if (!Array.isArray(raw)) return [];
  const groups: OptionGroupInput[] = [];
  for (const g of raw) {
    if (!g || typeof g !== "object") continue;
    const name = String((g as Record<string, unknown>).name ?? "").trim();
    if (!name) continue;
    const rawOptions = (g as Record<string, unknown>).options;
    const options = Array.isArray(rawOptions)
      ? rawOptions
          .map((o) => String((o as Record<string, unknown>)?.label ?? "").trim())
          .filter((label) => label)
          .map((label) => ({ label }))
      : [];
    if (options.length === 0) continue;
    groups.push({
      name,
      isRequired: (g as Record<string, unknown>).isRequired !== false,
      options,
    });
  }
  return groups;
}

export function parseIngredients(raw: unknown): IngredientInput[] {
  if (!Array.isArray(raw)) return [];
  const list: IngredientInput[] = [];
  for (const ing of raw) {
    if (!ing || typeof ing !== "object") continue;
    const name = String((ing as Record<string, unknown>).name ?? "").trim();
    const grams = Math.round(
      Number((ing as Record<string, unknown>).grams ?? (ing as Record<string, unknown>).gramsPerServing)
    );
    if (!name || !Number.isFinite(grams) || grams <= 0) continue;
    list.push({ name, grams });
  }
  return list;
}
