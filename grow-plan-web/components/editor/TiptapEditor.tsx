"use client";

/**
 * TipTap 所见即所得 Markdown 编辑器
 *
 * 核心职责：
 * 1. 渲染 TipTap 编辑器，加载当前笔记的 Markdown 内容
 * 2. onUpdate 时导出 Markdown → 同步到 zustand store
 * 3. 切换笔记时通过 setContent + parseOptions 加载新内容
 * 4. 通过 useAutoSave 钩子实现防抖自动保存
 * 5. 可编辑状态随 currentTitle 动态切换
 */
import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import { Markdown } from "tiptap-markdown";
import { lowlight } from "lowlight";
import { useNoteStore } from "@/store/useNoteStore";
import { useAutoSave } from "@/hooks/useAutoSave";

/**
 * TipTap 编辑器组件
 * 仅在笔记已选中时渲染，负责完整的编辑体验
 */
export default function TiptapEditor(): React.ReactElement {
  // ── 从 store 读取当前笔记状态 ───────────────────────────────
  const currentId: string | null = useNoteStore((s) => s.currentId);
  const currentTitle: string = useNoteStore((s) => s.currentTitle);
  const currentContent: string = useNoteStore((s) => s.currentContent);
  const setCurrentTitle: (title: string) => void = useNoteStore(
    (s) => s.setCurrentTitle,
  );
  const setCurrentContent: (content: string) => void = useNoteStore(
    (s) => s.setCurrentContent,
  );

  // ── 防抖自动保存（内容变更后 1 秒自动保存到后端）─────────────
  useAutoSave(currentId, currentContent);

  // ── 上一次渲染时的笔记 ID，用于在 effect 中检测笔记切换 ──────
  const prevNoteIdRef = useRef<string | null>(null);

  // ── 初始化编辑器 ────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      // StarterKit 提供加粗、斜体、标题、列表等基础功能
      // 禁用默认 codeBlock，改为 CodeBlockLowlight 支持语法高亮
      StarterKit.configure({ codeBlock: false }),
      // 代码块语法高亮
      CodeBlockLowlight.configure({ lowlight }),
      // 表格支持
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      // Markdown 导入/导出
      Markdown.configure({
        // 禁止内联 HTML，保持纯 Markdown
        html: false,
        // 换行符转为 <br>
        breaks: true,
      }),
    ],
    // 初始为空内容，实际内容在 effect 中通过 setContent + parseOptions 加载
    content: "",
    // 根据当前标题是否为空控制编辑权限
    editable: currentTitle.length > 0 && currentId !== null,
    // onUpdate：编辑器变更 → 导出 Markdown → 同步到 store
    onUpdate: ({ editor }: { editor: { storage: { markdown: { getMarkdown: () => string } } } }): void => {
      const markdown: string = editor.storage.markdown.getMarkdown();
      setCurrentContent(markdown);
    },
    // ProseMirror 根节点样式
    editorProps: {
      attributes: {
        class:
          "prose max-w-none dark:prose-invert " +
          "focus:outline-none min-h-full px-8 py-6",
      },
    },
    // 自动聚焦（首次打开笔记时光标直接定位到编辑器）
    autofocus: true,
  });

  // ── 切换笔记时加载 Markdown 内容 ────────────────────────────
  useEffect(() => {
    // 编辑器尚未就绪 / 无笔记选中 → 跳过
    if (!editor || currentId === null) {
      return;
    }

    // 同一篇笔记（未发生切换）→ 跳过
    if (prevNoteIdRef.current === currentId) {
      return;
    }

    // 记录新笔记 ID（必须在 setContent 之前更新，否则 onUpdate
    // 回调可能错误地将加载的内容视为"用户编辑"触发多余保存）
    prevNoteIdRef.current = currentId;

    // 通过 parseOptions: { format: 'markdown' } 将 Markdown
    // 原文解析为 TipTap 文档节点树并加载到编辑器
    editor.commands.setContent(currentContent, {
      parseOptions: { format: "markdown" },
    });
  }, [currentId, currentContent, editor]);

  // ── 同步 editable 状态 ──────────────────────────────────────
  useEffect(() => {
    if (editor) {
      const shouldEdit: boolean = currentTitle.length > 0 && currentId !== null;
      editor.setEditable(shouldEdit);
    }
  }, [currentId, currentTitle, editor]);

  // ── 编辑器未就绪 → 加载占位 ─────────────────────────────────
  if (!editor) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-gray-400 dark:text-gray-500 select-none">
        <p>编辑器加载中...</p>
      </div>
    );
  }

  // ── 渲染 TipTap 编辑器 ──────────────────────────────────────
  return (
    <div className="h-full flex flex-col">
      {/* 标题栏 */}
      <div className="shrink-0 px-8 py-4 border-b border-gray-200 dark:border-gray-800">
        <input
          type="text"
          value={currentTitle}
          onChange={(e: React.ChangeEvent<HTMLInputElement>): void => {
            setCurrentTitle(e.target.value);
          }}
          placeholder="未命名笔记"
          className="w-full text-xl font-semibold text-gray-900 dark:text-gray-100 bg-transparent placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none"
          aria-label="笔记标题"
        />
      </div>

      {/* 编辑器主体 */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
