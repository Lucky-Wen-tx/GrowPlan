# 数据模型定义
from pydantic import BaseModel, field_validator
import re

class NoteCreate(BaseModel):
    title: str

    @field_validator("title")
    def validate_title(cls, v):
        # 过滤Windows系统非法文件名字符
        illegal_chars = r'[\\/:*?"<>|]'
        cleaned = re.sub(illegal_chars, "", v).strip()
        if not cleaned:
            raise ValueError("笔记标题不能为空")
        return cleaned

class NoteUpdate(BaseModel):
    content: str