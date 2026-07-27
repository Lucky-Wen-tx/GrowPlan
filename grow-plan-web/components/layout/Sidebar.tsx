"use client";

/**
 * 左侧边栏
 * - 顶部：新建笔记按钮（window.prompt 输入标题 → api.create → 刷新列表并选中）
 * - 下方：笔记列表（从 store 读取，点击切换当前笔记，高亮选中项）
 */
import { useEffect, useCallback } from "react";
import { Plus, FileText } from "lucide-react";
import { useNoteStore } from "@/store/useNoteStore";
import * as api from "@/lib/api";
import type { NoteItem } from "@/types/note";

export default function Sidebar(): React.ReactElement {
  // ── 从 store 读取状态 ──────────────────────────────────────
  const noteList: NoteItem[] = useNoteStore((s) => s.noteList);
  const currentId: string | null = useNoteStore((s) => s.currentId);
  const fetchNoteList = useNoteStore((s) => s.fetchNoteList);
  const selectNote = useNoteStore((s) => s.selectNote);

  // 组件挂载时拉取笔记列表
  useEffect(() => {
    fetchNoteList();
  }, [fetchNoteList]);

  // ── 新建笔记 ──────────────────────────────────────────────
  const handleCreate = useCallback(async (): Promise<void> => {
    const title: string | null = window.prompt("请输入笔记标题");
    // 用户取消或输入空白 → 不做任何操作
    if (!title || title.trim().length === 0) {
      return;
    }

    try {
      const detail = await api.create(title.trim());
      // 刷新列表并自动选中新建的笔记
      await fetchNoteList();
      await selectNote(detail.id);
    } catch (err: unknown) {
      const message: string =
        err instanceof Error ? err.message : "新建笔记失败，请稍后重试";
      window.alert(message);
    }
  }, [fetchNoteList, selectNote]);

  // ── 切换笔记 ──────────────────────────────────────────────
  const handleSelect = useCallback(
    async (id: string): Promise<void> => {
      // 避免重复选中同一篇
      if (id === currentId) {
        return;
      }
      try {
        await selectNote(id);
      } catch (err: unknown) {
        const message: string =
          err instanceof Error ? err.message : "加载笔记失败，请稍后重试";
        window.alert(message);
      }
    },
    [currentId, selectNote],
  );

  // ── 格式化时间为相对友好的显示 ────────────────────────────
  const formatTime = (iso: string): string => {
    const date: Date = new Date(iso);
    const now: Date = new Date();
    const diffMs: number = now.getTime() - date.getTime();
    const diffMin: number = Math.floor(diffMs / 60000);

    if (diffMin < 1) return "刚刚";
    if (diffMin < 60) return `${diffMin} 分钟前`;
    const diffHour: number = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} 小时前`;
    const diffDay: number = Math.floor(diffHour / 24);
    if (diffDay < 7) return `${diffDay} 天前`;

    // 超过一周显示完整日期
    return date.toLocaleDateString("zh-CN", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
      {/* ── 新建笔记按钮区 ─────────────────────────────────── */}
      <div className="p-3">
        <button
          type="button"
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 transition-colors"
        >
          <Plus size={16} />
          新建笔记
        </button>
      </div>

      {/* ── 分割线 ─────────────────────────────────────────── */}
      <div className="mx-3 border-t border-gray-100 dark:border-gray-800" />

      {/* ── 笔记列表 ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {noteList.length === 0 ? (
          /* 空状态 */
          <p className="px-3 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
            暂无笔记，点击上方按钮创建
          </p>
        ) : (
          <ul className="space-y-0.5">
            {noteList.map((note: NoteItem) => {
              const isActive: boolean = note.id === currentId;
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(note.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      isActive
                        ? "bg-gray-100 dark:bg-gray-800"
                        : "hover:bg-gray-50 dark:hover:bg-gray-900"
                    }`}
                  >
                    {/* 标题行：图标 + 标题 */}
                    <div className="flex items-center gap-2">
                      <FileText
                        size={14}
                        className={`shrink-0 ${
                          isActive
                            ? "text-gray-700 dark:text-gray-300"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <span
                        className={`text-sm truncate ${
                          isActive
                            ? "text-gray-900 dark:text-gray-100 font-medium"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {note.title}
                      </span>
                    </div>
                    {/* 更新时间 */}
                    <p className="mt-1 pl-6 text-xs text-gray-400 dark:text-gray-500">
                      {formatTime(note.updated_at)}
                    </p>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
    </aside>
  );
}
