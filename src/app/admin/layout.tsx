import AdminNav from "@/components/admin/AdminNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row">
      <AdminNav />
      <main className="min-w-0 flex-1 bg-paper px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
