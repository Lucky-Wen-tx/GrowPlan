"use client";

/**
 * 防抖自动保存 Hook
 *
 * 核心逻辑：
 * 1. 标题或内容变化后等待 delay 毫秒，调用 api.update 同时保存标题和正文
 * 2. 后端在标题变化时会同步更新文件内一级标题并重命名 .md 文件，
 *    返回新的 noteId，前端自动同步到 store 并刷新侧栏列表
 * 3. noteId 变化（切换笔记/重命名）时清除保存标记，防止跨笔记误判
 * 4. 组件卸载时 effect 清理函数自动清除定时器
 *
 * 使用方式：
 *   const noteId  = useNoteStore(s => s.currentId);
 *   const title   = useNoteStore(s => s.currentTitle);
 *   const content = useNoteStore(s => s.currentContent);
 *   useAutoSave(noteId, title, content); // 默认 1000ms 防抖
 */
import { useRef, useEffect } from "react";
import { update } from "@/lib/api";
import { useNoteStore } from "@/store/useNoteStore";

// ── 保存快照类型（记录上次成功保存时的 noteId + 标题 + 正文）───
interface SaveSnapshot {
  /** 保存时对应的笔记 ID */
  noteId: string;
  /** 保存时的标题 */
  title: string;
  /** 保存时的正文内容 */
  content: string;
}

/**
 * @param noteId  - 当前笔记 ID（对应 store.currentId），null 时不启用自动保存
 * @param title   - 当前笔记标题
 * @param content - 当前笔记正文
 * @param delay   - 防抖延迟毫秒数，默认 1000
 */
export function useAutoSave(
  noteId: string | null,
  title: string,
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

    // ── 笔记切换 → 清除旧笔记的保存标记 ──────────────────────
    // 防止新笔记的内容恰好与旧笔记相同时被误判为"已保存"
    if (
      lastSavedRef.current !== null &&
      lastSavedRef.current.noteId !== noteId
    ) {
      lastSavedRef.current = null;
    }

    // ── 标题和内容均未变化 → 跳过，避免重复请求 ──────────────
    if (
      lastSavedRef.current !== null &&
      lastSavedRef.current.title === title &&
      lastSavedRef.current.content === content
    ) {
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
        // 构建请求体：标题为空时仅保存内容，避免后端校验失败
        const payload: { title?: string; content?: string } = { content };
        if (title.trim().length > 0) {
          payload.title = title;
        }

        const result = await update(noteId, payload);

        // 保存成功后记录快照（使用后端返回的值，确保与文件系统一致）
        lastSavedRef.current = {
          noteId: result.id,
          title: result.title,
          content: result.content,
        };
        // 同步记录保存时间到 store，供 StatusBar 等组件读取
        useNoteStore.getState().setLastSavedAt(new Date().toISOString());

        // 标题变更导致后端重命名文件 → 同步更新 store 中的 ID 并刷新列表
        if (result.id !== noteId) {
          useNoteStore.getState().setCurrentId(result.id);
          useNoteStore.getState().fetchNoteList();
        }
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
  }, [noteId, title, content, delay]);
}
