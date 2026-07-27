/**
 * 根布局组件
 * 三栏结构：顶部导航 + 左侧边栏 + 右侧主内容区
 *
 * 主题：通过 ThemeProvider 管理浅色/深色/跟随系统三种模式，
 * 内联脚本在 hydration 前设置 <html class="dark"> 防止闪烁。
 */
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/hooks/useTheme";
import Header from "@/components/layout/Header";
import Sidebar from "@/components/layout/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "拾光Plan",
  description: "极简 Markdown 笔记应用",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <ThemeProvider>
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
              {children}
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
