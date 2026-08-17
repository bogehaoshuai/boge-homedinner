# 家宴点菜（Home Dinner）

在家做饭请客用的点菜小站。朋友打开链接就能看菜单、选日子、点菜下单、预约时间；你在管理后台更新菜单、屏蔽不可约时间，新订单会邮件通知你。

- **朋友端**：看菜单 / 选日期时间 / 点菜下单 / 我的订单
- **主人端**（管理后台 `/admin`）：看板 / 菜品管理 / 订单管理 / 屏蔽不可约时间
- **通知**：新订单邮件提醒（Resend）+ 后台待办列表

技术栈：Next.js 15（App Router）+ TypeScript + Tailwind CSS + Prisma + PostgreSQL（Vercel Postgres / Neon）。认证为轻量 JWT 会话（jose + bcryptjs），无需第三方认证服务。

---

## 一、本地跑起来

前置要求：Node.js ≥ 18、Docker（可选，用于本地数据库）。

```bash
# 1. 安装依赖
npm install

# 2. 准备环境变量
cp .env.example .env

# 3. 启动本地数据库（Docker，可选；或用你已有的 Postgres 改 .env 里的 DATABASE_URL）
npm run db:up

# 4. 生成数据库表（首次运行会创建 migrations/ 目录）
npx prisma migrate dev --name init

# 5. 写入示例菜品（可选）
npm run seed

# 6. 启动开发服务器
npm run dev
# 打开 http://localhost:3000
```

> **首个注册的账号自动成为「主人」**。注册后顶栏会出现「管理后台」入口。

---

## 二、部署到 Vercel（免费，无需审批）

### 2.1 准备 GitHub 仓库

把项目推到 GitHub（Vercel 可直接导入仓库）：

```bash
git init
git add .
git commit -m "init home-dinner"
git branch -M main
git remote add origin <你的仓库地址>
git push -u origin main
```

### 2.2 创建数据库（Vercel Postgres / Neon）

任选其一，都是免费额度：

- **Vercel 集成**（最省事）：在 Vercel 项目页 `Storage → Create Database → Postgres`，选免费 Hobby 计划。创建后点 **Connect**，把生成的连接串拷贝出来。
- **Neon**：注册 https://neon.tech ，新建项目，复制 `DATABASE_URL`。

### 2.3 导入项目并配置环境变量

1. 打开 https://vercel.com/new ，导入你的 GitHub 仓库。
2. 在项目 **Settings → Environment Variables** 里添加（值从上面拷贝 / 生成）：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 上一步的 Postgres 连接串（`postgres://...`） |
| `AUTH_SECRET` | 随机长字符串。本地终端跑 `openssl rand -base64 32` 生成 |
| `RESEND_API_KEY` | Resend 的 API Key（见下文 2.5） |
| `RESEND_TO_EMAIL` | 接收新订单通知的邮箱 |
| `RESEND_FROM_EMAIL` | 发件邮箱（Resend 验证过的域名；测试可用 `onboarding@resend.dev`） |
| `HOST_EMAIL` | 可选。用该邮箱注册的账号自动成为主人 |

### 2.4 数据库建表：无需手动操作

项目已自带完整的 `prisma/migrations/` 迁移文件，并配置了 `vercel.json`，部署时 Vercel 会自动执行 `prisma migrate deploy && next build`——首次部署即可直接成功，无需手动建表。

> 后续如果改了数据模型，请先本地运行 `npx prisma migrate dev --name xxx` 生成新迁移并提交，Vercel 部署时会自动应用。

### 2.5 首次上线后：创建「主人」账号

上线后打开你的网站网址，**用你自己的邮箱注册**——**第一个注册的账号会自动成为「主人」**（或在环境变量里设置 `HOST_EMAIL`，用该邮箱注册的账号自动成为主人）。注册后顶栏会出现「管理后台」入口，即可开始管理菜单。

> 可选：想直接写入示例菜品，可在本地对生产库执行 `DATABASE_URL="<连接串>" npm run seed`（会创建主人账号 `host@example.com` 及示例菜品）。

### 2.6 配置邮件通知（Resend）

1. 打开 https://resend.com 注册。
2. 创建 API Key（`Keys → Create API Key`），复制到 `RESEND_API_KEY`。
3. `RESEND_FROM_EMAIL`：
   - 想正式收发，需要在 Resend **验证一个你自己的域名**（`Domains → Add`，按提示加一条 DNS 记录），然后填 `noreply@你的域名`。
   - 想先快速测试：用默认的 `onboarding@resend.dev`，此时**只能发给注册 Resend 时的邮箱**，所以 `RESEND_TO_EMAIL` 填你注册 Resend 的邮箱即可。
4. 保存后重新部署（或本地开发时重启 `npm run dev`）。

---

## 三、日常使用

| 操作 | 在哪 |
| --- | --- |
| 看菜单 / 点菜 / 预约 | 首页（公开链接） |
| 管理菜单（加菜、下架、改价） | `/admin/menu` |
| 屏蔽某天 / 某时段 | `/admin/schedule` |
| 确认 / 完成 / 取消订单 | `/admin/orders` |
| 朋友自助取消订单 | 朋友在「我的订单」页可自行取消（待确认/已确认状态的订单），你会收到取消通知邮件 |

**把链接分享给朋友**：把部署后的网址（如 `https://你的项目名.vercel.app`）发给朋友，他们注册账号即可开始点菜。

---

## 四、常用命令

```bash
npm run dev          # 开发模式
npm run build        # 生产构建
npm run start        # 运行生产构建
npm run db:up        # 启动本地数据库（Docker）
npm run db:down      # 停止本地数据库
npm run seed         # 写入主人账号 + 示例菜品
npx prisma studio    # 可视化查看数据库
```

## 五、目录结构

```
prisma/schema.prisma   # 数据模型（用户/菜品/订单/不可约时段）
src/app/               # 页面与 API 路由
  page.tsx             # 首页：菜单 + 点菜 + 预约
  login/ register/     # 登录 / 注册
  orders/              # 我的订单
  admin/               # 管理后台（总览/菜品/订单/时段）
  api/                 # 后端接口
src/lib/               # 数据库连接、认证、邮件、常量
src/components/        # UI 组件
```
