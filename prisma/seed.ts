/**
 * 种子脚本：
 *  1. 创建主人账号（若 HOST_EMAIL 设置了，用该邮箱；否则 host@example.com）
 *  2. 写入一批示例菜品，方便第一次打开就能看到菜单效果
 *
 * 用法：npm run seed
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hostEmail = process.env.HOST_EMAIL || "host@example.com";
  const hostPassword = process.env.SEED_HOST_PASSWORD || "12345678";

  // ── 主人账号 ──────────────────────────────
  const existingHost = await prisma.user.findUnique({ where: { email: hostEmail } });
  if (!existingHost) {
    const passwordHash = await bcrypt.hash(hostPassword, 10);
    await prisma.user.create({
      data: { email: hostEmail, name: "家宴主人", passwordHash, role: Role.HOST },
    });
    console.log(`✅ 已创建主人账号：${hostEmail} / 密码：${hostPassword}`);
    console.log("   上线后请务必通过 /login 登录并尽快改掉这个默认密码（详见 README）。");
  } else {
    console.log(`ℹ️  主人账号已存在：${hostEmail}`);
  }

  // ── 示例菜品 ──────────────────────────────
  const dishCount = await prisma.dish.count();
  if (dishCount > 0) {
    console.log("ℹ️  已有菜品，跳过示例数据。");
    return;
  }

  const dishes = [
    { name: "红烧肉", description: "慢炖五花，酱香浓郁，入口即化", priceCents: 4800, category: "热菜", sortOrder: 1 },
    { name: "清蒸鲈鱼", description: "鲜嫩少刺，葱油淋香", priceCents: 5800, category: "热菜", sortOrder: 2 },
    { name: "宫保鸡丁", description: "微辣微甜，花生酥脆", priceCents: 3200, category: "热菜", sortOrder: 3 },
    { name: "麻婆豆腐", description: "麻辣烫嫩，下饭神器", priceCents: 2200, category: "热菜", sortOrder: 4 },
    { name: "拍黄瓜", description: "清爽开胃，蒜香十足", priceCents: 1200, category: "前菜", sortOrder: 1 },
    { name: "凉拌木耳", description: "爽脆解腻，醋香微辣", priceCents: 1500, category: "前菜", sortOrder: 2 },
    { name: "番茄蛋花汤", description: "家常温暖，酸甜开胃", priceCents: 1600, category: "汤品", sortOrder: 1 },
    { name: "玉米排骨汤", description: "清甜滋润，暖心暖胃", priceCents: 2800, category: "汤品", sortOrder: 2 },
    { name: "白米饭", description: "东北大米，粒粒分明", priceCents: 300, category: "主食", sortOrder: 1 },
    { name: "手工葱油饼", description: "外酥里软，葱香扑鼻", priceCents: 800, category: "主食", sortOrder: 2 },
    { name: "杨枝甘露", description: "芒果西柚，清甜收尾", priceCents: 1800, category: "甜品", sortOrder: 1 },
    { name: "酸梅汤", description: "自制冰镇，生津解腻", priceCents: 600, category: "饮品", sortOrder: 1 },
  ];

  for (const d of dishes) {
    await prisma.dish.create({ data: d });
  }
  console.log(`✅ 已创建 ${dishes.length} 道示例菜品。`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
