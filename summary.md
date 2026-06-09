# 智能客服管理系统 — 项目摘要 (v1.3)

## 项目概述

基于 **LangGraph** 框架的电商智能客服系统，支持多轮对话客服（升级版 RAG）、知识库管理、文案生成系统（多 Agent 协作 + 多模态图片识别）、知能对话、聊天记录、客服模版、转人工设置和商店配置。

## 技术栈

### 后端
- **Web 框架**: FastAPI
- **ORM**: SQLAlchemy (async) + asyncpg
- **向量数据库**: ChromaDB (PersistentClient)，DashScope text-embedding-v2 (1536维)
- **Agent 框架**: LangGraph (StateGraph 多 Agent 协作)
- **LLM**: 阿里云百炼 DashScope (qwen-plus / qwen3-vl-flash / text-embedding-v2 / qwen3-rerank)
- **文本分块**: langchain-text-splitters (RecursiveCharacterTextSplitter + 中文分隔符)
- **BM25 检索**: rank-bm25 + jieba 中文分词
- **数据校验**: Pydantic + pydantic-settings
- **文件解析**: python-docx, openpyxl, pandas, aiofiles

### 前端
- **框架**: React 18 + TypeScript + Vite
- **CSS**: Tailwind CSS (暗金主题 #B8860B)
- **图标**: lucide-react

### 基础设施
- **关系数据库**: PostgreSQL (10 张表)
- **向量数据库**: ChromaDB (Persistent, 1536-d vectors)
- **LLM 平台**: 阿里云百炼 (DashScope) — 4 个模型

## 系统架构

三层架构：
1. 前端 (React) — 端口 3000
2. 后端 (FastAPI) — 端口 8000 (Vite proxy)
3. 数据层 — PostgreSQL + ChromaDB + Redis(预留)

## 核心功能模块 (7大模块)

1. **智能对话** — 多轮对话客服，升级版 RAG（查询改写 → 混合检索 → 重排序 → 生成），含会话记忆
2. **知识库管理** — 创建/管理知识库，上传文档（txt/md/json/docx/csv/xlsx），语义分块向量化
3. **文案生成系统** — 交互式 LangGraph 多 Agent 协作（Manager→Analyzer→Generator），支持多模态图片识别，智能追问+产品分析+合规文案生成+预览编辑+下载/入库
4. **聊天记录** — 历史会话查看、AI 回复编辑、选择性保存为预设对话
5. **客服模版** — 客服回复模板管理
6. **商店配置** — 预留模块
7. **转人工设置** — 关键词触发规则，支持人工转接

## 后端详解
- **FastAPI 入口**: lifespan 上下文管理器，启动时建表+启动清理任务
- **配置系统**: pydantic-settings BaseSettings 从 .env 读取（含 ~30 个 RAG 配置项）
- **服务层**: KnowledgeService (RAG摄入+语义分块)、MemoryService (记忆管理+LLM压缩)、DialogService (预设匹配)、TemplateService (模版)、CopywritingService (文案会话+合规规则管理+状态序列化)
- **Agent 层**: ChatAgent (升级版 4 节点 RAG)、CopywritingWorkflowAgent (Manager→Analyzer→Generator 三 Agent 协作+多模态)
- **RAG 辅助模块**: DashScopeEmbeddingFunction (ChromaDB 自定义嵌入)、HybridRetriever (向量+BM25+RRF)、DashScopeReranker (qwen3-rerank 重排序)
- **LLM 工厂**: ChatOpenAI + base_url 指向 DashScope 兼容端点；4 个模型统一管理

## RAG 工程 (v1.3 升级版)

### 升级版 4 节点流程
```
rewrite_query → hybrid_retrieve → rerank → generate
```

| 节点 | 功能 | 技术 |
|------|------|------|
| Query Rewriting | LLM 提取核心问题 | qwen-plus (temp=0.1) |
| Hybrid Retrieve | 向量 + BM25 → RRF 融合 | DashScope text-embedding-v2 + jieba + rank_bm25 |
| Rerank | 精排 Top-5 | qwen3-rerank via DashScope API |
| Generate | 生成回复（含来源标注） | qwen-plus (temp=0.3) |

### 摄入管道
```
文件上传 → FileParser 解析 → RecursiveCharacterTextSplitter（语义分块）
→ DashScope text-embedding-v2（1536维向量化）→ ChromaDB + PostgreSQL
```

### v1.3 修复的 7 个关键缺陷

| # | 问题 | 解决方案 |
|---|------|---------|
| 1 | ChromaDB 使用 all-MiniLM-L6-v2 (384维) | DashScopeEmbeddingFunction → text-embedding-v2 (1536维) |
| 2 | 固定 500 字符硬切 | RecursiveCharacterTextSplitter + 中文分隔符 |
| 3 | 无重排序 | qwen3-rerank |
| 4 | 纯向量检索 | BM25 + RRF 混合检索 |
| 5 | 无查询优化 | LLM Query Rewriting |
| 6 | 无引用溯源 | ChatResponse.source_details |
| 7 | 无检索评估 | retrieval_metrics + retrieval_count |

### 新增 RAG 模块

| 文件 | 职责 |
|------|------|
| `src/agents/embedding.py` | DashScopeEmbeddingFunction — ChromaDB 嵌入函数 |
| `src/agents/reranker.py` | DashScopeReranker — 异步重排序客户端 |
| `src/agents/retrieval.py` | HybridRetriever — 混合检索+BM25缓存+RRF融合 |
| `src/utils/migration.py` | ChromaDB 迁移工具（384维→1536维） |

### 新增依赖

- `langchain-text-splitters>=1.1.2` — 语义分块
- `rank-bm25>=0.2.2` — BM25 关键词检索
- `jieba>=0.42.1` — 中文分词
- `httpx>=0.27.0` — 异步 HTTP（rerank API）

## 数据库设计 (PostgreSQL 10 张表)

1. `knowledge_bases` — 知识库
2. `knowledge_documents` — 知识库文档
3. `templates` — 客服模版
4. `preset_dialogs` — 预设问答（树形结构）
5. `transfer_rules` — 转人工规则
6. `conversations` — 对话会话
7. `messages` — 对话消息
8. `copywriting_sessions` — 文案生成会话（含 JSONB 状态持久化）
9. `copywriting_messages` — 文案生成消息记录
10. `compliance_rules` — 合规规则（支持手动输入+文件上传）

## 记忆系统
- **会话生命周期**: 首次消息→创建会话自动编号"客户N" → 每次对话更新计数和时间 → 超过40条消息触发 LLM 压缩 → 每10分钟清理10天前的过期会话
- **压缩算法**: 未压缩 > 40 条 → 取最旧 N-20 条 → LLM(temp=0.1) 生成 ≤200字摘要 → 标记 is_summarized
- **上下文注入**: [System Prompt + 模板 + 精排文档(含来源)] → [对话摘要] → [最近消息] → [当前用户消息]

## 文案生成工作流 (多Agent + 多模态)

```
用户输入 + 产品图片 → Manager Agent (ReAct评估完整度, qwen3-vl-flash)
  ├─ 图片识别: 提取产品外观/颜色/包装/品牌调性
  ├─ 不足 → 追问用户 (断点保存状态到 JSONB)
  └─ 充足 → Analyzer (产品分析, qwen3-vl-flash) → Generator (文案生成+合规检查, qwen-plus)
```

## API 接口总览 (41+ 端点)

| 模块 | 端点数 | 路由文件 |
|------|--------|---------|
| 知识库管理 | 8 | `routers/knowledge.py` |
| 客服模版 | 5 | `routers/template.py` |
| 知能对话 | 5 | `routers/dialog.py` |
| 转人工设置 | 4 | `routers/transfer.py` |
| 智能对话 | 1 | `routers/chat.py`（返回含来源详情） |
| 会话管理 | 5 | `routers/conversation.py` |
| 文案生成工作流 | 7 | `routers/copywriting_workflow.py` |
| 合规规则管理 | 6 | `routers/copywriting_workflow.py` (含上传/下载) |

### Chat API 响应格式 (v1.3)

```json
{
  "reply": "您好，我们支持7天无理由退货...",
  "sources": ["return_policy.md"],
  "source_details": [
    {"content": "客户可以在收到商品后7天内...", "source": "return_policy.md", "score": 0.95}
  ],
  "conversation_id": "uuid",
  "retrieval_count": 5
}
```

## LLM 模型清单

| 模型 | 用途 | API |
|------|------|-----|
| `qwen-plus` | 对话生成、文案生成 | OpenAI 兼容 |
| `qwen3-vl-flash` | 产品图片识别 (Manager+Analyzer) | OpenAI 兼容 |
| `text-embedding-v2` | 文档/Query 向量化 (1536维) | OpenAI 兼容 |
| `qwen3-rerank` | 检索结果重排序 | DashScope Rerank API |

## 配置系统 (关键 RAG 配置项)

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `chunk_size` | 500 | 分块大小（字符） |
| `chunk_overlap` | 50 | 块间重叠 |
| `chunk_separators` | `["\n\n","\n","。","？","！","，","；","："," ",""]` | 中文分隔符 |
| `retrieval_top_k` | 15 | 向量/BM25 候选数 |
| `retrieval_final_k` | 10 | RRF 融合候选数 |
| `rrf_k` | 60 | RRF 平滑常数 |
| `rrf_alpha` | 0.7 | 向量权重(BM25=0.3) |
| `bm25_cache_ttl` | 300 | BM25 缓存秒数 |
| `rerank_model` | `qwen3-rerank` | 重排序模型 |
| `rerank_top_n` | 5 | 最终文档数 |
| `query_rewrite_enabled` | True | 是否改写查询 |
| `chroma_distance_metric` | `cosine` | 距离度量 |

## 部署与运行

```bash
cp .env.example .env              # 填入 DASHSCOPE_API_KEY
uv sync                            # 安装依赖
# PostgreSQL: CREATE DATABASE customer_agent;
uv run python -m src.utils.migration reindex  # 首次运行必须迁移
uv run python main.py              # 后端 → http://localhost:8000
cd frontend && npm install && npm run dev      # 前端 → http://localhost:3000
```

## 迁移工具

```bash
uv run python -m src.utils.migration status           # 查看嵌入状态
uv run python -m src.utils.migration reindex          # 全量迁移
uv run python -m src.utils.migration reindex --kb-id <uuid>  # 单个迁移
```
