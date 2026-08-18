import { Resend } from "resend";
import { formatCnDate, weekdayCn } from "@/lib/date";

/** 转义 HTML 特殊字符，防止用户输入（备注/昵称等）注入邮件模板 */
function escapeHtml(input: string): string {
  return String(input).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c];
  });
}

type OrderItemInfo = {
  dishName: string;
  quantity: number;
  priceCents: number;
  options: { group: string; choice: string }[];
  ingredients: { name: string; gramsPerServing: number }[];
  addedBy?: string | null; // 是谁加的（共享订单）
};

/** 邮件发送入参：整个共享订单的当前状态 */
type OrderUpdateInput = {
  orderId: string;
  date: string;
  timeSlot: string;
  notes?: string | null;
  totalCents: number;
  items: OrderItemInfo[];
  /** 这次操作说明，例如「提交了点单」「修改了点单」「移除了菜品」 */
  actionPhrase: string;
  actorName: string;
};

/**
 * 站点根地址（邮件里「去管理后台」等链接用）。
 * 优先用调用方从请求推导的 origin（最准确，兼容自定义域名/预览部署），
 * 否则依次回退到环境变量。
 */
function resolveSiteUrl(origin?: string): string {
  if (origin) return origin.replace(/\/$/, "");
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  );
}

/** 把每道菜的选项快照渲染成内联文本，如「重辣」或「辣度:重辣」 */
function optionsText(options: { group: string; choice: string }[]): string {
  if (!options || options.length === 0) return "";
  return options.map((o) => `${o.group}:${o.choice}`).join(" · ");
}

/**
 * 发送「共享订单」变更通知邮件（加菜 / 改数量 / 删菜都会触发）。
 * 展示该时段当前全部菜品，并按「每份克重 × 份数」汇总备料清单。
 * 失败静默，不阻塞下单。
 */
export async function sendOrderUpdateEmail(input: OrderUpdateInput, origin?: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.RESEND_TO_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
  const baseUrl = resolveSiteUrl(origin);

  // 未配置邮件服务时跳过
  if (!apiKey || !to) return;

  const rows = input.items
    .map((it) => {
      const amount = ((it.priceCents * it.quantity) / 100).toFixed(0);
      const opts = optionsText(it.options);
      const optsHtml = opts
        ? `<div style="color:#8A7A6C;font-size:12px;">${escapeHtml(opts)}</div>`
        : "";
      const who = it.addedBy
        ? `<div style="color:#B3402A;font-size:11px;">${escapeHtml(it.addedBy)}</div>`
        : "";
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">
          ${who}
          <div>${escapeHtml(it.dishName)}</div>
          ${optsHtml}
        </td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">x${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">¥${amount}</td>
      </tr>`;
    })
    .join("");

  // 备料清单：同名配料合并克重 = 每份克重 × 份数
  const prepMap = new Map<string, number>();
  for (const it of input.items) {
    for (const ing of it.ingredients) {
      prepMap.set(ing.name, (prepMap.get(ing.name) ?? 0) + ing.gramsPerServing * it.quantity);
    }
  }
  const prepRows =
    prepMap.size > 0
      ? Array.from(prepMap.entries())
          .map(
            ([name, grams]) =>
              `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0e9df;">${escapeHtml(
                name
              )}</td><td style="padding:6px 12px;border-bottom:1px solid #f0e9df;text-align:right;font-weight:600;">${grams}g</td></tr>`
          )
          .join("")
      : "";

  const notesHtml = input.notes
    ? `<p style="color:#8A7A6C;margin:8px 0 20px;white-space:pre-line;">${escapeHtml(input.notes)}</p>`
    : "";

  const prepHtml = prepRows
    ? `<div style="margin-top:20px;background:#FFFDF8;border-radius:8px;padding:14px 16px;">
        <h3 style="color:#96341F;margin:0 0 8px;font-size:14px;">🛒 备料清单（按份数汇总）</h3>
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          ${prepRows}
        </table>
      </div>`
    : "";

  const html = `
  <div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FAF5EC;">
    <h2 style="color:#B3402A;margin:0 0 16px;">🍽️ ${escapeHtml(input.actorName)}${escapeHtml(
      input.actionPhrase
    )}</h2>
    <p style="color:#2A211B;margin:0 0 4px;">${formatCnDate(input.date)}（${weekdayCn(
      input.date
    )}）· ${escapeHtml(input.timeSlot)}</p>
    ${notesHtml}
    <table style="width:100%;border-collapse:collapse;background:#FFFDF8;border-radius:8px;overflow:hidden;">
      <thead><tr>
        <th style="text-align:left;padding:8px 12px;background:#F6E3DC;color:#96341F;">菜品</th>
        <th style="text-align:center;padding:8px 12px;background:#F6E3DC;color:#96341F;">数量</th>
        <th style="text-align:right;padding:8px 12px;background:#F6E3DC;color:#96341F;">小计</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p style="text-align:right;font-size:18px;font-weight:700;color:#B3402A;margin:16px 0 24px;">合计 ¥${(
      input.totalCents / 100
    ).toFixed(0)}</p>
    ${prepHtml}
    <a href="${baseUrl}/admin/orders"
       style="display:inline-block;margin-top:20px;background:#B3402A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
       去管理后台查看</a>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: [to],
      subject: `【家宴点菜】${escapeHtml(input.actorName)}${escapeHtml(
        input.actionPhrase
      )} #${input.orderId.slice(-6)}`,
      html,
    });
  } catch (err) {
    console.error("[email] 发送失败（不影响下单）:", err);
  }
}
