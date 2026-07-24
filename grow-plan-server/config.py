# 全局配置
import os
from pathlib import Path

# 笔记根目录（可自定义路径，默认在项目同级创建notes文件夹）
BASE_DIR = Path(__file__).resolve().parent
NOTE_ROOT_PATH = BASE_DIR.parent / "GrowPlan-Notes"
ASSETS_DIR_NAME = "assets"
RECYCLE_DIR_NAME = ".recycle"

# 服务配置
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8000

# 初始化目录
def init_dirs():
    NOTE_ROOT_PATH.mkdir(exist_ok=True)
    (NOTE_ROOT_PATH / ASSETS_DIR_NAME).mkdir(exist_ok=True)
    (NOTE_ROOT_PATH / RECYCLE_DIR_NAME).mkdir(exist_ok=True)