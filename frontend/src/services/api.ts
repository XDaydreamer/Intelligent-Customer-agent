const BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Knowledge Base ────────────────────────────────────
export interface KBCreate {
  name: string;
  description: string;
}
export interface KBDocument {
  id: string;
  filename: string;
  file_type: string;
  chunk_count: number;
  created_at: string;
}
export interface KBItem {
  id: string;
  name: string;
  description: string | null;
  document_count: number;
  created_at: string;
}
export interface KBDetail {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  documents: KBDocument[];
}

export const knowledgeApi = {
  list: () => request<KBItem[]>('/knowledge-bases'),
  get: (id: string) => request<KBDetail>(`/knowledge-bases/${id}`),
  create: (data: KBCreate) => request<KBDetail>('/knowledge-bases', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<KBCreate>) =>
    request<KBDetail>(`/knowledge-bases/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/knowledge-bases/${id}`, { method: 'DELETE' }),
  upload: (kbId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/knowledge-bases/${kbId}/upload`, { method: 'POST', body: form }).then((res) => {
      if (!res.ok) throw new Error('Upload failed');
      return res.json();
    });
  },
  addText: (kbId: string, text: string, filename: string) =>
    request<{ id: string; filename: string; chunk_count: number }>(
      `/knowledge-bases/${kbId}/add-text`,
      { method: 'POST', body: JSON.stringify({ text, filename }) },
    ),
};

// ─── Templates ─────────────────────────────────────────
export interface Template {
  id: string;
  name: string;
  content: string;
  intro: string;
  updated_at: string;
  created_at: string;
}
export interface TemplateCreate {
  name: string;
  content: string;
  intro: string;
}

export const templateApi = {
  list: () => request<Template[]>('/templates'),
  get: (id: string) => request<Template>(`/templates/${id}`),
  create: (data: TemplateCreate) => request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<TemplateCreate>) =>
    request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/templates/${id}`, { method: 'DELETE' }),
};

// ─── Preset Dialogs ────────────────────────────────────
export interface PresetDialog {
  id: string;
  question: string;
  answer: string;
  shop: string | null;
  parent_id: string | null;
  children: PresetDialog[];
  created_at: string;
  updated_at: string;
}
export interface DialogCreate {
  question: string;
  answer: string;
  shop?: string;
  parent_id?: string;
}

export const dialogApi = {
  list: () => request<PresetDialog[]>('/dialogs'),
  get: (id: string) => request<PresetDialog>(`/dialogs/${id}`),
  create: (data: DialogCreate) => request<PresetDialog>('/dialogs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<DialogCreate>) =>
    request<PresetDialog>(`/dialogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/dialogs/${id}`, { method: 'DELETE' }),
};

// ─── Transfer Rules ────────────────────────────────────
export interface TransferRule {
  id: string;
  keyword: string;
  reply: string;
  enabled: boolean;
  created_at: string;
}

export const transferRuleApi = {
  list: () => request<TransferRule[]>('/transfer-rules'),
  create: (data: { keyword: string; reply: string; enabled: boolean }) =>
    request<TransferRule>('/transfer-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: Partial<{ keyword: string; reply: string; enabled: boolean }>) =>
    request<TransferRule>(`/transfer-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) => request<void>(`/transfer-rules/${id}`, { method: 'DELETE' }),
};

// ─── Chat ──────────────────────────────────────────────
export interface ChatRequest {
  knowledge_base_id: string;
  template_id: string;
  message: string;
  conversation_id?: string | null;
}
export interface ChatResponse {
  reply: string;
  sources: string[];
  conversation_id: string;
}

export const chatApi = {
  send: (data: ChatRequest) => request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify(data) }),
};

// ─── Conversations ─────────────────────────────────────
export interface ConversationListItem {
  id: string;
  title: string | null;
  customer_label: string | null;
  message_count: number;
  updated_at: string;
}
export interface MessageOut {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  is_summarized: boolean;
  created_at: string;
}
export interface ConversationDetail extends ConversationListItem {
  summary: string | null;
  is_active: boolean;
  created_at: string;
  messages: MessageOut[];
}

export const conversationApi = {
  list: () => request<ConversationListItem[]>('/conversations'),
  get: (id: string) => request<ConversationDetail>(`/conversations/${id}`),
  delete: (id: string) => request<void>(`/conversations/${id}`, { method: 'DELETE' }),
  updateMessage: (convId: string, msgId: string, content: string) =>
    request<MessageOut>(`/conversations/${convId}/messages/${msgId}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    }),
  saveAsDialog: (convId: string, messageIds: string[]) =>
    request<{ created: number }>(`/conversations/${convId}/save-as-dialog`, {
      method: 'POST',
      body: JSON.stringify({ message_ids: messageIds }),
    }),
};

// ─── Copywriting ───────────────────────────────────────
export interface CopywritingRequest {
  product_name: string;
  product_type: string;
  product_features?: string;
  product_price?: string;
  promotion_info?: string;
  target_audience?: string;
  stock_status?: string;
}
export interface CopywritingResponse {
  content: string;
}

export const copywritingApi = {
  generate: (data: CopywritingRequest) =>
    request<CopywritingResponse>('/copywriting/generate', { method: 'POST', body: JSON.stringify(data) }),
  save: (data: { content: string; knowledge_base_id: string; filename: string }) =>
    request<{ id: string; filename: string }>('/copywriting/save', { method: 'POST', body: JSON.stringify(data) }),
};
