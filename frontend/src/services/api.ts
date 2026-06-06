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

// ─── Copywriting Workflow ───────────────────────────────

export interface CopywritingSessionListItem {
  id: string;
  title: string | null;
  status: string;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface CopywritingMessageOut {
  id: string;
  session_id: string;
  role: string;
  content: string;
  created_at: string;
}

export interface CopywritingSessionDetail extends CopywritingSessionListItem {
  generated_copy: string;
  next_action: string;
  manager_question: string;
  messages: CopywritingMessageOut[];
}

export interface SessionStartResponse {
  session_id: string;
  agent_message: CopywritingMessageOut;
  next_action: string;
}

export interface SessionSendResponse {
  agent_message: CopywritingMessageOut;
  next_action: string;
  generated_copy: string;
}

export interface ComplianceRule {
  id: string;
  title: string;
  content: string;
  source_type: string;
  file_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadRuleResponse {
  status: string;
  similarity: number;
  similar_rule_id: string | null;
  similar_rule_title: string | null;
  rule: ComplianceRule | null;
}

export interface ImageOut {
  image_id: string;
  filename: string;
  preview_url: string;
}

export const copywritingWorkflowApi = {
  start: (data: { title?: string; initial_message: string }) =>
    request<SessionStartResponse>('/copywriting/workflow/start', {
      method: 'POST', body: JSON.stringify(data),
    }),
  send: (sessionId: string, message: string) =>
    request<SessionSendResponse>(`/copywriting/workflow/${sessionId}/send`, {
      method: 'POST', body: JSON.stringify({ message }),
    }),
  getSession: (sessionId: string) =>
    request<CopywritingSessionDetail>(`/copywriting/workflow/${sessionId}`),
  listSessions: () =>
    request<CopywritingSessionListItem[]>('/copywriting/workflow'),
  deleteSession: (sessionId: string) =>
    request<void>(`/copywriting/workflow/${sessionId}`, { method: 'DELETE' }),
  exportCopy: (sessionId: string) =>
    request<{ content: string }>(`/copywriting/workflow/${sessionId}/export`),
  saveToKb: (sessionId: string, knowledgeBaseId: string, filename: string) =>
    request<{ id: string; filename: string }>(
      `/copywriting/workflow/${sessionId}/save-to-kb`,
      { method: 'POST', body: JSON.stringify({ knowledge_base_id: knowledgeBaseId, filename }) },
    ),
  // Images
  uploadImages: (sessionId: string, files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('files', f));
    return fetch(`/api/copywriting/workflow/${sessionId}/images`, {
      method: 'POST',
      body: form,
    }).then((res) => {
      if (!res.ok) return res.json().then((err) => { throw new Error(err.detail || 'Upload failed'); });
      return res.json() as Promise<ImageOut[]>;
    });
  },
  listImages: (sessionId: string) =>
    request<{ images: ImageOut[] }>(`/copywriting/workflow/${sessionId}/images`),
  deleteImage: (sessionId: string, imageId: string) =>
    request<void>(`/copywriting/workflow/${sessionId}/images/${imageId}`, { method: 'DELETE' }),
  getImageUrl: (sessionId: string, imageId: string) =>
    `/api/copywriting/workflow/${sessionId}/images/${imageId}`,
};

export const complianceRuleApi = {
  list: () => request<ComplianceRule[]>('/compliance-rules'),
  create: (data: { title: string; content: string; source_type?: string }) =>
    request<ComplianceRule>('/compliance-rules', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: { title?: string; content?: string }) =>
    request<ComplianceRule>(`/compliance-rules/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: string) =>
    request<void>(`/compliance-rules/${id}`, { method: 'DELETE' }),
  upload: (file: File, force: boolean = false) => {
    const form = new FormData();
    form.append('file', file);
    return fetch(`/api/compliance-rules/upload${force ? '?force=true' : ''}`, {
      method: 'POST',
      body: form,
    }).then((res) => {
      if (!res.ok) {
        return res.json().then((err) => { throw new Error(err.detail || 'Upload failed'); });
      }
      return res.json() as Promise<UploadRuleResponse>;
    });
  },
  getFileUrl: (id: string) => `/api/compliance-rules/${id}/file`,
};
