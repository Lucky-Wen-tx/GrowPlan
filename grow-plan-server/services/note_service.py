# 读写核心逻辑
from pathlib import Path
from config import NOTE_ROOT_PATH
from datetime import datetime

# 路径安全校验：防止路径穿越
def safe_note_path(title: str) -> Path:
    note_path = (NOTE_ROOT_PATH / f"{title}.md").resolve()
    if NOTE_ROOT_PATH.resolve() not in note_path.parents:
        raise PermissionError("非法的笔记标题")
    return note_path

# 获取所有正常笔记列表
def get_note_list():
    notes = []
    for file in NOTE_ROOT_PATH.glob("*.md"):
        stat = file.stat()
        notes.append({
            "title": file.stem,
            "create_time": datetime.fromtimestamp(stat.st_birthtime).isoformat(),
            "update_time": datetime.fromtimestamp(stat.st_mtime).isoformat()
        })
    # 按修改时间倒序
    return sorted(notes, key=lambda x: x["update_time"], reverse=True)

# 获取单篇笔记内容
def get_note_content(title: str) -> str:
    note_path = safe_note_path(title)
    if not note_path.exists():
        raise FileNotFoundError("笔记不存在")
    return note_path.read_text(encoding="utf-8")

# 新建空白笔记
def create_note(title: str):
    note_path = safe_note_path(title)
    if note_path.exists():
        raise ValueError("同名笔记已存在")
    note_path.write_text("", encoding="utf-8")
    return {"title": title}

# 更新（保存）笔记内容
def update_note(title: str, content: str):
    note_path = safe_note_path(title)
    if not note_path.exists():
        raise FileNotFoundError("笔记不存在")
    note_path.write_text(content, encoding="utf-8")
    return {"status": "success", "update_time": datetime.now().isoformat()}