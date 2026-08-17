# 🚀 上线部署清单（GitHub + Vercel）

项目已就绪：**数据库迁移文件已内置**、**`vercel.json` 已配置**（部署时自动建表）。照下面步骤做，约 15 分钟上线。

---

## 第 1 步：把项目推到 GitHub

1. 打开 https://github.com/new ，新建一个仓库（名字随意，如 `home-dinner`，**不要勾选** README/init 等初始化选项）。
2. 在项目目录里执行（把 `<你的仓库地址>` 换成你刚创建仓库的 HTTPS 地址）：

```bash
cd C:\WorkSpaceCC\boge-homedinner
git remote add origin <你的仓库地址>
git push -u origin main
```

> 若提示需要登录，按 GitHub 提示登录或使用 Personal Access Token。

---

## 第 2 步：创建数据库

任选其一（都是免费额度）：

- **Vercel Postgres（推荐，最省事）**：打开 https://vercel.com → 新建项目时点 **Storage → Create Database → Postgres**，选 Hobby 计划。创建后把连接串拷贝出来。
- **Neon**：注册 https://neon.tech → 新建项目 → 复制 `DATABASE_URL`（`postgres://...`）。

---

## 第 3 步：导入 Vercel 并配置环境变量

1. 打开 https://vercel.com/new ，点 **Import**，选择刚推上去的 `home-dinner` 仓库。
2. 在项目 **Settings → Environment Variables** 添加以下变量：

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | 第 2 步的 Postgres 连接串 |
| `AUTH_SECRET` | 随机长字符串（本地终端跑 `openssl rand -base64 32` 生成） |
| `HOST_EMAIL` | **你的邮箱**。用这个邮箱注册的账号会自动成为「主人」（强烈建议设置） |
| `RESEND_API_KEY` | Resend API Key（见第 5 步） |
| `RESEND_TO_EMAIL` | 接收新订单通知的邮箱（你的邮箱） |
| `RESEND_FROM_EMAIL` | 测试可用 `onboarding@resend.dev`；正式请用 Resend 验证过的域名邮箱 |

3. 点 **Deploy**，等构建完成（首次部署会自动建表）。构建成功后会得到一个网址：`https://你的项目名.vercel.app`。

---

## 第 4 步：创建「主人」账号

1. 打开部署后的网址，**用你自己的邮箱**点「注册」（因为设置了 `HOST_EMAIL`，注册后自动成为主人）。
2. 注册后顶栏出现「管理后台」→ 进去「菜品管理」加菜，或跑种子数据（见下）。

> ⚠️ **重要**：上线后请务必**先自己注册**，再把网址发给朋友。若没设置 `HOST_EMAIL` 且朋友先注册，朋友会变成主人。

可选：想直接写入示例菜品，在本地对生产库执行：

```bash
DATABASE_URL="<第2步的连接串>" npm run seed
```

---

## 第 5 步：配置邮件通知（Resend）

1. 注册 https://resend.com 。
2. `Keys → Create API Key`，复制到 `RESEND_API_KEY`。
3. `RESEND_FROM_EMAIL`：
   - 快速测试：用 `onboarding@resend.dev`（此时**只能发给注册 Resend 时用的邮箱**，所以 `RESEND_TO_EMAIL` 填那个邮箱）。
   - 正式收发：Resend 里 `Domains → Add` 验证你自己的域名，然后填 `noreply@你的域名`。
4. 保存环境变量后重新部署一次。

---

## 完成 ✅

把 `https://你的项目名.vercel.app` 发给朋友即可。之后每次往 GitHub 推送代码，Vercel 会自动重新部署。

**日常入口：**
- 朋友点菜：首页网址
- 你管理菜单/订单/不可约时间：`/admin`

**改代码后重新部署**：`git add . && git commit -m "..." && git push`（Vercel 自动发布）。
