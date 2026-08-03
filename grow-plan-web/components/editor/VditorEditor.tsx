"use client";

/**
 * Vditor 所见即所得 Markdown 编辑器
 *
 * 核心职责：
 * 1. 初始化 Vditor 实例（ir 模式，无工具栏，极简写作体验）
 * 2. input 回调中直接获取 Markdown → 同步到 zustand store
 * 3. 切换笔记时通过 setValue 加载新内容
 * 4. 通过 useAutoSave 钩子实现防抖自动保存
 * 5. 可编辑状态随 currentId 动态切换（无笔记选中时禁用）
 * 6. 主题跟随应用 ThemeProvider（classic / dark）
 *
 * 与 TipTap 版本的关键区别：
 * - Vditor 原生处理 Markdown，无需 tiptap-markdown 桥接层
 * - 无往返失真问题（setValue 直接操作 Markdown 字符串）
 * - 无自定义 TyporaMarkExtension（Vditor ir 模式自带良好的标记符处理）
 */
import { useEffect, useRef, useState } from "react";
import Vditor from "vditor";
// Vditor 自带 CSS（主题、代码高亮等），在组件内按需加载
import "vditor/dist/index.css";
// 项目自定义 Vditor 样式覆写（必须排在官方 CSS 之后引入，确保覆盖生效）
import "./vditor-overrides.css";
import { useNoteStore } from "@/store/useNoteStore";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useTheme } from "@/hooks/useTheme";
import StatusBar from "@/components/editor/StatusBar";

/**
 * Vditor 编辑器组件
 * 仅在笔记已选中时渲染，负责完整的编辑体验
 */
export default function VditorEditor(): React.ReactElement {
  // ── 从 store 读取当前笔记状态 ───────────────────────────────
  const currentId: string | null = useNoteStore((s) => s.currentId);
  const currentContent: string = useNoteStore((s) => s.currentContent);
  const setCurrentContent: (content: string) => void = useNoteStore(
    (s) => s.setCurrentContent,
  );

  // ── 主题（用于同步 Vditor theme 选项）───────────────────────
  const { resolved: isDark } = useTheme();

  // ── 防抖自动保存（内容变更后 1 秒自动保存到后端）───────────
  useAutoSave(currentId, currentContent);

  // ── Refs ────────────────────────────────────────────────────
  /** Vditor 实例引用 */
  const vditorRef = useRef<Vditor | null>(null);
  /** Vditor 挂载容器 */
  const containerRef = useRef<HTMLDivElement>(null);
  /**
   * 加载内容中标记：防止 setValue 触发的 input 回调
   * 将加载内容误判为用户编辑（虽然 Vditor 的 setValue
   * 通常不触发 input，但加守卫更安全）
   */
  const isLoadingRef = useRef<boolean>(false);
  /** 上一次渲染时的笔记 ID，用于检测笔记切换 */
  const prevNoteIdRef = useRef<string | null>(null);

  // ── 编辑器就绪状态（初始化完成前显示加载占位）───────────────
  const [editorReady, setEditorReady] = useState<boolean>(false);

  // ═══════════════════════════════════════════════════════════════
  // Effect 1：初始化 Vditor 实例（仅执行一次）
  // 关键：必须在浏览器完成布局后再初始化，否则容器高度为 0 会导致
  // Vditor 内部 CodeMirror/ProseMirror 无法计算编辑区尺寸
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const container: HTMLDivElement | null = containerRef.current;
    if (!container) {
      console.error("[VditorEditor] 容器元素不存在，无法初始化编辑器");
      return;
    }

    // 使用 requestAnimationFrame 确保浏览器已完成布局计算，
    // 容器具有实际的非零高度后再创建 Vditor 实例
    const rafId: number = requestAnimationFrame((): void => {
      try {
        const vditor = new Vditor(container, {
          // ── 模式与外观 ──────────────────────────────────────
          mode: "ir", // 即时渲染模式（类似 Typora）：所见即所得，无工具栏
          theme: isDark ? "dark" : "classic",
          placeholder: "记录此刻的想法…",
          // 使用 Vditor 官方 CDN 加载语言包、代码高亮样式等静态资源
          cdn: "https://cdn.jsdelivr.net/npm/vditor@3.11.2",
          // Vditor 内部缓存配置（禁用 localStorage 缓存，
          // 因为本项目使用 zustand + useAutoSave 自行管理持久化）
          cache: {
            enable: false,
            id: "grow-plan-editor",
          },
          // 高度自适应：填充父容器
          height: "100%",
          minHeight: 300,

          // 显式禁用工具栏（Vditor 默认会显示全部工具按钮）
          toolbar: [],

          // ── 初始内容 ────────────────────────────────────────
          value: currentContent,

          // ── 用户输入回调：Vditor 直接输出 Markdown 字符串 ────
          // 与 TipTap 不同，无需 getMarkdown() 序列化步骤，消除了往返失真风险
          input: (value: string): void => {
            if (isLoadingRef.current) {
              return;
            }
            setCurrentContent(value);
          },

          // ── 编辑完毕后回调：标记就绪状态 ────────────────────
          after: (): void => {
            // 仅在 after 回调中设置 ref，确保其他 effect 不会
            // 在 Vditor 内部状态（vditor.vditor）未就绪时调用其方法
            vditorRef.current = vditor;
            setEditorReady(true);
          },
        });
      } catch (err: unknown) {
        console.error("[VditorEditor] 初始化失败:", err);
        // 初始化抛出异常时也标记为"就绪"，避免用户卡在加载界面
        setEditorReady(true);
      }
    });

    // ── 清理：组件卸载时销毁 Vditor 实例 ─────────────────────
    return (): void => {
      cancelAnimationFrame(rafId);
      if (vditorRef.current) {
        try {
          vditorRef.current.destroy();
        } catch {
          // destroy 失败忽略（实例可能已处于无效状态）
        }
        vditorRef.current = null;
      }
    };
    // 仅在组件首次挂载时初始化一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // Effect 2：切换笔记时加载 Markdown 内容
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const vditor: Vditor | null = vditorRef.current;

    // 编辑器尚未就绪 / 无笔记选中 → 跳过
    if (!vditor || !editorReady || currentId === null) {
      return;
    }

    // 同一篇笔记（未发生切换）→ 跳过，避免重复加载
    if (prevNoteIdRef.current === currentId) {
      return;
    }

    // 记录新笔记 ID
    prevNoteIdRef.current = currentId;

    // 加载 Markdown 内容（setValue 不会触发 input，但用 isLoadingRef 做双保险）
    isLoadingRef.current = true;
    try {
      vditor.setValue(currentContent);
    } finally {
      // 使用微任务延迟重置，确保任何异步回调都在守卫期间执行
      Promise.resolve().then((): void => {
        isLoadingRef.current = false;
      });
    }
  }, [currentId, currentContent, editorReady]);

  // ═══════════════════════════════════════════════════════════════
  // Effect 3：主题切换时同步 Vditor 主题
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const vditor: Vditor | null = vditorRef.current;
    if (!vditor || !editorReady) {
      return;
    }
    vditor.setTheme(isDark ? "dark" : "classic");
  }, [isDark, editorReady]);

  // ═══════════════════════════════════════════════════════════════
  // Effect 4：同步可编辑状态
  // 未选中笔记时禁用编辑，防止空内容误操作
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const vditor: Vditor | null = vditorRef.current;
    if (!vditor || !editorReady) {
      return;
    }

    const shouldEdit: boolean = currentId !== null;
    if (shouldEdit) {
      vditor.enable();
    } else {
      vditor.disabled();
    }
  }, [currentId, editorReady]);

  // ── 渲染 Vditor 编辑器 ──────────────────────────────────────
  // 注意：容器 div（containerRef）必须始终渲染，否则 useEffect 中
  // containerRef.current 为 null → Vditor 无法初始化 → after 永不触发
  return (
    <div className="h-full flex flex-col">
      {/* 编辑器主体：Vditor 容器用 absolute 定位填充 flex-1 父元素，
          避免 h-full 依赖显式父高度导致的 0 高度问题 */}
      <div className="flex-1 relative">
        {/* Vditor 始终渲染此容器，确保初始化时 DOM 已存在 */}
        <div ref={containerRef} className="absolute inset-0" />

        {/* 加载覆盖层：Vditor 就绪后自动隐藏 */}
        {!editorReady && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
            <p className="text-sm text-neutral-400 dark:text-neutral-500 select-none">
              编辑器正在赶来中...
            </p>
          </div>
        )}
      </div>

      {/* 底部状态栏 */}
      <StatusBar />
    </div>
  );
}
