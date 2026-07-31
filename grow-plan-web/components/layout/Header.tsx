"use client";

/**
 * 顶部导航栏
 * - 左侧：应用标题「拾光Plan」
 * - 右侧：主题切换按钮（ThemeToggle）+ 预留更多操作位
 */
import ThemeToggle from "@/components/common/ThemeToggle";

export default function Header(): React.ReactElement {
  return (
    <header className="h-12 shrink-0 flex items-center justify-between px-4 bg-white dark:bg-neutral-950 select-none relative z-10 after:absolute after:inset-x-0 after:top-full after:h-1 after:bg-gradient-to-b after:from-black/8 after:to-transparent dark:after:from-black/40">
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
