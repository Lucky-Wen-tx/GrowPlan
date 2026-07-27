"use client";

/**
 * 主题切换按钮
 * 三态循环：light → dark → system
 * 图标：Sun（浅色）/ Moon（深色）/ Monitor（跟随系统）
 *
 * hydration 期间 ThemeProvider 统一返回 "system"，服务端/客户端
 * 均渲染 Monitor 图标，天然无 mismatch，无需额外占位逻辑。
 */
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import type { ThemeMode } from "@/hooks/useTheme";

const ICON_MAP: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABEL_MAP: Record<ThemeMode, string> = {
  light: "当前：浅色模式 — 点击切换",
  dark: "当前：深色模式 — 点击切换",
  system: "当前：跟随系统 — 点击切换",
};

export default function ThemeToggle(): React.ReactElement {
  const { mode, cycleMode } = useTheme();
  const Icon = ICON_MAP[mode];
  const label = LABEL_MAP[mode];

  return (
    <button
      type="button"
      onClick={cycleMode}
      title={label}
      aria-label={label}
      className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
    >
      <Icon size={18} />
    </button>
  );
}
