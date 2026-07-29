/**
 * Typora 风格标记符扩展
 *
 * 当光标移入加粗/斜体/删除线/行内代码范围时，自动将 TipTap 内部标记
 * 转换为真实可编辑的 markdown 标记符文字（**、*、~~、`），光标移出后
 * 自动转换回富文本标记。标记符是实际的文档文本，可选中、可编辑、可删除。
 *
 * 原理：通过 ProseMirror appendTransaction 在每次选区变化后检测光标是否
 * 进入/离开某个 mark 范围，动态执行 mark ↔ 文本的文档变换。
 */
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import type { Transaction } from "@tiptap/pm/state";
import type { Mark } from "@tiptap/pm/model";

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/** 处于"源码模式"的区间记录 */
interface SourceRange {
  from: number;
  innerFrom: number;
  innerTo: number;
  to: number;
  markType: string;
}

/** 标记符映射：mark 类型 → [首部标记符, 尾部标记符] */
const MARKERS: Record<string, [string, string]> = {
  bold: ["**", "**"],
  italic: ["*", "*"],
  strike: ["~~", "~~"],
  code: ["`", "`"],
};

/** 事务 meta key，用于标记本插件发起的事务，防止递归 */
const META_KEY = "typoraMarks$";

/**
 * 模块级源码区间存储（不依赖 ProseMirror 插件状态，避免生命周期问题）
 * key = range.from（转换时的原始起始位置）
 */
const _sourceRanges: Map<number, SourceRange> = new Map();

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

function getMarkAtCursor(
  state: any,
  cursorPos: number,
): { mark: Mark; from: number; to: number } | null {
  const { doc, selection } = state;
  if (!selection.empty) return null;

  const $pos = doc.resolve(cursorPos);
  const marks = $pos.marks();

  for (const mark of marks) {
    const marker = MARKERS[mark.type.name];
    if (!marker) continue;

    const parent = $pos.parent;
    if (!parent?.isBlock) return null;

    const parentStart = $pos.start();

    // 遍历父节点下所有文本子节点，找到连续的同 mark 片段
    interface TextRun {
      pos: number;
      size: number;
      hasMark: boolean;
    }
    const runs: TextRun[] = [];
    parent.forEach((child, offset) => {
      if (child.isText) {
        runs.push({
          pos: parentStart + offset,
          size: child.nodeSize,
          hasMark: child.marks.some(
            (m: Mark) => m.type.name === mark.type.name && m.eq(mark),
          ),
        });
      }
    });
    if (runs.length === 0) continue;

    // 定位光标所在的文本运行
    let cursorIdx = -1;
    for (let i = 0; i < runs.length; i++) {
      if (cursorPos >= runs[i].pos && cursorPos < runs[i].pos + runs[i].size) {
        cursorIdx = i;
        break;
      }
    }
    if (cursorIdx === -1 || !runs[cursorIdx].hasMark) continue;

    // 向前扩展
    let firstIdx = cursorIdx;
    while (firstIdx > 0 && runs[firstIdx - 1].hasMark) firstIdx--;

    // 向后扩展
    let lastIdx = cursorIdx;
    while (lastIdx < runs.length - 1 && runs[lastIdx + 1].hasMark) lastIdx++;

    const from = runs[firstIdx].pos;
    const to = runs[lastIdx].pos + runs[lastIdx].size;

    if (from < to) return { mark, from, to };
  }

  return null;
}

function convertToSource(
  state: any,
  from: number,
  to: number,
  markType: string,
): Transaction | null {
  const marker = MARKERS[markType];
  if (!marker) return null;

  const tr = state.tr;

  const resolvedPos = state.doc.resolve(from);
  const mark = resolvedPos.marks().find((m: Mark) => m.type.name === markType);
  if (!mark) return null;

  // 移除 mark
  tr.removeMark(from, to, mark);

  // 插入首部标记符
  const openMarker = marker[0];
  tr.insertText(openMarker, from);

  // 插入尾部标记符
  const closePos = to + openMarker.length;
  const closeMarker = marker[1];
  tr.insertText(closeMarker, closePos);

  // 记录区间
  const range: SourceRange = {
    from,
    innerFrom: from + openMarker.length,
    innerTo: closePos,
    to: closePos + closeMarker.length,
    markType,
  };
  _sourceRanges.set(range.from, range);

  tr.setMeta(META_KEY, { action: "convert", range });
  return tr;
}

function restoreFromSource(
  state: any,
  range: SourceRange,
): Transaction | null {
  const marker = MARKERS[range.markType];
  if (!marker) return null;

  const { doc } = state;
  const docSize = doc.content.size;

  // 位置合法性校验
  if (
    range.from < 0 ||
    range.innerTo > docSize ||
    range.from >= range.innerFrom ||
    range.innerFrom >= range.innerTo ||
    range.innerTo >= range.to
  ) {
    console.warn("[Typora] 区间数据无效，放弃恢复", range, "docSize:", docSize);
    _sourceRanges.clear();
    return null;
  }

  const closeLen = marker[1].length;
  const openLen = marker[0].length;

  // 标记符文本匹配验证
  const closeText = doc.textBetween(range.innerTo, range.innerTo + closeLen);
  const openText = doc.textBetween(range.from, range.from + openLen);
  if (closeText !== marker[1] || openText !== marker[0]) {
    console.warn(
      `[Typora] 标记符不匹配 (期望 "${marker[0]}...${marker[1]}", 实际 "${openText}...${closeText}")，放弃恢复`,
    );
    _sourceRanges.clear();
    return null;
  }

  const tr = state.tr;

  // 先删尾部，再删首部
  tr.delete(range.innerTo, range.innerTo + closeLen);
  tr.delete(range.from, range.from + openLen);

  // 应用 mark
  const innerFrom = range.from;
  const innerTo = range.from + (range.innerTo - range.innerFrom);
  const markType = state.schema.marks[range.markType];
  if (markType) {
    tr.addMark(innerFrom, innerTo, markType.create());
  }

  // 清除记录
  _sourceRanges.clear();
  tr.setMeta(META_KEY, { action: "restore", rangeKey: range.from });
  return tr;
}

// ═══════════════════════════════════════════════════════════════
// 扩展定义
// ═══════════════════════════════════════════════════════════════

export const TyporaMarkExtension = Extension.create({
  name: "typoraMarks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("typoraMarks"),

        // 简单状态：仅用于让 ProseMirror 不报错
        state: {
          init() {
            return {};
          },
          apply(tr, value) {
            // 当外部事务修改文档时，映射模块级存储中已记录的区间位置
            if (
              tr.docChanged &&
              !tr.getMeta(META_KEY) &&
              _sourceRanges.size > 0
            ) {
              const newRanges = new Map<number, SourceRange>();
              for (const range of _sourceRanges.values()) {
                const mapped: SourceRange = {
                  from: tr.mapping.map(range.from),
                  innerFrom: tr.mapping.map(range.innerFrom),
                  innerTo: tr.mapping.map(range.innerTo),
                  to: tr.mapping.map(range.to),
                  markType: range.markType,
                };
                newRanges.set(mapped.from, mapped);
              }
              _sourceRanges.clear();
              for (const r of newRanges.values()) _sourceRanges.set(r.from, r);
              // 文档被外部事务修改，区间位置已自动映射
            }
            return value;
          },
        },

        // ── 选区变化时触发转换 ────────────────────────
        appendTransaction(transactions, oldState, newState): Transaction | null {
          // 本插件发起的事务——只跳过恢复逻辑，convert 仍需检查
          const hasOurMeta = transactions.some(
            (tr) => tr.getMeta(META_KEY) !== undefined,
          );

          if (oldState.selection.eq(newState.selection)) {
            return null;
          }

          const { selection } = newState;

          // 情况 A：光标离开源码区间 → 恢复为 mark
          // （仅处理非本插件发起的事务，防止恢复后自己再触发恢复）
          if (!hasOurMeta && _sourceRanges.size > 0 && selection.empty) {
            for (const range of _sourceRanges.values()) {
              if (selection.from >= range.innerFrom && selection.to <= range.innerTo) {
                continue;
              }
              if (selection.to < range.from || selection.from > range.to) {
                return restoreFromSource(newState, range);
              }
              // 光标在标记符上，保持源码模式让用户编辑
            }
          }

          // 情况 B：光标进入 mark → 转换为源码（无论谁发起的事务都检查）
          if (selection.empty) {
            const result = getMarkAtCursor(newState, selection.from);
            if (result) {
              const alreadySource = Array.from(_sourceRanges.values()).some(
                (r) =>
                  r.markType === result.mark.type.name &&
                  r.from <= result.from &&
                  r.to >= result.to,
              );
              if (!alreadySource) {
                return convertToSource(
                  newState,
                  result.from,
                  result.to,
                  result.mark.type.name,
                );
              }
            }
          }

          return null;
        },
      }),
    ];
  },
});
