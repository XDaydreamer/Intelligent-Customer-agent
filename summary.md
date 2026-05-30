# 智能客服管理系统 — 项目摘要

## 项目概述
基于 **LangGraph** 框架的电商智能客服系统，支持多轮对话客服、知识库管理、文案生成系统（多Agent协作）、知能对话、聊天记录、客服模版、转人工设置和商店配置。

## 技术栈

### 后端
- **Web 框架**: FastAPI
- **ORM**: SQLAlchemy (async) + asyncpg
- **向量数据库**: ChromaDB (PersistentClient)
- **Agent 框架**: LangGraph (StateGraph 多Agent协作)
- **LLM**: 阿里云百炼 DashScope (千问系列) via langchain-openai
- **数据校验**: Pydantic + pydantic-settings
- **文件解析**: python-docx, openpyxl, pandas, aiofiles

### 前端
- **框架**: React 18 + TypeScript + Vite
- **CSS**: Tailwind CSS (暗金主题 #B8860B)
- **图标**: lucide-react

### 基础设施
- **关系数据库**: PostgreSQL (10 张表)
- **向量数据库**: ChromaDB (Persistent)
- **LLM 平台**: 阿里云百炼 (DashScope)

## 系统架构
三层架构：
1. 前端 (React) — 端口 3000
2. 后端 (FastAPI) — 端口 8000 (Vite proxy)
3. 数据层 — PostgreSQL + ChromaDB

## 核心功能模块 (7大模块)
1. **智能对话** — 多轮对话客服，带 RAG 和会话记忆
2. **知识库管理** — 创建/管理知识库，上传文档，自动分块向量化（子标签：新建知识库、知能对话）
3. **文案生成系统** — 交互式 LangGraph 多Agent协作（Manager→Analyzer→Generator），智能追问+产品分析+合规文案生成+预览编辑+下载/入库
4. **聊天记录** — 历史会话查看、AI回复编辑、选择性保存为预设对话
5. **客服模版** — 客服回复模板管理
6. **商店配置** — 预留模块
7. **转人工设置** — 关键词触发规则，支持人工转接

## 后端详解
- **FastAPI 入口**: lifespan 上下文管理器，启动时建表+启动清理任务
- **配置系统**: pydantic-settings BaseSettings 从 .env 读取
- **服务层**: KnowledgeService (RAG摄入)、MemoryService (记忆管理)、DialogService (预设匹配)、TemplateService (模版)、CopywritingService (文案会话+规则管理)
- **Agent 层**: ChatAgent (RAG对话)、CopywritingWorkflowAgent (Manager→Analyzer→Generator三Agent协作)
- **LLM 工厂**: ChatOpenAI + base_url 指向 DashScope 兼容端点

## 数据库设计 (PostgreSQL 10 张表)
1. `knowledge_bases` — 知识库
2. `knowledge_documents` — 知识库文档
3. `templates` — 客服模版
4. `preset_dialogs` — 预设问答（树形结构）
5. `transfer_rules` — 转人工规则
6. `conversations` — 对话会话
7. `messages` — 对话消息
8. `copywriting_sessions` — 文案生成会话（含JSONB状态持久化）
9. `copywriting_messages` — 文案生成消息记录
10. `compliance_rules` — 合规规则（支持手动输入+文件上传）

## 记忆系统
- **会话生命周期**: 首次消息→创建会话自动编号"客户N" → 每次对话更新计数和时间 → 超过40条消息触发 LLM 压缩 → 每10分钟清理10天前的过期会话
- **压缩算法**: 未压缩 > 40 条 → 取最旧 N-20 条 → LLM(temp=0.1) 生成 ≤200字摘要 → 标记 is_summarized
- **上下文注入**: [System Prompt] → [对话摘要] → [最近消息] → [当前用户消息]

## RAG 工程
- **摄入管道**: 上传文件 → 解析(txt/md/json/docx/csv/xlsx) → 500字符+50重叠分块 → ChromaDB向量化 → PostgreSQL记录
- **检索流程**: 用户消息 → ChromaDB query(n=5) → 注入 LLM 上下文 → 生成回复

## 文案生成工作流 (多Agent)
```
用户输入 → Manager Agent (ReAct评估完整度)
  ├─ 不足 → 追问用户 (断点保存状态)
  └─ 充足 → Analyzer (产品分析) → Generator (生成文案+合规检查) → 展示
```

## API 接口总览 (41+ 端点)
| 模块 | 端点数 | 路由文件 |
|------|--------|---------|
| 知识库管理 | 8 | `routers/knowledge.py` |
| 客服模版 | 5 | `routers/template.py` |
| 知能对话 | 5 | `routers/dialog.py` |
| 转人工设置 | 4 | `routers/transfer.py` |
| 智能对话 | 1 | `routers/chat.py` |
| 会话管理 | 5 | `routers/conversation.py` |
| 文案生成工作流 | 7 | `routers/copywriting_workflow.py` |
| 合规规则管理 | 6 | `routers/copywriting_workflow.py` (含上传/下载) |

## 部署与运行
```bash
cp .env.example .env    # 填入 DASHSCOPE_API_KEY
pip install -e .
# PostgreSQL: CREATE DATABASE customer_agent;
python main.py           # 后端 → http://localhost:8000
cd frontend && npm install && npm run dev  # 前端 → http://localhost:3000
```
