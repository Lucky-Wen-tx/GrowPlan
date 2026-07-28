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
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-50 dark:bg-brand-950 mb-5">
            <Notebook
              size={40}
              className="text-brand-300 dark:text-brand-700"
            />
          </div>
          {/* 引导文案 */}
          <h2 className="text-xl font-medium text-neutral-500 dark:text-neutral-400">
            拾光Plan
          </h2>
          <p className="mt-2 text-base text-neutral-400 dark:text-neutral-500">
            选择或创建一篇笔记，开始记录灵感
          </p>
        </div>
      </div>
    );
  }

  // ── 已选择笔记 → 编辑器 ──────────────────────────────────
  return <TiptapEditor />;
}
