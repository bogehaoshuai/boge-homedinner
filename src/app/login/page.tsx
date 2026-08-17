import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = { title: "登录" };

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
      <LoginForm />
    </main>
  );
}
