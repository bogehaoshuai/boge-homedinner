import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "@/lib/auth";

/**
 * 管理接口鉴权：要求登录且为「主人」。
 * 通过则返回 session，否则返回 NextResponse（错误响应）。
 */
export async function requireHost(): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  if (session.role !== "HOST") {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }
  return session;
}

export function isResponse(v: unknown): v is NextResponse {
  return v instanceof NextResponse;
}
