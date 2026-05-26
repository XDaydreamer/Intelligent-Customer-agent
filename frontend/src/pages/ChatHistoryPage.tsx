import { useState, useEffect } from 'react';
import {
  History, MessageCircle, Trash2, RefreshCw,
  Edit3, Check, X, Save, ChevronRight, Bot, User,
} from 'lucide-react';
import {
  conversationApi,
  type ConversationListItem,
  type ConversationDetail,
  type MessageOut,
} from '../services/api';

export default function ChatHistoryPage() {
  // ── Customer list state ──
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ── Detail state ──
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Edit state ──
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // ── Selection for save-as-dialog ──
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadList(); }, []);

  async function loadList() {
    setLoading(true);
    setError('');
    try {
      setConversations(await conversationApi.list());
    } catch (e: any) {
      setError('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectCustomer(id: string) {
    setDetailLoading(true);
    setSelected(null);
    setSelectedIds(new Set());
    setEditingId(null);
    try {
      setSelected(await conversationApi.get(id));
    } catch (e: any) {
      setError('加载详情失败: ' + e.message);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除该会话？')) return;
    try {
      await conversationApi.delete(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  }

  // ── Edit handlers ──
  function startEdit(msg: MessageOut) {
    setEditingId(msg.id);
    setEditContent(msg.content);
  }
  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
  }
  async function saveEdit(msgId: string) {
    if (!selected || !editContent.trim()) return;
    try {
      const updated = await conversationApi.updateMessage(selected.id, msgId, editContent.trim());
      setSelected((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: prev.messages.map((m) => (m.id === msgId ? { ...m, content: updated.content } : m)),
        };
      });
      setEditingId(null);
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    }
  }

  // ── Save as dialog ──
  function toggleSelect(msgId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      return next;
    });
  }
  async function handleSaveAsDialog() {
    if (!selected || selectedIds.size < 2) {
      alert('请至少选择一个问答对（用户消息+AI回复）');
      return;
    }
    setSaving(true);
    try {
      const res = await conversationApi.saveAsDialog(selected.id, [...selectedIds]);
      alert(`成功创建 ${res.created} 个预设对话`);
      setSelectedIds(new Set());
      await loadList(); // refresh
    } catch (e: any) {
      alert('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center text-gray-400">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 px-6 pb-6 min-h-0">
      {/* ── Left: Customer list ── */}
      <div className="w-56 bg-white border border-gray-200 rounded-lg shadow-sm shrink-0 flex flex-col min-h-0 mr-4">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History size={18} className="text-gray-600" />
            <span className="font-semibold text-sm">客户列表</span>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 transition-colors"
            onClick={loadList}
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {error && <div className="text-red-500 text-xs px-2 py-2">{error}</div>}
          {conversations.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageCircle size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-xs">暂无客户记录</p>
            </div>
          ) : (
            conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => selectCustomer(c.id)}
                className={`px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors ${
                  c.id === selected?.id
                    ? 'bg-gold-50 border border-gold-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 min-w-0">
                    <MessageCircle size={14} className={c.id === selected?.id ? 'text-primary' : 'text-gray-400'} />
                    <span className={`text-sm font-medium truncate ${c.id === selected?.id ? 'text-primary' : 'text-gray-700'}`}>
                      {c.customer_label || c.title || '未命名'}
                    </span>
                  </div>
                  <button
                    className="text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-1"
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-gray-400">{c.message_count} 条</span>
                  <span className="text-xs text-gray-300">{formatTime(c.updated_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Right: Conversation detail ── */}
      <div className="flex-1 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col min-h-0">
        {!selected ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <ChevronRight size={48} className="mx-auto mb-3 text-gray-300" />
              <p>选择左侧客户查看聊天记录</p>
            </div>
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-sm">
                  {selected.customer_label || selected.title || '客户'} 的对话
                </h2>
                <p className="text-xs text-gray-500">{selected.messages.length} 条消息</p>
              </div>
              <button
                className={`flex items-center space-x-1 px-3 py-1.5 rounded text-xs transition-colors ${
                  selectedIds.size >= 2
                    ? 'bg-primary text-white hover:bg-primary/90'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                disabled={selectedIds.size < 2 || saving}
                onClick={handleSaveAsDialog}
              >
                <Save size={12} />
                <span>{saving ? '保存中...' : '保存到知能对话'}</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {selected.messages.map((m) => {
                const isEditing = editingId === m.id;
                const isSelected = selectedIds.has(m.id);

                return (
                  <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex items-start space-x-2 max-w-[70%] ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                      {/* Avatar */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        m.role === 'user' ? 'bg-gold-100' : m.is_summarized ? 'bg-yellow-100' : 'bg-gray-100'
                      }`}>
                        {m.role === 'user' ? <User size={14} className="text-gold-700" /> : <Bot size={14} className="text-gray-600" />}
                      </div>

                      {/* Content */}
                      <div className={`px-3 py-2 rounded-lg text-sm ${
                        m.role === 'user'
                          ? 'bg-primary text-white'
                          : m.is_summarized
                            ? 'bg-yellow-50 text-gray-500 italic border border-yellow-200'
                            : 'bg-gray-100 text-gray-800'
                      }`}>
                        {isEditing ? (
                          <div className="min-w-[250px]">
                            <textarea
                              className="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none text-gray-800 bg-white"
                              rows={4}
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              autoFocus
                            />
                            <div className="flex justify-end space-x-2 mt-2">
                              <button
                                className="px-3 py-1 border rounded text-xs hover:bg-gray-50"
                                onClick={cancelEdit}
                              >
                                取消
                              </button>
                              <button
                                className="px-3 py-1 bg-primary text-white rounded text-xs hover:bg-primary/90"
                                onClick={() => saveEdit(m.id)}
                              >
                                保存
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="whitespace-pre-wrap">{m.content}</div>
                            <div className={`flex items-center justify-between mt-1 ${m.role === 'user' ? 'text-white/60' : 'text-gray-400'}`}>
                              <span className="text-xs">
                                {m.is_summarized ? '已压缩' : formatTime(m.created_at)}
                              </span>
                              <div className="flex items-center space-x-2 ml-3">
                                {/* Checkbox for save-as-dialog */}
                                <button
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                                    isSelected ? 'bg-primary border-primary text-white' : 'border-gray-300 hover:border-gold-200'
                                  }`}
                                  onClick={() => toggleSelect(m.id)}
                                  title="选择此消息"
                                >
                                  {isSelected && <Check size={10} />}
                                </button>
                                {/* Edit button (AI messages only) */}
                                {m.role === 'assistant' && !m.is_summarized && (
                                  <button
                                    className="text-gray-400 hover:text-primary transition-colors"
                                    onClick={() => startEdit(m)}
                                    title="编辑"
                                  >
                                    <Edit3 size={12} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
