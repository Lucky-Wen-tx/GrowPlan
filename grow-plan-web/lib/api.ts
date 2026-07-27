/**
 * 笔记后端 API 封装
 * 所有请求统一经过 request() 处理：
 * - 成功时返回 JSON 解析结果
 * - 失败时抛出 Error，message 包含后端返回的 detail 字段
 */
import type { NoteItem, NoteDetail, NoteUpdateResult } from "@/types/note";

// ── 常量 ──────────────────────────────────────────────────────
/** 后端 API 基地址 */
const BASE_URL = "http://localhost:8000/api";

// ═══════════════════════════════════════════════════════════════
// 内部请求封装
// ═══════════════════════════════════════════════════════════════

/**
 * 统一请求处理：
 * 1. 发起 fetch 请求
 * 2. 非 2xx 响应 → 尝试读取后端返回的 detail 字段并抛出 Error
 * 3. 2xx 响应 → 解析 JSON 并返回
 *
 * @throws {Error} 请求失败或后端返回错误时，message 包含 detail 信息
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response: Response = await fetch(url, options);

  if (!response.ok) {
    // 尝试从响应体中提取 FastAPI 的 detail 字段
    let detail: string;
    try {
      const errorBody: Record<string, unknown> = await response.json();
      detail =
        typeof errorBody.detail === "string"
          ? errorBody.detail
          : `请求失败 (HTTP ${response.status})`;
    } catch {
      // 响应体不是合法 JSON（如服务器完全不可达、返回 HTML 等）
      detail = `请求失败 (HTTP ${response.status}: ${response.statusText})`;
    }
    throw new Error(detail);
  }

  return response.json() as Promise<T>;
}

// ═══════════════════════════════════════════════════════════════
// 笔记 CRUD 接口
// ═══════════════════════════════════════════════════════════════

/**
 * 获取所有笔记的摘要列表（按修改时间倒序）
 * GET /api/notes
 */
export async function getList(): Promise<NoteItem[]> {
  return request<NoteItem[]>(`${BASE_URL}/notes`);
}

/**
 * 获取单篇笔记的完整内容
 * GET /api/notes/{noteId}
 *
 * @param noteId - 笔记唯一标识
 */
export async function getDetail(noteId: string): Promise<NoteDetail> {
  return request<NoteDetail>(`${BASE_URL}/notes/${encodeURIComponent(noteId)}`);
}

/**
 * 创建一篇新笔记
 * POST /api/notes
 *
 * @param title - 笔记标题（将作为 .md 文件名）
 */
export async function create(title: string): Promise<NoteDetail> {
  return request<NoteDetail>(`${BASE_URL}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
}

/**
 * 更新笔记（可单独修改内容，或同时修改标题和内容）
 * PUT /api/notes/{noteId}
 *
 * @param noteId - 笔记唯一标识
 * @param data   - 要更新的字段（title / content 至少传一个）
 */
export async function update(
  noteId: string,
  data: { title?: string; content?: string },
): Promise<NoteUpdateResult> {
  return request<NoteUpdateResult>(
    `${BASE_URL}/notes/${encodeURIComponent(noteId)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
}
