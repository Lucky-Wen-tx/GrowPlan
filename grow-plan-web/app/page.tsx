"use client";

/**
 * 主页面
 * - 未选择笔记：显示欢迎引导页
 * - 已选择笔记：渲染 TipTap 所见即所得 Markdown 编辑器
 */
import { Notebook } from "lucide-react";
import { useNoteStore } from "@/store/useNoteStore";
import TiptapEditor from "@/components/editor/TiptapEditor";

export default function Home(): React.ReactElement {
  const currentId: string | null = useNoteStore((s) => s.currentId);

  // ── 未选择笔记 → 欢迎页 ──────────────────────────────────
  if (!currentId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center select-none">
          {/* 图标 */}
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
            <Notebook
              size={32}
              className="text-gray-300 dark:text-gray-600"
            />
          </div>
          {/* 引导文案 */}
          <h2 className="text-lg font-medium text-gray-500 dark:text-gray-400">
            拾光Plan
          </h2>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            选择或创建一篇笔记，开始记录灵感
          </p>
        </div>
      </div>
    );
  }

  // ── 已选择笔记 → 编辑器 ──────────────────────────────────
  return <TiptapEditor />;
}
