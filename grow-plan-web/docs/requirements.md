# 拾光Plan 前端 MVP 需求规范
## 技术栈
- Next.js 14 App Router + TypeScript + Tailwind CSS
- 编辑器：TipTap v2.27.2 + tiptap-markdown@0.8.10 + lowlight@2.9.0
- 状态管理：zustand
- 图标：lucide-react
- 必须通过 ESLint（next/core-web-vitals）和 TypeScript 严格类型检查

## 核心功能
1. 三栏布局：顶部导航 + 左侧笔记列表 + 中间编辑区
2. 所见即所得 Markdown 编辑，支持快捷语法触发
3. 防抖自动保存（编辑停止1秒后保存）
4. 笔记列表、搜索、新建、切换
5. 浅色/深色双主题切换，跟随系统
6. 底部字数统计栏

## 强制约束
- 所有 TipTap 相关包版本锁定 2.27.2，不得升级 v3
- tiptap-markdown 使用 0.8.10 版本，命名导入 { Markdown }
- lowlight 使用 2.9.0 版本，使用 { common, createLowlight } 导入
- 禁用 any 类型，第三方扩展类型通过 declare module 扩展声明
- 组件默认用函数组件，配合 hooks