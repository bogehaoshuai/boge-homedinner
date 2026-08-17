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

type OrderNotifyInput = {
  orderId: string;
  guestName: string;
  date: string;
  timeSlot: string;
  notes?: string | null;
  totalCents: number;
  items: { dishName: string; quantity: number; priceCents: number }[];
};

type OrderCancelInput = {
  orderId: string;
  guestName: string;
  date: string;
  timeSlot: string;
};

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

/** 发送新订单通知邮件（失败静默，不阻塞下单） */
export async function sendOrderNotificationEmail(input: OrderNotifyInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.RESEND_TO_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  // 未配置邮件服务时跳过
  if (!apiKey || !to) return;

  const rows = input.items
    .map((it) => {
      const amount = ((it.priceCents * it.quantity) / 100).toFixed(0);
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;">${escapeHtml(it.dishName)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">x${it.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">¥${amount}</td>
      </tr>`;
    })
    .join("");

  const notesHtml = input.notes ? `<p style="color:#8A7A6C;margin:8px 0 20px;">备注：${escapeHtml(input.notes)}</p>` : "";

  const html = `
  <div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FAF5EC;">
    <h2 style="color:#B3402A;margin:0 0 16px;">🍽️ 新的点菜订单</h2>
    <p style="color:#2A211B;margin:0 0 4px;">${escapeHtml(input.guestName)} 下单了</p>
    <p style="color:#8A7A6C;margin:0 0 4px;">${formatCnDate(input.date)}（${weekdayCn(
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
    <a href="${siteUrl()}/admin/orders"
       style="display:inline-block;background:#B3402A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
       去管理后台查看</a>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: [to],
      subject: `【家宴点菜】${escapeHtml(input.guestName)} 的新订单 #${input.orderId.slice(-6)}`,
      html,
    });
  } catch (err) {
    console.error("[email] 发送失败（不影响下单）:", err);
  }
}

/** 发送订单取消通知邮件（失败静默） */
export async function sendOrderCancelledEmail(input: OrderCancelInput) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.RESEND_TO_EMAIL;
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  if (!apiKey || !to) return;

  const html = `
  <div style="font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:520px;margin:0 auto;padding:24px;background:#FAF5EC;">
    <h2 style="color:#B3402A;margin:0 0 16px;">📋 订单被取消了</h2>
    <p style="color:#2A211B;margin:0 0 4px;">${escapeHtml(input.guestName)} 取消了 ${formatCnDate(
      input.date
    )}（${weekdayCn(input.date)}）· ${escapeHtml(input.timeSlot)} 的订单</p>
    <p style="color:#8A7A6C;margin:16px 0 0;font-size:14px;">订单号 #${input.orderId.slice(-6).toUpperCase()}，食材采购前记得核对。</p>
    <a href="${siteUrl()}/admin/orders"
       style="display:inline-block;margin-top:20px;background:#B3402A;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">
       去管理后台查看</a>
  </div>`;

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: [to],
      subject: `【家宴点菜】${escapeHtml(input.guestName)} 取消了订单 #${input.orderId.slice(-6)}`,
      html,
    });
  } catch (err) {
    console.error("[email] 取消通知发送失败:", err);
  }
}
