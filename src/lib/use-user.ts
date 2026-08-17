"use client";

import { useEffect, useState } from "react";

export type MeUser = {
  id: string;
  name: string;
  email: string;
  role: "HOST" | "GUEST";
} | null;

export function useUser() {
  const [user, setUser] = useState<MeUser | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data: { user: MeUser }) => {
        if (!cancelled) setUser(data.user ?? null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}
