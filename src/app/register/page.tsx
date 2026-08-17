import type { Metadata } from "next";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "注册" };

export default function RegisterPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col px-4 py-14 sm:px-6">
      <RegisterForm />
    </main>
  );
}
