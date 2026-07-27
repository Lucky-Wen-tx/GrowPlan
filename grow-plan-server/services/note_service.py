"""
笔记核心业务逻辑
- 笔记的列表、读取、新建、更新操作
- 删除到回收站、从回收站恢复、永久删除
- Markdown 文件导入、图片上传
- 路径安全校验：所有文件操作限制在笔记根目录内，防止路径穿越攻击
- 文件名校验：自动过滤 Windows 非法字符
"""
import os
import re
import shutil
import uuid
from datetime import datetime
from typing import Optional

from config import NOTES_ROOT, RECYCLE_DIR, ASSETS_DIR
from schemas import NoteCreate, NoteUpdate, NoteSummary, NoteDetail

# ── 常量 ──────────────────────────────────────────────────
# Windows 文件名非法字符正则
_WINDOWS_ILLEGAL_RE = re.compile(r'[<>:"/\\|?*]')

# 允许上传的图片 MIME 类型
_ALLOWED_IMAGE_TYPES = {
    "image/jpeg", "image/png", "image/gif",
    "image/webp", "image/bmp", "image/svg+xml",
}
# 允许上传的图片扩展名
_ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".svg"}


# ═══════════════════════════════════════════════════════════
# 内部工具函数
# ═══════════════════════════════════════════════════════════

def _sanitize_filename(name: str) -> str:
    """
    过滤文件名中的非法字符，生成安全、URL 友好的文件名：
    1. Windows 非法字符（< > : " / \\ | ? *）→ 替换为下划线
    2. 空白字符（空格、Tab 等）→ 替换为连字符
    3. 去除首尾的 . （防止创建隐藏文件）和空白
    """
    cleaned = _WINDOWS_ILLEGAL_RE.sub("_", name).strip()
    # 将空白字符（空格、Tab 等）替换为连字符，使 URL 更干净
    cleaned = re.sub(r'\s+', '-', cleaned)
    # 去除首尾的 .（防止创建隐藏文件）
    cleaned = cleaned.strip(".")
    return cleaned


def _resolve_safe_path(base_dir: str, filename: str) -> str:
    """
    路径安全校验核心函数。
    拼接 base_dir 与 filename，规范化路径后校验：
    - 结果路径必须在 base_dir 子树内（防止 ../ 路径穿越）
    - 返回规范化后的绝对路径

    注意：此函数不对文件名做 sanitize（如空格→连字符），
    因为读取/更新/删除操作的 note_id 来自文件系统自身的列表，
    已是实际文件名。sanitize 仅在创建笔记时调用。

    Raises:
        PermissionError: 当路径试图逃逸出允许的目录范围时
    """
    # 拼接并规范化路径
    raw_path = os.path.join(base_dir, filename)
    resolved = os.path.realpath(os.path.normpath(raw_path))

    # 确保 resolved 是 base_dir 的子路径（或就是 base_dir 本身）
    base_resolved = os.path.realpath(base_dir)
    if not (resolved == base_resolved or resolved.startswith(base_resolved + os.sep)):
        raise PermissionError(
            f"路径访问被拒绝：'{filename}' 超出了允许的目录范围"
        )

    return resolved


def _find_in_recycle(note_id: str) -> str:
    """
    在回收站中查找笔记文件。
    先精确匹配 note_id.md，若不存在则模糊匹配以 note_id 开头的文件
    （处理带时间戳后缀的回收文件，如 "foo_20260727120000.md"）。

    Returns:
        回收站中匹配文件的绝对路径

    Raises:
        FileNotFoundError: 回收站中未找到匹配的笔记
    """
    # 路径安全检查（防止 ../ 穿越），不对文件名做 sanitize
    exact_path = _resolve_safe_path(RECYCLE_DIR, f"{note_id}.md")

    if os.path.isfile(exact_path):
        return exact_path

    # 模糊匹配：处理带时间戳后缀的回收文件
    if os.path.isdir(RECYCLE_DIR):
        for entry in os.listdir(RECYCLE_DIR):
            if entry.startswith(note_id) and entry.endswith(".md"):
                file_path = _resolve_safe_path(RECYCLE_DIR, entry)
                if os.path.isfile(file_path):
                    return file_path

    raise FileNotFoundError(f"回收站中未找到笔记: {note_id}")


def _read_file_metadata(file_path: str) -> dict[str, datetime]:
    """读取文件的创建时间和最后修改时间"""
    stat = os.stat(file_path)
    return {
        "created_at": datetime.fromtimestamp(stat.st_ctime),
        "updated_at": datetime.fromtimestamp(stat.st_mtime),
    }


def _extract_title(file_path: str, fallback: str) -> str:
    """
    从 .md 文件内容中提取第一个一级标题（# 开头）作为显示标题。
    若文件中没有一级标题，则使用 fallback（通常为文件名）。
    """
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                stripped = line.strip()
                # 匹配 "# Title" 但不匹配 "## SubTitle"
                if stripped.startswith("# ") and not stripped.startswith("## "):
                    return stripped[2:].strip()
    except (OSError, UnicodeDecodeError):
        pass
    return fallback


def _update_first_heading(content: str, new_title: str) -> str:
    """
    将 Markdown 内容中的第一个一级标题替换为新的标题文本。
    如果没有一级标题，则在开头插入一个。
    """
    lines = content.split("\n")
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("# ") and not stripped.startswith("## "):
            # 保留原有缩进
            indent = line[: len(line) - len(line.lstrip())]
            lines[i] = f"{indent}# {new_title}"
            return "\n".join(lines)

    # 内容中没有一级标题 → 在开头插入
    return f"# {new_title}\n\n{content}"


def _build_note_detail(note_id: str, file_path: str, content: str) -> NoteDetail:
    """构建 NoteDetail 响应的辅助函数"""
    meta = _read_file_metadata(file_path)
    title = _extract_title(file_path, note_id)
    return NoteDetail(
        id=note_id,
        title=title,
        content=content,
        **meta,
    )


def _build_note_summary(file_path: str) -> NoteSummary:
    """构建 NoteSummary 响应的辅助函数"""
    note_id = os.path.splitext(os.path.basename(file_path))[0]
    meta = _read_file_metadata(file_path)
    title = _extract_title(file_path, note_id)
    return NoteSummary(id=note_id, title=title, **meta)


# ═══════════════════════════════════════════════════════════
# 笔记 CRUD
# ═══════════════════════════════════════════════════════════

def list_notes() -> list[NoteSummary]:
    """
    获取笔记根目录下所有 .md 文件的摘要列表。
    排除隐藏文件（.开头）和子目录。
    结果按最后修改时间倒序排列。
    """
    notes: list[NoteSummary] = []

    if not os.path.isdir(NOTES_ROOT):
        return notes

    for entry in sorted(os.listdir(NOTES_ROOT)):
        # 只处理 .md 文件，跳过隐藏文件和子目录
        if not entry.endswith(".md") or entry.startswith("."):
            continue
        file_path = os.path.join(NOTES_ROOT, entry)
        if not os.path.isfile(file_path):
            continue
        notes.append(_build_note_summary(file_path))

    # 按修改时间倒序（最新的在前）
    notes.sort(key=lambda n: n.updated_at, reverse=True)
    return notes


def get_note(note_id: str) -> NoteDetail:
    """获取单篇笔记的完整内容（含正文）"""
    file_path = _resolve_safe_path(NOTES_ROOT, f"{note_id}.md")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"笔记不存在: {note_id}")

    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    return _build_note_detail(note_id, file_path, content)


def create_note(data: NoteCreate) -> NoteDetail:
    """
    创建新笔记：
    1. 使用安全化后的标题作为 .md 文件名
    2. 若文件已存在，追加 8 位随机后缀避免覆盖
    3. 初始内容为 "# 标题\n\n"
    """
    safe_title = _sanitize_filename(data.title)
    file_path = _resolve_safe_path(NOTES_ROOT, f"{safe_title}.md")

    # 若文件已存在，追加随机后缀避免冲突
    if os.path.exists(file_path):
        suffix = uuid.uuid4().hex[:8]
        safe_title = f"{safe_title}_{suffix}"
        file_path = _resolve_safe_path(NOTES_ROOT, f"{safe_title}.md")

    # 写入初始内容：以用户输入的标题作为一级标题
    initial_content = f"# {data.title}\n\n"
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(initial_content)

    return _build_note_detail(safe_title, file_path, initial_content)


def update_note(note_id: str, data: NoteUpdate) -> NoteDetail:
    """
    更新笔记：
    - 若仅修改内容：直接覆写文件
    - 若修改了标题：同步更新文件内一级标题 + 重命名文件
    """
    old_path = _resolve_safe_path(NOTES_ROOT, f"{note_id}.md")

    if not os.path.isfile(old_path):
        raise FileNotFoundError(f"笔记不存在: {note_id}")

    # 读取当前内容
    with open(old_path, "r", encoding="utf-8") as f:
        current_content = f.read()

    new_id = note_id
    new_content = data.content if data.content is not None else current_content

    if data.title is not None and data.title != note_id:
        # 标题变更 → 同步更新内容中的一级标题 + 重命名文件
        new_id = _sanitize_filename(data.title)
        new_content = _update_first_heading(new_content, data.title)

        new_path = _resolve_safe_path(NOTES_ROOT, f"{new_id}.md")

        # 若新路径已被占用（且不是原文件），追加后缀
        if new_path != old_path and os.path.exists(new_path):
            suffix = uuid.uuid4().hex[:8]
            new_id = f"{new_id}_{suffix}"
            new_path = _resolve_safe_path(NOTES_ROOT, f"{new_id}.md")

        # 写入新文件，删除旧文件
        with open(new_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        os.remove(old_path)
        file_path = new_path
    else:
        # 仅内容变更 → 直接覆写
        with open(old_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        file_path = old_path

    return _build_note_detail(new_id, file_path, new_content)


# ═══════════════════════════════════════════════════════════
# 回收站操作
# ═══════════════════════════════════════════════════════════

def delete_note(note_id: str) -> None:
    """
    软删除：将笔记文件移入 notes/.recycle/ 目录。
    若回收站中已有同名文件，自动追加时间戳后缀防止覆盖。
    """
    file_path = _resolve_safe_path(NOTES_ROOT, f"{note_id}.md")

    if not os.path.isfile(file_path):
        raise FileNotFoundError(f"笔记不存在: {note_id}")

    # 确保回收站目录存在
    os.makedirs(RECYCLE_DIR, exist_ok=True)

    dest = os.path.join(RECYCLE_DIR, os.path.basename(file_path))

    # 回收站中已有同名文件 → 加时间戳
    if os.path.exists(dest):
        name, ext = os.path.splitext(os.path.basename(file_path))
        ts = datetime.now().strftime("%Y%m%d%H%M%S")
        dest = os.path.join(RECYCLE_DIR, f"{name}_{ts}{ext}")

    shutil.move(file_path, dest)


def list_recycle() -> list[NoteSummary]:
    """列出回收站中的所有笔记文件"""
    notes: list[NoteSummary] = []

    if not os.path.isdir(RECYCLE_DIR):
        return notes

    for entry in sorted(os.listdir(RECYCLE_DIR)):
        if not entry.endswith(".md") or entry.startswith("."):
            continue
        file_path = os.path.join(RECYCLE_DIR, entry)
        if not os.path.isfile(file_path):
            continue
        notes.append(_build_note_summary(file_path))

    notes.sort(key=lambda n: n.updated_at, reverse=True)
    return notes


def restore_note(note_id: str) -> NoteDetail:
    """
    从回收站恢复笔记：
    1. 在回收站中查找匹配的文件（支持精确/模糊匹配）
    2. 移回笔记根目录，尽量恢复原始文件名
    """
    file_path = _find_in_recycle(note_id)

    # 目标文件名：优先使用原始 note_id
    dest_name = f"{_sanitize_filename(note_id)}.md"
    dest = os.path.join(NOTES_ROOT, dest_name)
    dest = _resolve_safe_path(NOTES_ROOT, dest_name)

    # 原位置已有文件 → 追加随机后缀
    if os.path.exists(dest):
        suffix = uuid.uuid4().hex[:8]
        dest_name = f"{_sanitize_filename(note_id)}_{suffix}.md"
        dest = _resolve_safe_path(NOTES_ROOT, dest_name)

    shutil.move(file_path, dest)

    # 读取恢复后的笔记并返回
    new_id = os.path.splitext(os.path.basename(dest))[0]
    with open(dest, "r", encoding="utf-8") as f:
        content = f.read()
    return _build_note_detail(new_id, dest, content)


def permanent_delete(note_id: str) -> None:
    """
    从回收站中永久删除笔记文件。
    支持精确匹配和模糊匹配（处理带时间戳的文件名）。
    """
    file_path = _find_in_recycle(note_id)
    os.remove(file_path)


# ═══════════════════════════════════════════════════════════
# 文件导入 / 上传
# ═══════════════════════════════════════════════════════════

def import_markdown(file_content: bytes, original_filename: str) -> NoteDetail:
    """
    导入外部 .md 文件为笔记：
    1. 以原始文件名（去掉 .md 后缀）作为笔记 ID
    2. 解码文件内容（优先 UTF-8，失败则尝试 GBK）
    3. 写入笔记根目录
    """
    # 从文件名提取基础名称
    base_name = os.path.splitext(original_filename)[0]
    safe_name = _sanitize_filename(base_name)

    # 若清理后为空，生成一个随机名
    if not safe_name:
        safe_name = f"imported_{uuid.uuid4().hex[:8]}"

    file_path = _resolve_safe_path(NOTES_ROOT, f"{safe_name}.md")

    # 避免覆盖已存在的笔记
    if os.path.exists(file_path):
        suffix = uuid.uuid4().hex[:8]
        safe_name = f"{safe_name}_{suffix}"
        file_path = _resolve_safe_path(NOTES_ROOT, f"{safe_name}.md")

    # 解码内容（尝试 UTF-8，失败回退 GBK）
    try:
        content = file_content.decode("utf-8")
    except UnicodeDecodeError:
        content = file_content.decode("gbk", errors="replace")

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    return _build_note_detail(safe_name, file_path, content)


def upload_image(file_content: bytes, original_filename: str) -> dict[str, str]:
    """
    上传图片到 assets/ 目录：
    1. 校验文件扩展名是否为允许的图片类型
    2. 使用 UUID 重命名防止冲突
    3. 返回可访问的相对路径

    Raises:
        ValueError: 文件类型不允许
    """
    # 校验扩展名
    _, ext = os.path.splitext(original_filename)
    ext_lower = ext.lower()
    if ext_lower not in _ALLOWED_IMAGE_EXTS:
        raise ValueError(
            f"不支持的图片格式：{ext}。"
            f"允许的格式：{', '.join(_ALLOWED_IMAGE_EXTS)}"
        )

    # 使用 UUID 生成唯一文件名，保留原始扩展名
    unique_name = f"{uuid.uuid4().hex}{ext_lower}"
    file_path = _resolve_safe_path(ASSETS_DIR, unique_name)

    # 确保 assets 目录存在
    os.makedirs(ASSETS_DIR, exist_ok=True)

    with open(file_path, "wb") as f:
        f.write(file_content)

    # 返回相对路径（供前端访问）
    return {
        "filename": unique_name,
        "original_name": original_filename,
        "path": f"/assets/{unique_name}",
        "url": f"/api/assets/{unique_name}",
    }
