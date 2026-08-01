"use client";

/**
 * 防抖自动保存 Hook
 *
 * 核心逻辑：
 * 1. 内容变化后等待 delay 毫秒，调用 api.update 保存正文
 * 2. 标题在创建笔记时已确定，不再随自动保存更新
 *
 * 使用方式：
 *   const noteId  = useNoteStore(s => s.currentId);
 *   const content = useNoteStore(s => s.currentContent);
 *   useAutoSave(noteId, content); // 默认 1000ms 防抖
 */
import { useRef, useEffect } from "react";
import { update } from "@/lib/api";
import { useNoteStore } from "@/store/useNoteStore";

// ── 保存快照类型（记录上次成功保存时的 noteId + 正文）───────
interface SaveSnapshot {
  /** 保存时对应的笔记 ID */
  noteId: string;
  /** 保存时的正文内容 */
  content: string;
}

/**
 * @param noteId  - 当前笔记 ID（对应 store.currentId），null 时不启用自动保存
 * @param content - 当前笔记正文
 * @param delay   - 防抖延迟毫秒数，默认 1000
 */
export function useAutoSave(
  noteId: string | null,
  content: string,
  delay: number = 1000,
): void {
  /** 防抖定时器句柄 */
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 上次成功保存时的 { noteId, title, content } 快照 */
  const lastSavedRef = useRef<SaveSnapshot | null>(null);

  useEffect(() => {
    // ── 未选中笔记 → 不执行任何操作 ─────────────────────────
    if (noteId === null) {
      return;
    }

    // ── 笔记切换 → 用当前值初始化快照，视为"已保存"状态 ────
    // 避免切换笔记后自动触发一次无意义的保存请求
    if (
      lastSavedRef.current === null ||
      lastSavedRef.current.noteId !== noteId
    ) {
      lastSavedRef.current = { noteId, content };
      return;
    }

    // ── 内容未变化 → 跳过，避免重复请求 ──────────────────────
    if (lastSavedRef.current.content === content) {
      return;
    }

    // ── 清除上一次尚未触发的定时器（重新倒计时）──────────────
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // ── 启动防抖定时器 ──────────────────────────────────────
    timerRef.current = setTimeout(async () => {
      try {
        const result = await update(noteId, { content });

        // 保存成功后记录快照
        lastSavedRef.current = {
          noteId: result.id,
          content: result.content,
        };
        // 使用后端返回的文件修改时间（直接读取 .md 文件 mtime）
        useNoteStore.getState().setLastSavedAt(result.updated_at);
      } catch (err: unknown) {
        // 自动保存失败静默处理 —— 避免频繁弹窗打扰用户
        // 下次变更时定时器会重新触发保存
        const message: string =
          err instanceof Error ? err.message : "未知错误";
        console.error(`[AutoSave] 保存失败 (noteId=${noteId}):`, message);
      }
    }, delay);

    // ── 清理函数：依赖变更/组件卸载时清除定时器 ──────────────
    return (): void => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [noteId, content, delay]);
}
