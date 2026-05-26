import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Send, Bot, User, Plus, MessageCircle } from 'lucide-react';
import {
  knowledgeApi, templateApi, chatApi, conversationApi,
  type KBItem, type Template, type ConversationListItem, type MessageOut,
} from '../services/api';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: string[];
}

const STORAGE_KEY = 'current_conversation_id';

export default function ChatPage() {
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [templateList, setTemplateList] = useState<Template[]>([]);
  const [selectedKbId, setSelectedKbId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [convId, setConvId] = useState<string | null>(localStorage.getItem(STORAGE_KEY));
  const [convList, setConvList] = useState<ConversationListItem[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    knowledgeApi.list().then(setKbList).catch(console.error);
    templateApi.list().then(setTemplateList).catch(console.error);
    loadConvList();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (convId) {
      conversationApi.get(convId).then((detail) => {
        setMessages(
          detail.messages.map((m: MessageOut) => ({
            role: m.role as Message['role'],
            content: m.content,
          })),
        );
      }).catch(() => {
        localStorage.removeItem(STORAGE_KEY);
        setConvId(null);
      });
    }
  }, [convId]);

  async function loadConvList() {
    try {
      setConvList(await conversationApi.list());
    } catch {
      // silent
    }
  }

  function saveConvId(id: string) {
    localStorage.setItem(STORAGE_KEY, id);
    setConvId(id);
  }

  function switchConversation(id: string) {
    if (id === convId) return;
    saveConvId(id);
  }

  async function handleSend() {
    const msg = input.trim();
    if (!msg || !selectedKbId || !selectedTemplateId || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    setInput('');
    setSending(true);

    try {
      const res = await chatApi.send({
        knowledge_base_id: selectedKbId,
        template_id: selectedTemplateId,
        message: msg,
        conversation_id: convId,
      });

      if (!convId) saveConvId(res.conversation_id);

      setMessages((prev) => [...prev, { role: 'assistant', content: res.reply, sources: res.sources }]);
      loadConvList(); // refresh sidebar
    } catch (e: any) {
      setMessages((prev) => [...prev, { role: 'assistant', content: '抱歉，请求失败: ' + e.message }]);
    } finally {
      setSending(false);
    }
  }

  function handleNewConversation() {
    localStorage.removeItem(STORAGE_KEY);
    setConvId(null);
    setMessages([]);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function formatTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-4 min-h-0">
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-56 bg-white border border-gray-200 rounded-lg shadow-sm shrink-0 flex flex-col min-h-0">
          <div className="p-4 shrink-0">
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">请选择知识库</label>
              <div className="relative">
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={selectedKbId}
                  onChange={(e) => setSelectedKbId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {kbList.map((kb) => (
                    <option key={kb.id} value={kb.id}>{kb.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>
            </div>
            <div className="mb-3">
              <label className="block text-sm text-gray-600 mb-1">请选择客服模版</label>
              <div className="relative">
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={selectedTemplateId}
                  onChange={(e) => setSelectedTemplateId(e.target.value)}
                >
                  <option value="">请选择</option>
                  {templateList.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
              </div>
            </div>
            <button
              className="w-full py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors flex items-center justify-center space-x-1"
              onClick={handleNewConversation}
            >
              <Plus size={14} />
              <span>新建会话</span>
            </button>
          </div>

          {/* Conversation list */}
          <div className="border-t border-gray-100 px-3 py-2 flex-1 overflow-y-auto">
            <div className="text-xs text-gray-400 mb-2 px-1">会话列表</div>
            {convList.length === 0 ? (
              <div className="text-xs text-gray-400 text-center py-4">
                暂无历史会话
              </div>
            ) : (
              convList.map((c) => (
                <div
                  key={c.id}
                  onClick={() => switchConversation(c.id)}
                  className={`px-3 py-2 rounded-lg mb-1 cursor-pointer transition-colors ${
                    c.id === convId
                      ? 'bg-gold-50 border border-gold-200'
                      : 'hover:bg-gray-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <MessageCircle size={14} className={c.id === convId ? 'text-primary' : 'text-gray-400'} />
                    <span className={`text-sm font-medium truncate ${c.id === convId ? 'text-primary' : 'text-gray-700'}`}>
                      {c.customer_label || c.title || '未命名会话'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-gray-400">{c.message_count} 条消息</span>
                    <span className="text-xs text-gray-300">{formatTime(c.updated_at)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 ml-4 bg-white border border-gray-200 rounded-lg shadow-sm flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="text-center text-gray-400 mt-20">
                <Bot size={48} className="mx-auto mb-3 text-gray-300" />
                <p>选择知识库和模板后，开始与智能客服对话</p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex items-start space-x-2 max-w-[70%] ${m.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      m.role === 'user' ? 'bg-gold-100' : m.role === 'system' ? 'bg-yellow-100' : 'bg-gray-100'
                    }`}>
                      {m.role === 'user' ? <User size={16} className="text-gold-700" /> : <Bot size={16} className="text-gray-600" />}
                    </div>
                    <div className={`px-4 py-2 rounded-lg text-sm ${
                      m.role === 'user' ? 'bg-primary text-white'
                        : m.role === 'system' ? 'bg-yellow-50 text-gray-600 italic border border-yellow-200'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      <div className="whitespace-pre-wrap">{m.content}</div>
                      {m.sources && m.sources.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-200 text-xs text-gray-500">
                          {m.sources.map((s, j) => <div key={j}>📎 {s}</div>)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="mt-4">
        <div className="bg-white border border-gray-200 rounded-lg p-3 flex items-center shadow-sm">
          <input
            type="text"
            placeholder="请输入对话内容，换行请使用 shift+enter"
            className="flex-1 px-3 py-2 text-sm focus:outline-none"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!selectedKbId || !selectedTemplateId}
          />
          <button
            className="ml-2 bg-primary text-white px-6 py-2 rounded text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center space-x-1"
            disabled={!input.trim() || sending || !selectedKbId || !selectedTemplateId}
            onClick={handleSend}
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Send size={14} />
            )}
            <span>{sending ? '发送中' : '发送'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
