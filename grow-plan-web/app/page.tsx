"use client";

/**
 * 主页面
 * - 未选择笔记：显示欢迎引导页
 * - 已选择笔记：渲染 Milkdown 所见即所得 Markdown 编辑器
 */
import Image from "next/image";
import { Ma_Shan_Zheng } from "next/font/google";
import { useNoteStore } from "@/store/useNoteStore";
import MilkdownEditor from "@/components/editor/MilkdownEditor";

/** 副标题书法字体（马山正行书） */
const subtitleFont = Ma_Shan_Zheng({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function Home(): React.ReactElement {
  const currentId: string | null = useNoteStore((s) => s.currentId);

  // ── 未选择笔记 → 欢迎页 ──────────────────────────────────
  if (!currentId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center select-none">
          {/* 图标 */}
          <div className="inline-flex items-center justify-center w-20 h-15 mb-5">
            <Image
              src="/ico_index.png"
              alt="拾光"
              width={55}
              height={55}
              unoptimized
            />
          </div>
          {/* 引导文案 */}
          <h2 className="text-2xl font-medium text-neutral-500 dark:text-neutral-400">
            拾光Plan
          </h2>
          <p
            className={`mt-2 text-lg text-neutral-400 dark:text-neutral-500 ${subtitleFont.className}`}
          >
            拾取星光，记录成长
          </p>
        </div>
      </div>
    );
  }

  // ── 已选择笔记 → 编辑器 ──────────────────────────────────
  return <MilkdownEditor />;
}
