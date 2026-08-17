"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Lock, Mail, User } from "lucide-react";
import { Button, FieldError } from "@/components/ui";

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-card p-7 shadow-menu">
      <div className="mb-6">
        <span className="seal h-10 w-10 text-xl">宴</span>
        <h1 className="mt-3 font-display text-2xl font-bold">加入家宴</h1>
        <p className="mt-1 text-sm text-muted">注册后就能点菜、预约时间了</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/80">怎么称呼你</span>
          <div className="relative">
            <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="比如：小王"
              className="w-full rounded-lg border border-line bg-paper/50 py-2.5 pl-10 pr-3.5 text-[15px] text-ink placeholder:text-ink/30 focus:border-cinnabar/50 focus:outline-none focus:ring-2 focus:ring-cinnabar/20"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/80">邮箱</span>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-lg border border-line bg-paper/50 py-2.5 pl-10 pr-3.5 text-[15px] text-ink placeholder:text-ink/30 focus:border-cinnabar/50 focus:outline-none focus:ring-2 focus:ring-cinnabar/20"
            />
          </div>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink/80">密码</span>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              className="w-full rounded-lg border border-line bg-paper/50 py-2.5 pl-10 pr-3.5 text-[15px] text-ink placeholder:text-ink/30 focus:border-cinnabar/50 focus:outline-none focus:ring-2 focus:ring-cinnabar/20"
            />
          </div>
        </label>

        <FieldError>{error}</FieldError>

        <Button className="w-full" size="lg" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          注册
        </Button>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        已经有账号？{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-cinnabar hover:underline">
          直接登录
        </Link>
      </p>
      <p className="mt-3 text-center text-xs leading-relaxed text-muted/80">
        💡 第一个注册的账号会自动成为「主人」，可以管理菜单和订单
      </p>
    </div>
  );
}

export default function RegisterForm() {
  return (
    <Suspense>
      <RegisterFormInner />
    </Suspense>
  );
}
