# 电商智能客服系统 — 完整项目分析文档

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [系统架构](#3-系统架构)
4. [后端详解](#4-后端详解)
5. [前端详解](#5-前端详解)
6. [数据库设计](#6-数据库设计)
7. [记忆系统设计](#7-记忆系统设计)
8. [RAG 工程（升级版）](#8-rag-工程升级版)
9. [LangGraph Agent](#9-langgraph-agent)
10. [文案生成工作流](#10-文案生成工作流)
11. [合规规则管理](#11-合规规则管理)
12. [API 接口总览](#12-api-接口总览)
13. [前后端对接](#13-前后端对接)
14. [部署与运行](#14-部署与运行)
15. [已知局限与改进方向](#15-已知局限与改进方向)

---

## 1. 项目概述

### 1.1 项目定位

这是一个基于 **LangGraph** 框架的**电商智能客服系统**，支持以下核心功能：

| 模块 | 功能简述 |
|------|---------|
| 智能对话 | 多轮对话客服，带升级版 RAG（混合检索 + 重排序）和会话记忆 |
| 知识库管理 | 创建/管理知识库，上传文档（txt/md/json/docx/csv/xlsx），语义分块向量化 |
| 文案生成系统 | 交互式多 Agent 协作生成产品营销文案（Manager→Analyzer→Generator），支持多模态图片识别 |
| 知能对话 | 预设问答对管理，支持树形分组，用于快速精确回复 |
| 聊天记录 | 历史会话查看、AI 回复编辑、选择性保存为预设对话 |
| 客服模版 | 客服回复模板管理，注入到对话 Agent 的系统提示中 |
| 转人工设置 | 关键词触发规则，匹配后自动回复并支持人工转接 |
| 商店配置 | 预留模块（开发中） |

### 1.2 项目结构

```
D:\Project-team\LangGraph\Intelligent-Customer-agent/
├── main.py                          # FastAPI 入口
├── pyproject.toml                   # Python 依赖
├── .env / .env.example              # 环境变量
├── .gitignore
├── uploads/                         # 文件上传存储
│   └── compliance_rules/            # 合规规则上传文件
├── chroma_data/                     # ChromaDB 向量库本地持久化
├── chroma_data.backup/              # ChromaDB 备份（迁移前自动创建）
├── frontend/                        # 前端项目 (React + Vite + Tailwind)
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── index.html
│   └── src/
│       ├── main.tsx                 # React 入口
│       ├── App.tsx                  # 根组件（导航逻辑）
│       ├── index.css                # Tailwind + 自定义工具类
│       ├── types/index.ts           # 共享类型
│       ├── services/api.ts          # API 客户端
│       ├── components/
│       │   ├── Header.tsx           # 顶部导航栏
│       │   └── ModuleDashboard.tsx  # 首页模块仪表盘（7模块 4列网格）
│       └── pages/
│           ├── ChatPage.tsx          # 智能对话
│           ├── KnowledgeNewPage.tsx  # 新建知识库
│           ├── KnowledgeUploadPage.tsx # 文件上传
│           ├── KnowledgeAIPage.tsx   # 知能对话
│           ├── CopywritingChatPage.tsx # 文案生成系统（聊天式多Agent协作）
│           ├── ChatHistoryPage.tsx   # 聊天记录
│           ├── CSTemplatePage.tsx    # 客服模版
│           ├── StoreConfigPage.tsx   # 商店配置
│           └── TransferPage.tsx     # 转人工设置
└── src/                             # 后端源码
    ├── __init__.py
    ├── config.py                    # 全局配置（含 RAG 配置项）
    ├── database/
    │   ├── __init__.py
    │   ├── postgres.py              # PostgreSQL 引擎
    │   ├── chroma.py                # ChromaDB 客户端（支持自定义 EmbeddingFunction）
    │   ├── redis.py                 # Redis 客户端
    │   └── init_db.py               # 建表初始化
    ├── models/
    │   ├── __init__.py
    │   ├── knowledge_base.py        # 知识库 & 文档模型
    │   ├── template.py              # 客服模版模型
    │   ├── dialog.py                # 预设对话模型
    │   ├── transfer_rule.py         # 转人工规则模型
    │   ├── conversation.py          # 会话 & 消息模型
    │   └── copywriting_session.py   # 文案会话 + 消息 + 合规规则模型
    ├── schemas/
    │   ├── __init__.py
    │   ├── knowledge_base.py        # 知识库 Pydantic 模型
    │   ├── template.py              # 模版 Pydantic 模型
    │   ├── dialog.py                # 预设对话 Pydantic 模型
    │   ├── transfer_rule.py         # 转人工规则 Pydantic 模型
    │   ├── chat.py                  # 对话 Pydantic 模型（含 SourceDetail）
    │   ├── conversation.py          # 会话 Pydantic 模型
    │   └── copywriting_workflow.py  # 文案工作流 + 合规规则 Pydantic 模型
    ├── routers/
    │   ├── __init__.py
    │   ├── knowledge.py             # 知识库 API（8 个端点）
    │   ├── template.py              # 模版 API（5 个端点）
    │   ├── dialog.py                # 预设对话 API（5 个端点）
    │   ├── transfer.py              # 转人工规则 API（4 个端点）
    │   ├── chat.py                  # 对话 API（核心端点）
    │   ├── conversation.py          # 会话 API（5 个端点）
    │   └── copywriting_workflow.py  # 文案工作流 API（7 个端点）+ 合规规则 API（6 个端点）
    ├── services/
    │   ├── __init__.py
    │   ├── knowledge_service.py     # 知识库业务逻辑 + 语义分块 + RAG 摄入
    │   ├── template_service.py      # 模版业务逻辑
    │   ├── dialog_service.py        # 预设对话业务逻辑
    │   ├── memory_service.py        # 会话记忆服务（核心）
    │   └── copywriting_service.py   # 文案会话 + 合规规则管理 + 状态序列化 + 文件上传
    ├── agents/
    │   ├── __init__.py
    │   ├── llm.py                   # LLM / Embedding / Reranker 工厂函数
    │   ├── state.py                 # LangGraph State 定义（ChatAgent + CopywritingWorkflow）
    │   ├── embedding.py             # 【新】DashScope EmbeddingFunction（ChromaDB 自定义嵌入）
    │   ├── reranker.py              # 【新】DashScope Reranker（qwen3-rerank 重排序客户端）
    │   ├── retrieval.py             # 【新】HybridRetriever（向量+BM25+RRF 混合检索器）
    │   ├── chat_agent.py            # 对话 Agent（升级版 4 节点 RAG）
    │   └── copywriting_workflow_agent.py # 文案工作流 Agent（Manager→Analyzer→Generator，支持多模态）
    └── utils/
        ├── __init__.py
        ├── file_parser.py           # 多格式文件解析器
        └── migration.py             # 【新】ChromaDB 迁移工具（384维→1536维）
```

---

## 2. 技术栈

### 2.1 后端

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| Web 框架 | FastAPI | >=0.115 | HTTP 路由、中间件、CORS |
| ASGI 服务器 | Uvicorn | >=0.30 | 运行 FastAPI 应用 |
| ORM | SQLAlchemy (async) | >=2.0.30 | 异步数据库操作 |
| 数据库驱动 | asyncpg | >=0.29 | PostgreSQL 异步连接 |
| 向量数据库 | ChromaDB | >=0.5 | 文档嵌入存储与检索（PersistentClient） |
| AI 框架 | LangChain | >=0.3 | LLM 集成、Prompt 管理 |
| Agent 框架 | LangGraph | >=0.2 | 有向图式 Agent 工作流（条件边+状态持久化） |
| LLM SDK | langchain-openai | >=0.2 | 通过 OpenAI 兼容接口调用千问 |
| 文本分块 | langchain-text-splitters | >=1.1 | RecursiveCharacterTextSplitter 语义分块 |
| BM25 检索 | rank-bm25 | >=0.2 | BM25 关键词检索 |
| 中文分词 | jieba | >=0.42 | BM25 索引的文本分词 |
| HTTP 客户端 | httpx | >=0.27 | 异步 HTTP（qwen3-rerank API 调用） |
| 数据校验 | Pydantic | >=2.7 | API 请求/响应 Schema |
| 配置管理 | pydantic-settings | >=2.3 | .env 环境变量管理 |
| 文件解析 | python-docx | >=1.1 | DOCX 文档解析 |
| 文件解析 | openpyxl | >=3.1 | XLSX 表格解析 |
| 文件解析 | pandas | >=2.2 | CSV/XLSX 数据读取 |
| 异步文件 | aiofiles | >=24 | 异步文件读写 |
| 缓存 | Redis | >=5.0 | 已配置但尚未使用 |

### 2.2 LLM 模型清单

| 模型 | 用途 | 调用方式 |
|------|------|---------|
| `qwen-plus` | 对话生成、产品分析、文案生成 | OpenAI 兼容 API |
| `qwen3-vl-flash` | 多模态图片识别（Manager + Analyzer） | OpenAI 兼容 API |
| `text-embedding-v2` | 文档/Query 向量化（1536维） | OpenAI 兼容 API |
| `qwen3-rerank` | 检索结果重排序 | DashScope Rerank API |

### 2.3 前端

| 类别 | 技术 | 版本 | 用途 |
|------|------|------|------|
| 框架 | React | 18.3 | 组件化 UI |
| 构建工具 | Vite | 5.3 | 极速开发服务器 + 生产打包 |
| 类型系统 | TypeScript | 5.5 | 静态类型检查 |
| CSS 框架 | Tailwind CSS | 3.4 | 原子化 CSS |
| 图标库 | lucide-react | 0.400 | SVG 图标组件 |
| 工具函数 | clsx | 2.1 | 条件式 CSS 类名拼接 |

### 2.4 基础设施

| 类别 | 技术 | 说明 |
|------|------|------|
| 关系数据库 | PostgreSQL | 存储所有结构化数据（10 张表） |
| 向量数据库 | ChromaDB (Persistent) | 本地文件持久化，存储 1536 维文档嵌入 |
| LLM 平台 | 阿里云百炼 (DashScope) | 千问系列模型 |
| 通信协议 | OpenAI 兼容 API | DashScope `/compatible-mode/v1` 端点 |

---

## 3. 系统架构

### 3.1 分层架构

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                  │
│   port 3000  ──Vite proxy──►  /api/* → port 8000   │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│               FastAPI Application (port 8000)        │
│                                                     │
│  Routers (8) ───► Services (5) ───► Database        │
│       │               │                │            │
│       │               ├─ PostgreSQL    │            │
│       │               ├─ ChromaDB     │            │
│       │               ├─ LLM Agents   │            │
│       │               └─ Reranker API │            │
│       │                               │            │
│       └─── Agents (2 + 3 辅助模块) ───┘            │
│              ├─ ChatAgent (升级版 RAG)              │
│              │   ├─ DashScopeEmbeddingFunction      │
│              │   ├─ HybridRetriever (向量+BM25)     │
│              │   └─ DashScopeReranker (qwen3)       │
│              └─ CopywritingWorkflowAgent            │
└─────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│                  Data Layer                          │
│                                                     │
│  PostgreSQL  ──── 10 tables                         │
│  ChromaDB    ──── Per-KB collections (1536-d vectors)│
│  Redis       ──── Configured, not yet used          │
└─────────────────────────────────────────────────────┘
```

### 3.2 请求处理流程

```
用户消息 → Frontend (React useState → fetch)
    → Vite proxy (/api → localhost:8000)
    → FastAPI Router → Service Layer → Agent / Database
    → JSON Response → Frontend (setState → re-render)
```

---

## 4. 后端详解

### 4.1 FastAPI 应用入口 (`main.py`)

应用使用 **lifespan 上下文管理器** 管理生命周期：

- **启动时**：调用 `init_db()` 自动建表，启动 `periodic_cleanup()` 后台任务
- **运行时**：注册 8 个路由模块，CORS 中间件允许 localhost:3000
- **关闭时**：取消清理任务

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    cleanup_task = asyncio.create_task(periodic_cleanup())  # 每10分钟清理过期会话
    yield
    cleanup_task.cancel()
```

### 4.2 配置系统 (`src/config.py`)

使用 `pydantic-settings` 的 `BaseSettings`，自动从 `.env` 文件读取环境变量。

关键配置项：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| **LLM 设置** | | |
| `llm_model` | `qwen-plus` | 文本 LLM 模型名 |
| `embedding_model` | `text-embedding-v2` | 嵌入模型名（1536维） |
| `embedding_dim` | 1536 | 嵌入向量维度 |
| `dashscope_base_url` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | DashScope 端点 |
| **RAG — 分块设置** | | |
| `chunk_size` | 500 | 分块大小（字符数） |
| `chunk_overlap` | 50 | 块间重叠字符数 |
| `chunk_separators` | `["\n\n","\n","。","？","！","，","；","："," ",""]` | 中文语义分隔符优先级 |
| **RAG — 检索设置** | | |
| `retrieval_top_k` | 15 | 向量/BM25 各自检索的候选数 |
| `retrieval_final_k` | 10 | RRF 融合后传入重排序的文档数 |
| `rrf_k` | 60 | RRF 平滑常数 |
| `rrf_alpha` | 0.7 | 向量检索在 RRF 中的权重（BM25=0.3） |
| `bm25_cache_ttl` | 300 | BM25 索引缓存有效期（秒） |
| **RAG — 重排序设置** | | |
| `rerank_model` | `qwen3-rerank` | 重排序模型 |
| `rerank_top_n` | 5 | 重排序后保留的最终文档数 |
| `rerank_instruct` | `"Given a web search query..."` | 重排序策略指令 |
| **RAG — 查询改写** | | |
| `query_rewrite_enabled` | True | 是否启用 LLM 查询改写 |
| **ChromaDB** | | |
| `chroma_distance_metric` | `cosine` | 向量距离度量方式 |
| **记忆设置** | | |
| `max_messages_per_session` | 40 | 触发压缩的消息阈值 |
| `recent_messages_keep` | 20 | 压缩后保留的最近消息数 |
| `session_ttl_days` | 10 | 会话数据保留天数 |
| **文件上传** | | |
| `upload_dir` | `./uploads` | 文件上传存储路径 |
| `max_upload_size_mb` | 200 | 最大上传文件大小 |

### 4.3 服务层 (`src/services/`)

#### KnowledgeService — 知识库管理 + RAG 摄入

| 方法 | 说明 |
|------|------|
| `create(data)` | 创建知识库 + 对应的 ChromaDB 集合 |
| `upload_file(kb_id, filename, content)` | 文件解析 → 语义分块 → DashScope 向量化 → 入库 + BM25 缓存失效 |
| `_chunk_text(text)` | 使用 `RecursiveCharacterTextSplitter` + 中文分隔符进行语义分块 |
| `add_text_to_kb(kb_id, text, filename)` | 纯文本直接向量化入库 + 缓存失效 |
| `delete(kb_id)` | 同时删除 PostgreSQL 记录、ChromaDB 集合、BM25 缓存 |

#### MemoryService — 会话记忆管理（核心）

| 方法 | 说明 |
|------|------|
| `create_conversation()` | 创建新会话，自动分配"客户N"编号 |
| `add_message(conv_id, role, content)` | 添加消息，更新计数和标题 |
| `load_history(conv_id)` | 返回 (摘要, 未压缩消息列表) 供 Agent 使用 |
| `maybe_compress(conv_id)` | 超过 40 条消息时触发 LLM 压缩 |
| `_summarize_messages()` | 调用 LLM 将旧消息压缩为 ≤200 字摘要 |
| `cleanup_expired()` | 删除 10 天前的过期会话 |
| `update_message(msg_id, content)` | 编辑消息内容 |
| `create_preset_dialog(q, a, parent_id)` | 保存问答对为预设对话（带去重） |

#### CopywritingService — 文案会话 + 合规规则管理

| 方法 | 说明 |
|------|------|
| `create_session(title)` | 创建文案工作流会话 |
| `save_state(session_id, state)` | 序列化 LangGraph State → JSONB 持久化 |
| `restore_state(session_id)` | JSONB → 反序列化为 BaseMessage 列表 |
| `add_message(session_id, role, content)` | 添加文案会话消息 |
| `upload_rule(title, content, bytes, filename)` | 上传合规规则文件 + 相似度去重 |
| `check_similarity(content)` | difflib 比对新规则与已有规则的相似度 |
| `delete_rule(rule_id)` | 删除规则 + 清理磁盘文件 |
| `get_all_rules_text()` | 拼接所有规则内容供 Agent 注入 prompt |

#### DialogService — 预设对话匹配

- `search(query)` — 在 `PresetDialog.question` 上执行 `ILIKE '%query%'` 子串匹配
- 完全匹配时跳过 LLM 直接返回预设回复（性能优化）

### 4.4 LLM 工厂 (`src/agents/llm.py`)

```python
# 文本 LLM
def get_llm(temperature=0.3) -> ChatOpenAI:
    return ChatOpenAI(
        model=settings.llm_model,          # qwen-plus
        api_key=settings.dashscope_api_key,
        base_url=settings.dashscope_base_url,
        temperature=temperature,
    )

# 多模态 VL 模型（图片识别）
def get_vl_llm(temperature=0.3) -> ChatOpenAI:
    return ChatOpenAI(model="qwen3-vl-flash", ...)

# ChromaDB 嵌入函数（DashScope text-embedding-v2, 1536维）
def get_embedding_function() -> DashScopeEmbeddingFunction:
    return DashScopeEmbeddingFunction(...)

# 重排序客户端（qwen3-rerank）
def get_reranker_client() -> DashScopeReranker:
    return DashScopeReranker(...)
```

关键：使用 `langchain-openai` 的 `ChatOpenAI` 类，通过 `base_url` 指向 DashScope 的 OpenAI 兼容端点。

---

## 5. 前端详解

### 5.1 技术选型理由

| 决策 | 理由 |
|------|------|
| **React + TypeScript** | 组件化开发，类型安全 |
| **Vite（非 CRA）** | 极速 HMR，原生 ESM |
| **Tailwind CSS（非组件库）** | 原子化 CSS，灵活定制暗金主题 |
| **lucide-react（非 Font Awesome）** | 本地包，Tree-shakable，按需加载 |
| **原生 fetch（非 axios）** | 零额外依赖，足够满足需求 |
| **无路由库** | 单页应用，用 `useState` 条件渲染足够 |

### 5.2 组件树

```
App
├── view='home'
│   ├── Header
│   └── ModuleDashboard (7模块 4列网格)
│
└── view='module'
    ├── Top Bar（← 返回 + 模块标题 + 知识库子标签）
    └── {renderContent()}
        ├── ChatPage（侧边栏 + 聊天区 + 输入框）
        ├── KnowledgeNewPage（列表/创建 双模式）
        ├── KnowledgeUploadPage（拖拽上传）
        ├── KnowledgeAIPage（表格 + 树形展开 + 增删改模态框）
        ├── CopywritingChatPage（聊天式UI + 规则管理弹窗 + 操作栏）
        ├── ChatHistoryPage（左侧客户列表 + 右侧对话 + 编辑 + 保存）
        ├── CSTemplatePage（表格 + 复选框 + 批量删除）
        ├── StoreConfigPage（占位）
        └── TransferPage（规则列表 + 内联编辑 + 添加）
```

### 5.3 状态管理

项目使用**纯 React 本地状态**，无 Redux/MobX/Zustand：

- **跨组件共享**：通过 props drilling（如 `selectedKbId`）
- **跨会话持久化**：通过 `localStorage` 存储 session_id
- **服务端状态**：各页面组件通过 `useEffect` + `fetch` 加载数据

### 5.4 暗金主题

Tailwind 自定义色板（`tailwind.config.js`）：

| 色阶 | 十六进制 | 用途 |
|------|---------|------|
| `primary` | `#B8860B` | 主按钮、链接、激活态 |
| `gold-50` | `#FDF8F0` | 激活背景、hover 背景 |
| `gold-100` | `#F5E6CC` | 用户头像圈 |
| `gold-200` | `#E8D5A3` | 选中态边框 |

---

## 6. 数据库设计

### 6.1 PostgreSQL 表结构（10 张表）

#### 原有表（7 张）

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `knowledge_bases` | 知识库 | id, name, description |
| `knowledge_documents` | 知识库文档 | id, kb_id(FK), filename, file_type, chunk_count |
| `templates` | 客服模版 | id, name, content, intro |
| `preset_dialogs` | 预设问答 | id, question, answer, shop, parent_id(自引用) |
| `transfer_rules` | 转人工规则 | id, keyword, reply, enabled |
| `conversations` | 对话会话 | id, title, customer_label, message_count, summary, is_active |
| `messages` | 对话消息 | id, conversation_id(FK), role, content, is_summarized |

#### 新增表（3 张，文案工作流二次开发）

| 表名 | 用途 | 关键字段 |
|------|------|---------|
| `copywriting_sessions` | 文案生成会话 | id, title, status, langgraph_state(JSONB) |
| `copywriting_messages` | 文案消息记录 | id, session_id(FK), role, content |
| `compliance_rules` | 合规规则 | id, title, content, source_type, file_path |

### 6.2 ChromaDB 向量存储

- **客户端类型**：`PersistentClient`（本地文件持久化，目录 `./chroma_data`）
- **嵌入模型**：DashScope `text-embedding-v2`（1536 维，中文优化）
- **距离度量**：cosine（余弦相似度）
- **集合命名**：每个知识库对应一个集合，命名为 `kb_{knowledge_base_id}`
- **文档块**：以 `{file_id}_chunk_{i}` 为 ID 存储，元数据包含 `source` 和 `kb_id`

---

## 7. 记忆系统设计

### 7.1 设计思路

记忆系统围绕**会话（Conversation）**概念设计。每个会话代表一个独立客户的完整咨询过程。

### 7.2 会话生命周期

```
客户首次发消息
  │
  ▼
MemoryService.create_conversation()
  │  自动分配 customer_label: "客户N"
  │
  ▼
每次对话轮次：
  MemoryService.add_message(user_msg)
  MemoryService.add_message(assistant_msg)
  │  message_count += 1
  │  title ← 首条用户消息前 80 字符
  │
  ▼
每次对话后检查压缩：
  MemoryService.maybe_compress()
  │  未压缩消息 > 40? → LLM 生成摘要 → 标记 is_summarized
  │
  ▼
后台定时任务（每10分钟）：
  MemoryService.cleanup_expired()
  │  删除 updated_at < NOW() - 10天 的会话
```

### 7.3 压缩算法

- 触发条件：未压缩消息数 > 40
- 取出最旧的 excess 条消息
- 调用 LLM (temperature=0.1) 生成 ≤200字摘要
- 标记 is_summarized=True

### 7.4 上下文注入

```
[System Prompt]      ← 角色设定 + 模版内容 + 知识库资料（含来源标注）
[对话摘要]           ← conv.summary（若存在）
[最近未压缩消息]     ← 最多 40 条
[当前用户消息]       ← 最新 HumanMessage
```

---

## 8. RAG 工程（升级版）

> **v1.3 重大升级**：RAG 系统经过全面重构，修复了 Embedding 模型不一致问题，新增混合检索、重排序、查询改写、引用溯源等能力。

### 8.1 升级版 RAG 流程总览

```
用户消息
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ ① Query Rewriting（查询改写）                                │
│   LLM 提取核心问题，去除"你好""请问"等礼貌填充词             │
│   例: "你好，我想问一下退换货的事情" → "退换货政策"           │
│   可配置关闭（降低延迟）                                     │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ ② Hybrid Retrieve（混合检索）                               │
│                                                              │
│   向量检索 (ChromaDB)              BM25 关键词检索            │
│   DashScope text-embedding-v2      jieba 分词 + rank_bm25    │
│   1536 维，Top-15 ↑                Top-15 ↑                  │
│         │                               │                    │
│         └──────── RRF 融合 ─────────────┘                    │
│         score(d) = 0.7/(60+rank_v) + 0.3/(60+rank_b)        │
│                       ↓                                      │
│                    Top-10 候选                                │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ ③ Rerank（重排序）                                          │
│   qwen3-rerank 模型，从 10 个候选中精排 Top-5               │
│   API: POST /compatible-api/v1/reranks                       │
│   失败时优雅降级 → 使用 RRF 排序结果                         │
└─────────────────────────────────────────────────────────────┘
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│ ④ Generate（生成回复）                                      │
│   System Prompt 包含：                                       │
│   - 客服模版内容                                             │
│   - Top-5 精排文档块（带 [来源: xxx.md] 标注）               │
│   - 对话历史 + 摘要                                          │
│   LLM (qwen-plus, temp=0.3) 生成回复                         │
│   返回: reply + sources + source_details + retrieval_count   │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 文档摄入管道

```
用户上传文件
  │
  ▼
1. 保存原始文件到 ./uploads/
  │
  ▼
2. 解析文件为纯文本
   ├─ .txt/.md  → UTF-8 解码
   ├─ .json     → 美化打印
   ├─ .docx     → python-docx 段落提取
   ├─ .csv      → pandas.read_csv
   └─ .xlsx     → pandas.read_excel
  │
  ▼
3. 语义分块 — RecursiveCharacterTextSplitter
   ┌─────────────────────────────────────────────┐
   │ 分隔符优先级：                               │
   │ \n\n (段落) → \n (行) → 。？！ (句末)        │
   │ → ，；： (分句) → ' ' (空格) → '' (字符兜底) │
   │                                             │
   │ chunk_size=500, chunk_overlap=50            │
   └─────────────────────────────────────────────┘
  │
  ▼
4. DashScope text-embedding-v2 向量化（1536维）
   ChromaDB.add(documents, embedding_function=DashScopeEF)
  │
  ▼
5. BM25 缓存失效 → 下次检索时重建索引
  │
  ▼
6. PostgreSQL 记录 KnowledgeDocument
```

### 8.3 向量检索（修复嵌入模型不一致）

**问题（v1.2）：** ChromaDB 使用内置 `all-MiniLM-L6-v2`（384维英文优化），而项目配置的 `text-embedding-v2`（1536维中文优化）从未被使用。

**修复（v1.3）：** 实现 `DashScopeEmbeddingFunction` 类，满足 ChromaDB 的 `EmbeddingFunction[D]` 协议：

```python
class DashScopeEmbeddingFunction(EmbeddingFunction[Documents]):
    """自定义嵌入函数，调用 DashScope text-embedding-v2"""
    
    def __call__(self, input: Documents) -> Embeddings:
        # 每批 25 条（DashScope 限制）
        for i in range(0, len(input), 25):
            batch = input[i:i+25]
            resp = client.embeddings.create(model="text-embedding-v2", input=batch)
            all_embeddings.extend([e.embedding for e in sorted(resp.data, key=lambda x: x.index)])
        return all_embeddings
```

- ChromaDB 在线程池中同步调用 `__call__`
- 自动批处理（25条/批）尊重 DashScope API 限制
- `get_or_create_collection(name, embedding_function=ef)` 确保传入 EF
- 已有数据需通过迁移脚本重建（384维 → 1536维）

### 8.4 混合检索（BM25 + 向量）

- **向量检索**：语义匹配，擅长处理同义表达（"退货"≈"退款"）
- **BM25 关键词检索**：精确匹配，擅长处理专有名词（产品型号、SKU）
- **jieba 分词**：中文文本先分词再建 BM25 索引
- **BM25 缓存**：索引在内存中缓存 300 秒，文档变动时主动失效
- **RRF 融合**：向量权重 0.7，BM25 权重 0.3（偏向语义）

### 8.5 重排序（qwen3-rerank）

| 属性 | 说明 |
|------|------|
| 模型 | `qwen3-rerank` |
| API | `POST https://dashscope.aliyuncs.com/compatible-api/v1/reranks` |
| 最大文档 | 500 条/请求 |
| 单条 Token | 4,000 |
| 总 Token | 120,000 |
| 策略 | `"Given a web search query, retrieve relevant passages that answer the query."` (QA 优化) |

### 8.6 查询改写

轻量级 LLM prompt 提取核心问题：

```
原始: "你好，我想问一下关于产品退换货的问题，能帮我查一下吗"
改写: "产品退换货政策"
```

可通过 `query_rewrite_enabled=false` 关闭（调试或低延迟场景）。

### 8.7 新 LangGraph 图结构

```
START → rewrite_query → hybrid_retrieve → rerank → generate → END
```

（旧版为 `START → retrieve → match_presets → generate → END`，`match_presets` 已移除，预设匹配在 router 层同步完成）

### 8.8 引用溯源

`ChatResponse` 新增字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `sources` | `list[str]` | 去重后的来源文件名列表 |
| `source_details` | `list[SourceDetail]` | 每个来源的完整信息（content, source, score） |
| `retrieval_count` | `int` | 检索到的文档总数（调试用） |

### 8.9 迁移工具

```bash
# 查看当前状态
uv run python -m src.utils.migration status

# 迁移所有知识库
uv run python -m src.utils.migration reindex

# 迁移单个知识库
uv run python -m src.utils.migration reindex --kb-id <uuid>
```

迁移前会自动备份 `chroma_data/` 到 `chroma_data.backup/`。

### 8.10 RAG 新增文件

| 文件 | 职责 |
|------|------|
| `src/agents/embedding.py` | `DashScopeEmbeddingFunction` — ChromaDB 嵌入函数 |
| `src/agents/reranker.py` | `DashScopeReranker` — qwen3-rerank 异步客户端 |
| `src/agents/retrieval.py` | `HybridRetriever` — 向量+BM25+RRF 混合检索器 + BM25 缓存 |
| `src/utils/migration.py` | ChromaDB 迁移脚本 |

---

## 9. LangGraph Agent

### 9.1 ChatAgent（对话 Agent）— 升级版

**图结构：** `START → rewrite_query → hybrid_retrieve → rerank → generate → END`

| 节点 | 功能 |
|------|------|
| `rewrite_query` | LLM 提取核心问题，生成检索优化的查询 |
| `hybrid_retrieve` | 向量检索 + BM25 → RRF 融合 → Top-10 |
| `rerank` | qwen3-rerank 精排 → Top-5（失败时优雅降级） |
| `generate` | 组装 [SystemPrompt + 精排文档(含来源) + 历史] → LLM 生成 |

### 9.2 预设对话短路机制

预设对话匹配在路由器中执行，**短路绕过整个 Agent**。如果关键词匹配成功，直接返回预设答案，不调用 LLM。

```python
# src/routers/chat.py
matches = await dialog_svc.search(request.message)
if matches:
    return ChatResponse(reply=matches[0].answer, ...)  # 短路！
```

---

## 10. 文案生成工作流

### 10.1 架构设计

采用 **LangGraph + 中枢指挥者（Manager-Worker）多Agent模式**，支持多模态图片识别：

```
用户: "我想卖一款防晒霜，100元以下" [+ 产品图片]
          ↓
【Manager Agent】(ReAct评估完整度, qwen3-vl-flash 如有图片)
  ├─ 从图片中提取产品外观、颜色、包装等视觉信息
  ├─ 与文字描述合并形成完整产品画像
  ├─ 不足 → 追问: "防晒指数？适合什么肤质？" (断点保存State)
  └─ 充足 → 分发
          ↓
【Analyzer Agent】(产品分析, qwen3-vl-flash 如有图片)
  → 卖点提炼/人群画像/情感营销切入点/视觉差异化分析
          ↓
【Generator Agent】(文案生成+合规检查, qwen-plus)
  → 注入合规规则 → 生成走心共情风 Markdown 文案（300-500字）
          ↓
用户: 预览编辑 / 下载.md / 保存到知识库
```

### 10.2 LangGraph 图结构

```
START → manager_node ──[info incomplete]──→ END (返回追问, state持久化)
        │
        └──[info complete]──→ analyzer_node → generator_node → END
```

### 10.3 多模态支持

- **Manager + Analyzer** 使用 `qwen3-vl-flash` 多模态模型
- 图片以 base64 data URL 格式传入 OpenAI 兼容 API
- 支持 jpg/png/gif/webp/bmp 格式

### 10.4 断点续传

- State 存入 `copywriting_sessions.langgraph_state` (JSONB)
- 用户补充信息 → 从 JSONB 反序列化恢复 State → 从断点继续执行
- BaseMessage ↔ dict 转换由 `CopywritingService` 处理

### 10.5 前端

`CopywritingChatPage.tsx` 提供聊天式交互，三阶段：**idle**（无会话）→ **gathering**（追问中）→ **generated**（文案完成）。

---

## 11. 合规规则管理

### 11.1 规则来源

- **手动输入**：适合临时追加单条规则
- **文件上传**：支持 .md/.docx/.txt，利用 `FileParser.parse_bytes()` 自动解析

### 11.2 去重机制

上传文件时自动与已有规则比相似度（`difflib.SequenceMatcher`）：
- > 80% → 拒绝，提示高度相似
- 60-80% → 警告，用户可选择仍创建或取消
- < 60% → 直接创建

### 11.3 规则注入

生成文案前，所有规则拼接为 `## {title}\n{content}` 注入 Generator 的 prompt 中作为合规约束。

---

## 12. API 接口总览

系统共有 **41+ 个 API 端点**，分布在 8 个路由模块中。

### 12.1 知识库管理（8 个端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/knowledge-bases` | 列出所有知识库 |
| POST | `/api/knowledge-bases` | 创建知识库 |
| GET | `/api/knowledge-bases/{id}` | 获取知识库详情 |
| PUT | `/api/knowledge-bases/{id}` | 更新知识库 |
| DELETE | `/api/knowledge-bases/{id}` | 删除知识库 |
| POST | `/api/knowledge-bases/{id}/upload` | 上传文件到知识库 |
| POST | `/api/knowledge-bases/{id}/add-text` | 添加纯文本到知识库 |
| GET | `/api/health` | 健康检查 |

### 12.2 客服模版（5 个端点）

标准 CRUD + 列表。

### 12.3 知能对话（5 个端点）

标准 CRUD + 列表（含树形子节点）。

### 12.4 转人工设置（4 个端点）

标准 CRUD + 列表。

### 12.5 智能对话（1 个端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 多轮对话（核心端点），返回含来源详情 |

**请求：**
```json
{
  "knowledge_base_id": "...",
  "template_id": "...",
  "message": "如何退货？",
  "conversation_id": "可选，用于续接会话"
}
```

**响应（升级版）：**
```json
{
  "reply": "您好，我们支持7天无理由退货...",
  "sources": ["return_policy.md"],
  "source_details": [
    {
      "content": "客户可以在收到商品后7天内申请无理由退货...",
      "source": "return_policy.md",
      "score": 0.9523
    }
  ],
  "conversation_id": "...",
  "retrieval_count": 5
}
```

### 12.6 会话管理（5 个端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/conversations` | 列出活跃会话 |
| GET | `/api/conversations/{id}` | 获取会话详情 |
| DELETE | `/api/conversations/{id}` | 删除会话 |
| PUT | `/api/conversations/{id}/messages/{msg_id}` | 编辑消息 |
| POST | `/api/conversations/{id}/save-as-dialog` | 保存为预设对话 |

### 12.7 文案生成工作流（7 个端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/copywriting/workflow/start` | 启动新会话 |
| POST | `/api/copywriting/workflow/{id}/send` | 继续对话 |
| GET | `/api/copywriting/workflow/{id}` | 获取会话详情 |
| GET | `/api/copywriting/workflow` | 列出所有会话 |
| DELETE | `/api/copywriting/workflow/{id}` | 删除会话 |
| GET | `/api/copywriting/workflow/{id}/export` | 导出文案 (.md) |
| POST | `/api/copywriting/workflow/{id}/save-to-kb` | 保存文案到知识库 |

### 12.8 合规规则管理（6 个端点）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/compliance-rules` | 列出所有规则 |
| POST | `/api/compliance-rules` | 手动创建规则 |
| POST | `/api/compliance-rules/upload` | 上传规则文件 |
| PUT | `/api/compliance-rules/{id}` | 更新规则 |
| DELETE | `/api/compliance-rules/{id}` | 删除规则 + 清理文件 |
| GET | `/api/compliance-rules/{id}/file` | 查看原始文件 |

---

## 13. 前后端对接

### 13.1 开发环境

- 前端：`http://localhost:3000`（Vite）
- 后端：`http://localhost:8000`（Uvicorn）
- Vite proxy：所有 `/api/*` → `http://localhost:8000`

### 13.2 智能对话数据流

```
1. 用户在 ChatPage 输入 "这个衣服掉色怎么办"
2. fetch('/api/chat', { method: 'POST', ... })
3. Vite proxy → FastAPI → chat.py
   - MemoryService 创建/获取会话
   - DialogService ILIKE 匹配预设 → 命中则短路返回
   - ChatAgent: rewrite → hybrid_retrieve → rerank → generate
   - MemoryService 保存消息 + 检查压缩
4. 返回 ChatResponse { reply, sources, source_details, conversation_id, retrieval_count }
5. React setMessages → 渲染新气泡（含来源引用）
```

### 13.3 文案生成数据流

```
1. 用户在 CopywritingChatPage 输入 "我想卖防晒霜"
2. POST /api/copywriting/workflow/start
3. CopywritingWorkflowAgent: manager_node → 评估 → 追问 或 继续
4. 如果追问：返回 next_action="ask_user"，State 存 JSONB
5. 用户补充信息 → POST /api/copywriting/workflow/{id}/send
6. 恢复 State → 继续工作流 → Analyzer → Generator
7. 返回 generated_copy → 前端显示操作栏
```

---

## 14. 部署与运行

### 14.1 环境要求

- Python >= 3.11
- Node.js >= 18
- PostgreSQL（创建 `customer_agent` 数据库）
- 阿里云百炼 API Key（需开通 qwen-plus、text-embedding-v2、qwen3-rerank）

### 14.2 启动步骤

```bash
# 1. 克隆项目并配置环境变量
cp .env.example .env
# 编辑 .env: DASHSCOPE_API_KEY, POSTGRES_PASSWORD 等

# 2. 安装依赖（使用 uv）
uv sync

# 3. 创建数据库
# PostgreSQL: CREATE DATABASE customer_agent;

# 4. 迁移 ChromaDB 嵌入模型（首次运行必须执行！）
uv run python -m src.utils.migration reindex

# 5. 启动后端
uv run python main.py
# → http://localhost:8000 (Swagger: /docs)

# 6. 安装前端依赖
cd frontend
npm install

# 7. 启动前端
npm run dev
# → http://localhost:3000
```

### 14.3 生产构建

```bash
cd frontend && npm run build    # 产物在 frontend/dist/
# .env: DEBUG=false
uv run python main.py
```

### 14.4 Docker 部署

```bash
docker-compose up -d
```

---

## 15. 已知局限与改进方向

### 15.1 v1.3 已修复的问题

| 问题 | 状态 |
|------|------|
| ChromaDB 使用默认英文嵌入模型 (384维) | ✅ 已修复 — DashScope text-embedding-v2 (1536维) |
| 分块为简单字符滑动窗口 | ✅ 已修复 — RecursiveCharacterTextSplitter + 中文分隔符 |
| 无重排序 | ✅ 已添加 — qwen3-rerank |
| 纯向量检索，无关键词搜索 | ✅ 已添加 — BM25 + RRF 混合检索 |
| 无查询优化 | ✅ 已添加 — Query Rewriting |
| 无引用溯源 | ✅ 已添加 — source_details 返回前端 |
| 无检索质量度量 | ✅ 已添加 — retrieval_metrics + retrieval_count |

### 15.2 当前局限

| 问题 | 影响 | 建议 |
|------|------|------|
| 仅支持单知识库检索 | 无法跨 KB 查询 | 添加多 KB 联合检索 |
| Redis 已配置但未使用 | 无缓存层 | 添加对话缓存或限流 |
| 预设匹配使用 ILIKE | 无法匹配同义表达 | 语义搜索替代 |
| 无 token 预算管理 | 长对话可能超出上下文窗口 | 动态追踪 token 数 |
| 无用户认证/授权 | 所有 API 对外开放 | 添加 JWT 认证 |
| 前端无路由 | URL 不反映当前页面 | 引入 React Router |
| 合规规则去重仅用 difflib | 大量规则时性能下降 | 规则超过 100 条时考虑向量化比对 |
| 文案工作流无 Checker Agent | 合规审核依赖 Generator 自我约束 | 引入独立审批 Agent |

### 15.3 未来改进方向

1. **多知识库检索**：一次查询同时搜索多个知识库
2. **缓存层**：Redis 缓存常见回复，减少 LLM 调用
3. **语义预设匹配**：预设对话向量化，语义检索替代 ILIKE
4. **动态 Token 管理**：监控上下文超出时自动压缩
5. **用户系统**：多租户/多用户权限管理
6. **前端路由**：React Router 实现 URL 导航
7. **文案 Checker Agent**：独立合规审批节点
8. **文案 Optimizer Agent**：用户修改指令 → 迭代优化闭环
9. **RAG 评估系统**：命中率、MRR 等指标监控
10. **多模态 RAG**：支持图片/视频检索增强生成
