/**
 * TipTap 类型扩展声明
 *
 * 补充 tiptap-markdown 扩展在 @tiptap/core 中未声明的方法和属性：
 * - editor.storage.markdown.getMarkdown()     → Markdown 导出
 * - editor.commands.setContent(_, parseOptions) → Markdown 导入解析
 */

// ═══════════════════════════════════════════════════════════════
// Storage 扩展：editor.storage.markdown
// ═══════════════════════════════════════════════════════════════
declare module "@tiptap/core" {
  interface Storage {
    /** tiptap-markdown 扩展注入的存储，提供 Markdown 导出能力 */
    markdown: MarkdownStorage;
  }
}

/** editor.storage.markdown 接口 */
interface MarkdownStorage {
  /** 将当前编辑器文档内容导出为 Markdown 字符串 */
  getMarkdown: () => string;
}

// ═══════════════════════════════════════════════════════════════
// RawCommands 扩展：setContent 的 parseOptions 重载
// ═══════════════════════════════════════════════════════════════
/**
 * TipTap 的 ChainedCommands / SingleCommands 均由 RawCommands
 * 通过映射类型生成。为 setContent 追加 parseOptions 重载后，
 * 该参数会传播到 editor.commands 和 editor.chain() 的类型中。
 */
declare module "@tiptap/core" {
  interface RawCommands {
    /**
     * 以 Markdown 格式解析内容并加载到编辑器
     * （与原有 setContent(content, emitUpdate?) 构成重载）
     */
    setContent: (
      /** 要加载的 Markdown 字符串 */
      content: string,
      /** 解析选项 */
      options: {
        /** 指定内容格式为 markdown */
        parseOptions: { format: "markdown" };
      },
    ) => boolean;
  }
}
