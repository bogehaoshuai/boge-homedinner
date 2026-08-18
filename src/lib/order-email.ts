import { sendOrderUpdateEmail } from "@/lib/email";

type EmailItem = {
  dishName: string;
  quantity: number;
  priceCents: number;
  options: unknown;
  ingredients: unknown;
  addedByName?: string | null;
};

type OrderLike = {
  id: string;
  date: string;
  timeSlot: string;
  notes?: string | null;
  totalCents: number;
  items: EmailItem[];
};

/** 把数据库里的 OrderItem 快照转成邮件需要的结构 */
export function itemToEmailInfo(it: EmailItem) {
  return {
    dishName: it.dishName,
    quantity: it.quantity,
    priceCents: it.priceCents,
    options: Array.isArray(it.options)
      ? (it.options as { group: string; choice: string }[])
      : [],
    ingredients: Array.isArray(it.ingredients)
      ? (it.ingredients as { name: string; gramsPerServing: number }[])
      : [],
    addedBy: it.addedByName ?? null,
  };
}

/** 发送共享订单变更邮件，带 3 秒超时兜底（不阻塞下单/操作） */
export async function sendUpdateWithTimeout(
  order: OrderLike,
  actionPhrase: string,
  actorName: string,
  origin?: string
) {
  await Promise.race([
    sendOrderUpdateEmail(
      {
        orderId: order.id,
        date: order.date,
        timeSlot: order.timeSlot,
        notes: order.notes,
        totalCents: order.totalCents,
        items: order.items.map(itemToEmailInfo),
        actionPhrase,
        actorName,
      },
      origin
    ),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
