"use client";

/**
 * 左侧边栏
 * - 顶部：新建笔记按钮（window.prompt 输入标题 → api.create → 刷新列表并选中）
 * - 下方：笔记列表（从 store 读取，点击切换当前笔记，高亮选中项）
 */
import { useEffect, useCallback, useState, useMemo } from "react";
import { PenLine, FileText, Search } from "lucide-react";
import { useNoteStore } from "@/store/useNoteStore";
import * as api from "@/lib/api";
import type { NoteItem } from "@/types/note";

export default function Sidebar(): React.ReactElement {
  // ── 从 store 读取状态 ──────────────────────────────────────
  const noteList: NoteItem[] = useNoteStore((s) => s.noteList);
  const currentId: string | null = useNoteStore((s) => s.currentId);
  const fetchNoteList = useNoteStore((s) => s.fetchNoteList);
  const selectNote = useNoteStore((s) => s.selectNote);

  // ── 搜索状态 ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState<string>("");

  // ── 前端实时过滤：按标题模糊匹配 ──────────────────────────
  const filteredList = useMemo<NoteItem[]>(() => {
    if (!searchQuery.trim()) {
      return noteList;
    }
    const keyword = searchQuery.trim().toLowerCase();
    return noteList.filter((note) =>
      note.title.toLowerCase().includes(keyword),
    );
  }, [noteList, searchQuery]);

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

  return (
    <aside className="w-64 shrink-0 flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
      {/* ── 新建笔记按钮区 ─────────────────────────────────── */}
      <div className="p-4 pb-2">
        <button
          type="button"
          onClick={handleCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-base font-medium rounded-xl
            border border-neutral-300 dark:border-neutral-700
            bg-neutral-100 dark:bg-neutral-800
            text-neutral-700 dark:text-neutral-200
            /* 默认微弱阴影：营造微浮起感 */
            shadow-[0_1px_2px_rgba(0,0,0,0.06),0_0_0_1px_rgba(0,0,0,0.02)]
            dark:shadow-[0_1px_2px_rgba(0,0,0,0.2),0_0_0_1px_rgba(255,255,255,0.03)]
            /* hover：上浮 + 阴影扩散 + 高光环 */
            hover:-translate-y-px
            hover:shadow-[0_4px_12px_rgba(0,0,0,0.1),0_0_0_1px_rgba(0,0,0,0.04),0_2px_4px_rgba(0,0,0,0.06)]
            dark:hover:shadow-[0_4px_12px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.06),0_2px_4px_rgba(0,0,0,0.2)]
            /* active：按下归位 + 压缩阴影 + 内凹 */
            active:translate-y-0
            active:shadow-[0_1px_2px_rgba(0,0,0,0.06),inset_0_1px_2px_rgba(0,0,0,0.06)]
            dark:active:shadow-[0_1px_2px_rgba(0,0,0,0.2),inset_0_1px_2px_rgba(0,0,0,0.15)]
            transition-all duration-200 ease-out"
        >
          <PenLine size={16} />
          新建笔记
        </button>
      </div>

      {/* ── 搜索框 ─────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索笔记…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-neutral-300 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none transition-all"
          />
        </div>
      </div>

      {/* ── 分割线 ─────────────────────────────────────────── */}
      <div className="mx-4 border-t border-neutral-100 dark:border-neutral-800" />

      {/* ── 笔记列表 ───────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-4 py-3">
        {noteList.length === 0 ? (
          /* 空状态：没有任何笔记 */
          <p className="py-8 text-center text-base text-neutral-400 dark:text-neutral-500">
            暂无笔记，点击上方按钮创建
          </p>
        ) : filteredList.length === 0 ? (
          /* 空状态：搜索无结果 */
          <p className="py-8 text-center text-base text-neutral-400 dark:text-neutral-500">
            未找到匹配的笔记
          </p>
        ) : (
          <ul className="space-y-1">
            {filteredList.map((note: NoteItem) => {
              const isActive: boolean = note.id === currentId;
              return (
                <li key={note.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(note.id)}
                    className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-normal ${
                      isActive
                        ? "bg-neutral-100 dark:bg-neutral-800 font-medium"
                        : "hover:bg-neutral-100 dark:hover:bg-neutral-800 border-transparent"
                    }`}
                  >
                    {/* 标题行：图标 + 标题 */}
                    <div className="flex items-center gap-2">
                      <FileText
                        size={14}
                        className={`shrink-0 ${
                          isActive
                            ? "text-neutral-700 dark:text-neutral-300"
                            : "text-neutral-400 dark:text-neutral-500"
                        }`}
                      />
                      <span
                        className={`text-[15px] truncate ${
                          isActive
                            ? "text-neutral-800 dark:text-neutral-200 font-bold"
                            : "text-neutral-700 dark:text-neutral-300"
                        }`}
                      >
                        {note.title}
                      </span>
                    </div>
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
