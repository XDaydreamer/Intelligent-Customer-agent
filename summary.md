# 智能客服管理系统 - 项目摘要

## 项目概述
这是一个基于 **LangGraph** 框架的电商智能客服系统，支持多轮对话客服、知识库管理、文档知识生成、知能对话、聊天记录、客服模板、转人工设置和商店配置等核心功能。

## 技术栈

### 后端
- **Web 框架**: FastAPI (>=0.115)
- **ASGI 服务器**: Uvicorn (>=0.30)
- **ORM**: SQLAlchemy (async) (>=2.0.30)
- **数据库驱动**: asyncpg (>=0.29)
- **向量数据库**: ChromaDB (>=0.5)
- **AI 框架**: LangChain (>=0.3)
- **Agent 框架**: LangGraph (>=0.2)
- **LLM SDK**: langchain-openai (>=0.2)
- **数据校验**: Pydantic (>=2.7)
- **配置管理**: pydantic-settings (>=2.3)
- **文件解析**: python-docx, openpyxl, pandas, aiofiles
- **缓存**: Redis (>=5.0) - 已配置但未使用

### 前端
- **框架**: React (18.3)
- **构建工具**: Vite (5.3)
- **类型系统**: TypeScript (5.5)
- **CSS 框架**: Tailwind CSS (3.4)
- **图标库**: lucide-react (0.400)
- **工具函数**: clsx (2.1)

### 基础设施
- **关系数据库**: PostgreSQL
- **向量数据库**: ChromaDB (Persistent)
- **LLM 平台**: 阿里云百炼 (DashScope) - 千问系列模型
- **通信协议**: OpenAI 兼容 API

## 系统架构
采用分层架构：
1. 前端 (React) - 端口 3000
2. 后端 (FastAPI) - 端口 8000 (通过 Vite proxy)
3. 数据层 - PostgreSQL (7 张表)、ChromaDB (向量存储)、Redis (已配置未使用)

## 核心功能模块
1. **智能对话** - 多轮对话客服，带 RAG 和会话记忆
2. **知识库管理** - 创建/管理知识库，上传文档，自动分块向量化
3. **文档知识** - 根据产品信息自动生成营销文案（AI Copywriting）
4. **知能对话** - 预设问答对管理，支持树形分组
5. **聊天记录** - 历史会话查看、AI回复编辑、选择性保存为预设对话
6. **客服模版** - 客服回复模板管理
7. **转人工设置** - 关键词触发规则，支持人工转接
8. **商店配置** - 预留模块（开发中）

## 后端详解
- **FastAPI 入口**: 使用 lifespan 上下文管理器管理生命周期
- **配置系统**: 使用 pydantic-settings 的 BaseSettings 从 .env 读取环境变量
- **服务层**:
  - KnowledgeService: 知识库管理 + RAG 摄入
  - MemoryService: 会话记忆管理（核心）
  - DialogService: 预设对话匹配
  - TemplateService: 模版业务逻辑
- **LLM 工厂**: 使用 langchain-openai 的 ChatOpenAI 类，通过 base_url 指向 DashScope 的 OpenAI 兼容端点

## 前端详解
- **技术选型**: React + TypeScript + Vite + Tailwind CSS，无路由库（使用 useState 条件渲染）
- **组件树**: App → ModuleDashboard (首页) → 各模块页面
- **状态管理**: 纯 React 本地状态，跨组件共享通过 props drilling，跨会话持久化通过 localStorage
- **API 层**: 统一的 request<T>() 函数，封装了 28 个 API 调用
- **暗金主题**: Tailwind 自定义色板，主要色彩为 #B8860B (primary)

## 数据库设计
### PostgreSQL 表结构（7 张表）
1. knowledge_bases - 知识库
2. knowledge_documents - 知识库文档
3. templates - 客服模版
4. preset_dialogs - 预设问答（知能对话）
5. transfer_rules - 转人工规则
6. conversations - 会话
7. messages - 消息

### ChromaDB 向量存储
- 客户端类型：PersistentClient（本地文件持久化，目录 ./chroma_data）
- 集合命名：每个知识库对应一个集合，命名为 kb_{knowledge_base_id}
- 文档块：以 {file_id}_chunk_{i} 为 ID 存储

## 记忆系统设计
围绕**会话（Conversation）**概念设计，每个会话代表一个独立客户的完整咨询过程。

### 会话生命周期
1. 客户首次发消息 → 创建会话，自动分配"客户N"编号
2. 每次对话轮次：添加用户消息和AI回复，更新计数和标题
3. 每次对话后检查压缩：超过40条消息时触发LLM压缩
4. 后台定时任务：每10分钟删除10天前的过期会话

### 压缩算法
- 触发条件：未压缩消息数 > 40
- 步骤：
  1. 计算需要压缩的消息数：excess = 未压缩数 - 20
  2. 取出最旧的 excess 条消息
  3. 调用 LLM (temperature=0.1) 生成摘要（≤200字）
  4. 将旧消息标记为 is_summarized=True
  5. 更新 conv.summary = 新摘要

### 上下文注入
当 Agent 生成回复时，上下文按以下顺序组装：
[System Prompt] → [对话摘要] → [最近未压缩消息] → [当前用户消息]

## RAG 工程
RAG（Retrieval-Augmented Generation）是系统核心能力。

### 文档摄入管道
1. 用户上传文件 → 保存原始文件
2. 解析文件为纯文本（支持 .txt/.md/.json/.docx/.csv/.xlsx）
3. 文本分块：500字符块 + 50字符重叠的滑动窗口
4. 向量化并存储到 ChromaDB
5. 在 PostgreSQL 记录 KnowledgeDocument

### 检索流程（对话时）
1. 用户消息 → ChromaDB 查询 (n_results=5)
2. 返回相关文档块
3. 注入 LLM 上下文：System Prompt += "## 知识库参考资料:\n" + docs_text
4. LLM 基于参考文档生成回复

### 当前局限
- 嵌入不匹配：ChromaDB 使用内置的 all-MiniLM-L6-v2（英文模型），未启用配置的 text-embedding-v2（中文模型）
- 简单分块：字符级滑动窗口，不按句子/段落边界分割
- 无重排序：检索结果直接按 ChromaDB 默认相关度排序，无 reranker

## LangGraph Agent
### ChatAgent（对话 Agent）
**图结构**：START → retrieve → match_presets → generate → END
- retrieve：从 ChromaDB 检索相关知识
- match_presets：预设匹配（实际匹配逻辑在路由层通过 SQL ILIKE 提前完成）
- generate：组装上下文 + 调用 LLM 生成回复

**State 定义**：
- messages：对话消息列表
- knowledge_base_id：当前知识库 ID
- template_content：客服模版内容
- conversation_id：会话 ID
- retrieved_docs：检索到的文档块
- preset_matches：预设对话匹配结果
- final_response：Agent 最终回复

### CopywritingAgent（文案生成 Agent）
**图结构**：START → generate → END
- generate：填充产品信息 → LLM 生成文案
- _should_revise()：始终返回 "done"

**State 定义**：
- product_name/type/features/price/promotion/audience/stock：产品信息输入
- generated_copy：LLM 生成的营销文案
- revision_history：修订历史（预留，未使用）

**提示模板**：结构化的中文电商文案 Prompt，要求包含产品标题、卖点提炼、详细描述、促销引导四部分，300-500字，Markdown格式。

### Agent 调用方式
两个 Agent 都使用单例模式，在 FastAPI 路由中通过 get_chat_agent() 获取单例，然后调用 agent.chat(...)。

## API 接口总览
系统共有 30 个 API 端点，分布在 6 个路由模块中：

### 知识库管理（8 个端点）
- GET/POST /api/knowledge-bases：列出/创建知识库
- GET/PUT/DELETE /api/knowledge-bases/{id}：获取/更新/删除知识库
- POST /api/knowledge-bases/{id}/upload：上传文件到知识库
- POST /api/knowledge-bases/{id}/add-text：添加纯文本到知识库
- GET /api/health：健康检查

### 客服模版（5 个端点）
- GET/POST /api/templates：列出/创建模版
- GET/PUT/DELETE /api/templates/{id}：获取/更新/删除模版

### 知能对话（5 个端点）
- GET/POST /api/dialogs：列出/创建预设对话
- GET/PUT/DELETE /api/dialogs/{id}：获取/更新/删除预设对话

### 转人工设置（4 个端点）
- GET/POST /api/transfer-rules：列出/创建规则
- PUT/DELETE /api/transfer-rules/{id}：更新/删除规则

### 智能对话（3 个端点）
- POST /api/chat：多轮对话（核心端点）
- POST /api/copywriting/generate：生成产品营销文案
- POST /api/copywriting/save：保存文案到知识库

### 会话管理（5 个端点）
- GET /api/conversations：列出活跃会话
- GET /api/conversations/{id}：获取会话详情（含消息）
- DELETE /api/conversations/{id}：删除会话
- PUT /api/conversations/{id}/messages/{msg_id}：编辑消息内容
- POST /api/conversations/{id}/save-as-dialog：保存问答对为预设对话

## 前后端对接
### 开发环境
- 前端开发服务器：http://localhost:3000（Vite）
- 后端 API 服务器：http://localhost:8000（Uvicorn）
- Vite 配置了 proxy：所有 /api/* 请求代理到 http://localhost:8000

### 数据流示例（发送消息）
1. 用户在 ChatPage 输入框输入消息，点击发送
2. ChatPage.tsx handleSend()：乐观更新消息列表 → 调用 chatApi.send()
3. fetch('/api/chat', { method: 'POST', body: JSON.stringify(...) })
4. Vite Dev Server → proxy → http://localhost:8000/api/chat
5. FastAPI Router → chat.py → chat()：
   - MemoryService.create_conversation() / get_conversation()
   - DialogService.search() → ILIKE 匹配预设 → 匹配则直接返回
   - MemoryService.load_history() → 加载历史消息 + 摘要
   - ChatAgent.chat() → retrieve → generate → LLM 回复
   - MemoryService.add_message() ×2 (user + assistant)
   - MemoryService.maybe_compress()
   - 返回 ChatResponse { reply, conversation_id }
6. Frontend ChatPage: setMessages(prev => [...prev, {role:'assistant', content: reply}])
7. React 重新渲染，显示新消息气泡

### 前端会话持久化
- conversation_id 存在 localStorage key current_conversation_id
- 页面刷新后，ChatPage 从 localStorage 读取 ID 并调用 conversationApi.get(id) 恢复消息
- "新建会话"按钮清除 localStorage 并重置消息列表

## 部署与运行
### 环境要求
- Python >= 3.11
- Node.js >= 18
- PostgreSQL（需要创建 customer_agent 数据库）
- 阿里云百炼 API Key（DashScope）

### 启动步骤
1. 配置后端环境变量：cp .env.example .env → 编辑 .env：填入 DASHSCOPE_API_KEY、数据库密码等
2. 安装后端依赖：pip install -e .
3. 创建数据库：PostgreSQL 中执行: CREATE DATABASE customer_agent;
4. 启动后端：python main.py → http://localhost:8000 → Swagger 文档: http://localhost:8000/docs
5. 安装前端依赖：cd frontend → npm install
6. 启动前端：npm run dev → http://localhost:3000

### 生产构建
- 前端构建：cd frontend && npm run build → 产物在 frontend/dist/
- 后端可直接运行：修改 .env: DEBUG=false → python main.py

## 已知局限与改进方向
### 已知局限
| 问题 | 影响 | 建议 |
|------|------|------|
| ChromaDB 使用默认英文嵌入模型 | 中文检索质量可能不佳 | 显式传入 text-embedding-v2 的嵌入函数 |
| 分块为简单字符滑动窗口 | 可能在句子中间截断 | 使用 LangChain 的 RecursiveCharacterTextSplitter |
| 无 reranker | 检索精度受限 | 引入 Cross-Encoder 重排序 |
| Redis 已配置但未使用 | 无缓存层，重复请求重复计算 | 添加对话缓存或限流 |
| 预设匹配使用 ILIKE 而非语义搜索 | 无法匹配同义表达 | 使用嵌入向量做语义匹配 |
| 无 token 预算管理 | 长对话可能超出 LLM 上下文窗口 | 动态追踪 token 数，超出时强制压缩 |
| 文案 Agent 的 Revise 节点为空 | 无法根据反馈修改文案 | 实现用户反馈环路 |
| 无用户认证/授权 | 所有 API 对外开放 | 添加 JWT 认证中间件 |
| 前端无路由 | URL 不反映当前页面 | 引入 React Router |

### 改进方向
1. 嵌入模型统一：显式配置 ChromaDB 使用 DashScope 的 text-embedding-v2
2. 分块优化：引入语义分块，按段落/句子边界分割
3. Reranker：使用 Cross-Encoder 对检索结果重排序
4. 缓存层：利用 Redis 缓存常见问题的回复
5. 语义预设匹配：将预设对话也向量化，用语义搜索替代 ILIKE
6. 动态 Token 管理：监控上下文 token 数，超出时自动触发压缩
7. 用户系统：添加多租户/多用户支持
8. 前端路由：引入 React Router，支持 URL 导航和浏览器前进/后退

## 结论
这个电商智能客服系统展示了如何将现代 AI 技术（LangGraph、RAG、LLM）与传统 Web 开发栈（FastAPI、React、PostgreSQL）结合，创建一个功能完整的客服解决方案。尽管存在一些局限性（如嵌入模型不匹配、简单分块等），但系统架构清晰、模块化设计良好，为未来的改进提供了坚实的基础。