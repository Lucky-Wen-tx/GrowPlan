"use client";

/**
 * 顶部导航栏
 * - 左侧：应用标题「拾光Plan」
 * - 右侧：主题切换按钮（ThemeToggle）+ 预留更多操作位
 */
import ThemeToggle from "@/components/common/ThemeToggle";

export default function Header(): React.ReactElement {
  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-neutral-300 dark:border-neutral-800 bg-white dark:bg-neutral-950 select-none">
      {/* 左侧：品牌标题 */}
      <div className="flex items-center gap-2">
        <span className="text-xl font-semibold tracking-wide text-neutral-800 dark:text-neutral-100">
          拾光Plan
        </span>
      </div>

      {/* 右侧：操作按钮区 */}
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
