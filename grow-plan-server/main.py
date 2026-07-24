# 项目入口，路由注册、跨域、静态资源托管
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from config import init_dirs, SERVER_HOST, SERVER_PORT
from schemas import NoteCreate, NoteUpdate
from services import note_service

# 初始化目录
init_dirs()

app = FastAPI(title="拾光Plan API")

# 开发阶段跨域配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== 笔记核心接口 ====================
# 获取笔记列表
@app.get("/api/notes")
def get_notes():
    return note_service.get_note_list()

# 获取单篇笔记内容
@app.get("/api/notes/{title}")
def get_note(title: str):
    try:
        content = note_service.get_note_content(title)
        return {"title": title, "content": content}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="笔记不存在")
    except PermissionError:
        raise HTTPException(status_code=400, detail="非法请求")

# 新建笔记
@app.post("/api/notes")
def create_note(note: NoteCreate):
    try:
        return note_service.create_note(note.title)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except PermissionError:
        raise HTTPException(status_code=400, detail="非法请求")

# 更新笔记内容
@app.put("/api/notes/{title}")
def update_note(title: str, note: NoteUpdate):
    try:
        return note_service.update_note(title, note.content)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="笔记不存在")
    except PermissionError:
        raise HTTPException(status_code=400, detail="非法请求")

# ==================== 生产环境静态资源托管（阶段4启用） ====================
# static_dir = Path(__file__).parent / "static"
# if static_dir.exists():
#     app.mount("/static", StaticFiles(directory=static_dir), name="static")
#
#     @app.get("/{full_path:path}")
#     async def spa_redirect(full_path: str):
#         if full_path.startswith("api/"):
#             raise HTTPException(status_code=404)
#         return StaticFiles(directory=static_dir, html=True)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=SERVER_HOST, port=SERVER_PORT, reload=True)