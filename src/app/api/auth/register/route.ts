import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (!name || name.length < 1 || name.length > 30) {
      return NextResponse.json({ error: "请输入昵称（1-30 个字符）" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: "密码至少 6 位" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册，请直接登录" }, { status: 409 });
    }

    // 角色：第一个注册的人成为「主人」；或注册邮箱等于 HOST_EMAIL 也成为主人
    const hostCount = await prisma.user.count({ where: { role: "HOST" } });
    const hostEmail = process.env.HOST_EMAIL?.toLowerCase();
    const role = hostCount === 0 || (hostEmail && email === hostEmail) ? "HOST" : "GUEST";

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role: role as "HOST" | "GUEST" },
    });

    await createSession({ id: user.id, email: user.email, name: user.name, role: user.role });

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (e) {
    console.error("[register]", e);
    return NextResponse.json({ error: "服务器开小差了，请稍后再试" }, { status: 500 });
  }
}
