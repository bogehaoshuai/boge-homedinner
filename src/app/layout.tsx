import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: {
    default: "家宴点菜 · 今晚吃什么，你来定",
    template: "%s · 家宴点菜",
  },
  description: "朋友在家吃饭点菜的预约平台：看看菜单、选个日子、点上想吃的菜。",
};

export const viewport: Viewport = {
  themeColor: "#FAF5EC",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-paper text-ink">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
