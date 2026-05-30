import { useState, useEffect, useRef } from 'react';
import { Send, Shield, Eye, Download, PlusCircle, Plus, X, Edit3, Trash2, FileText, Upload as UploadIcon } from 'lucide-react';
import { copywritingWorkflowApi, complianceRuleApi, knowledgeApi, type KBItem, type ComplianceRule, type UploadRuleResponse } from '../services/api';

interface Message {
  role: 'user' | 'agent';
  content: string;
}

export default function CopywritingChatPage() {
  const [sessionId, setSessionId] = useState<string | null>(() => {
    return localStorage.getItem('cw_session_id');
  });
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [phase, setPhase] = useState<'idle' | 'gathering' | 'generated'>('idle');
  const [error, setError] = useState('');

  // Modals
  const [showRules, setShowRules] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editedCopy, setEditedCopy] = useState('');

  // Compliance rules
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [ruleTitle, setRuleTitle] = useState('');
  const [ruleContent, setRuleContent] = useState('');
  const [showRuleForm, setShowRuleForm] = useState(false);

  // Save to KB
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [saveTargetKbId, setSaveTargetKbId] = useState('');
  const [saveFilename, setSaveFilename] = useState('product_copy.md');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // File upload for rules
  const [uploadingRule, setUploadingRule] = useState(false);
  const [uploadWarning, setUploadWarning] = useState<UploadRuleResponse | null>(null);
  const [fileViewerOpen, setFileViewerOpen] = useState(false);
  const [fileViewerTitle, setFileViewerTitle] = useState('');
  const [fileViewerContent, setFileViewerContent] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    knowledgeApi.list().then(setKbList).catch(console.error);
    if (sessionId) restoreSession();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function restoreSession() {
    try {
      const detail = await copywritingWorkflowApi.getSession(sessionId!);
      setMessages(detail.messages.map((m) => ({ role: m.role as 'user' | 'agent', content: m.content })));
      setGeneratedCopy(detail.generated_copy || '');
      if (detail.next_action === 'done' || detail.status === 'completed') {
        setPhase('generated');
      } else {
        setPhase('gathering');
      }
    } catch {
      localStorage.removeItem('cw_session_id');
      setSessionId(null);
    }
  }

  async function loadRules() {
    try {
      const list = await complianceRuleApi.list();
      setRules(list);
    } catch (e: any) {
      console.error('加载规则失败:', e);
    }
  }

  async function handleSend() {
    const msg = input.trim();
    if (!msg || sending) return;
    setInput('');
    setError('');
    setSending(true);

    try {
      if (!sessionId) {
        // Start new session
        const res = await copywritingWorkflowApi.start({ initial_message: msg });
        setSessionId(res.session_id);
        localStorage.setItem('cw_session_id', res.session_id);
        setMessages([
          { role: 'user', content: msg },
          { role: 'agent', content: res.agent_message.content },
        ]);
        if (res.next_action === 'done') {
          setPhase('generated');
          // Generated copy is the agent message content when done
          const detail = await copywritingWorkflowApi.getSession(res.session_id);
          setGeneratedCopy(detail.generated_copy || '');
        } else {
          setPhase('gathering');
        }
      } else {
        // Continue existing session
        const res = await copywritingWorkflowApi.send(sessionId, msg);
        const newMessages: Message[] = [
          ...messages,
          { role: 'user', content: msg },
          { role: 'agent', content: res.agent_message.content },
        ];
        setMessages(newMessages);
        if (res.next_action === 'done') {
          setPhase('generated');
          setGeneratedCopy(res.generated_copy);
          // Update the last agent message with the real generated copy if needed
          if (!res.generated_copy && res.agent_message.content) {
            setGeneratedCopy(res.agent_message.content);
          } else {
            setGeneratedCopy(res.generated_copy);
          }
        }
      }
    } catch (e: any) {
      if (e.message.includes('404')) {
        // Session gone, reset
        resetSession();
      }
      setError(e.message);
    } finally {
      setSending(false);
    }
  }

  function resetSession() {
    setSessionId(null);
    localStorage.removeItem('cw_session_id');
    setMessages([]);
    setGeneratedCopy('');
    setPhase('idle');
    setError('');
    setSaveMsg('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Download ──
  async function handleDownload() {
    if (!sessionId) return;
    try {
      const res = await copywritingWorkflowApi.exportCopy(sessionId);
      const blob = new Blob([res.content], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = saveFilename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError('下载失败: ' + e.message);
    }
  }

  // ── Save to KB ──
  async function handleSaveToKb() {
    if (!saveTargetKbId || !sessionId) {
      setSaveMsg('请选择目标知识库');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await copywritingWorkflowApi.saveToKb(sessionId, saveTargetKbId, saveFilename);
      setSaveMsg('已保存到知识库!');
    } catch (e: any) {
      setSaveMsg('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Preview ──
  function openPreview() {
    setEditedCopy(generatedCopy);
    setShowPreview(true);
  }

  // ── Compliance Rules CRUD ──
  function openRules() {
    loadRules();
    setShowRules(true);
    setShowRuleForm(false);
    setEditingRule(null);
  }

  async function handleCreateRule() {
    if (!ruleTitle.trim() || !ruleContent.trim()) return;
    try {
      await complianceRuleApi.create({ title: ruleTitle.trim(), content: ruleContent.trim() });
      setRuleTitle('');
      setRuleContent('');
      setShowRuleForm(false);
      await loadRules();
    } catch (e: any) {
      setError('创建规则失败: ' + e.message);
    }
  }

  async function handleUpdateRule() {
    if (!editingRule || !ruleTitle.trim() || !ruleContent.trim()) return;
    try {
      await complianceRuleApi.update(editingRule.id, { title: ruleTitle.trim(), content: ruleContent.trim() });
      setEditingRule(null);
      setRuleTitle('');
      setRuleContent('');
      setShowRuleForm(false);
      await loadRules();
    } catch (e: any) {
      setError('更新规则失败: ' + e.message);
    }
  }

  async function handleDeleteRule(id: string) {
    if (!confirm('确定删除该规则?')) return;
    try {
      await complianceRuleApi.delete(id);
      await loadRules();
    } catch (e: any) {
      setError('删除规则失败: ' + e.message);
    }
  }

  function startEditRule(rule: ComplianceRule) {
    setEditingRule(rule);
    setRuleTitle(rule.title);
    setRuleContent(rule.content);
    setShowRuleForm(true);
  }

  function cancelRuleForm() {
    setEditingRule(null);
    setRuleTitle('');
    setRuleContent('');
    setShowRuleForm(false);
  }

  // ── File Upload for Rules ──

  function handleUploadClick() {
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingRule(true);
    setError('');
    try {
      const res = await complianceRuleApi.upload(file);
      if (res.status === 'created' && res.rule) {
        setRuleTitle(res.rule.title);
        setRuleContent(res.rule.content);
        setShowRuleForm(true);
        await loadRules();
      } else if (res.status === 'duplicate') {
        alert(`规则内容与已有规则"${res.similar_rule_title}"高度相似 (${Math.round(res.similarity * 100)}%)，建议不重复创建。`);
      } else if (res.status === 'warning') {
        setUploadWarning(res);
      }
    } catch (e: any) {
      setError('文件上传失败: ' + e.message);
    } finally {
      setUploadingRule(false);
      // Reset file input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleForceUpload() {
    if (!fileInputRef.current?.files?.[0]) return;
    const file = fileInputRef.current.files[0];
    setUploadWarning(null);
    setUploadingRule(true);
    try {
      const res = await complianceRuleApi.upload(file, true);
      if (res.status === 'created' && res.rule) {
        setRuleTitle(res.rule.title);
        setRuleContent(res.rule.content);
        setShowRuleForm(true);
        await loadRules();
      }
    } catch (e: any) {
      setError('文件上传失败: ' + e.message);
    } finally {
      setUploadingRule(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleViewFile(rule: ComplianceRule) {
    if (!rule.file_path) return;
    try {
      const url = complianceRuleApi.getFileUrl(rule.id);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('File not found');
      const text = await resp.text();
      setFileViewerTitle(rule.title);
      setFileViewerContent(text);
      setFileViewerOpen(true);
    } catch (e: any) {
      setError('无法查看文件: ' + e.message);
    }
  }

  // ── Render ──

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-100 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">文案生成系统</h1>
          <p className="text-xs text-gray-400">通过对话方式，AI 帮你生成产品营销文案</p>
        </div>
        <div className="flex items-center space-x-2">
          {sessionId && (
            <button
              onClick={resetSession}
              className="flex items-center space-x-1 px-3 py-1.5 border rounded-lg text-sm text-gray-500 hover:text-primary hover:border-primary transition-colors"
            >
              <Plus size={14} />
              <span>新建会话</span>
            </button>
          )}
          <button
            onClick={openRules}
            className="flex items-center space-x-1 px-3 py-1.5 border rounded-lg text-sm text-gray-500 hover:text-primary hover:border-primary transition-colors"
          >
            <Shield size={14} />
            <span>规则管理</span>
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 max-w-3xl mx-auto w-full">
        {messages.length === 0 && phase === 'idle' && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <FileText size={48} className="mb-4 text-gray-300" />
            <p className="text-lg mb-2">欢迎使用文案生成系统</p>
            <p className="text-sm">在下方输入您的产品信息，AI 会智能追问补充细节，然后为您生成专业营销文案</p>
            <div className="mt-6 text-xs text-gray-400 bg-gray-50 rounded-lg p-4 max-w-md">
              <p className="font-medium mb-1">例如：</p>
              <p>"我想为我的新品牌推出一款防晒霜，价格在100元左右，主要面向年轻女性"</p>
            </div>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-4 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-700 rounded-bl-sm'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-4 py-3">
              <div className="flex items-center space-x-2 text-gray-400 text-sm">
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              </div>
            </div>
          </div>
        )}

        {/* Action Bar — shown when copy is generated */}
        {phase === 'generated' && generatedCopy && (
          <div className="flex items-center space-x-3 mb-4">
            <button
              onClick={openPreview}
              className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm transition-colors shadow-sm"
            >
              <Eye size={16} />
              <span>预览/编辑</span>
            </button>
            <button
              onClick={handleDownload}
              className="flex items-center space-x-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-sm transition-colors shadow-sm"
            >
              <Download size={16} />
              <span>下载 .md</span>
            </button>
            <div className="flex items-center space-x-2 flex-1">
              <select
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white"
                value={saveTargetKbId}
                onChange={(e) => setSaveTargetKbId(e.target.value)}
              >
                <option value="">选择知识库</option>
                {kbList.map((kb) => (
                  <option key={kb.id} value={kb.id}>{kb.name}</option>
                ))}
              </select>
              <button
                onClick={handleSaveToKb}
                disabled={saving}
                className="flex items-center space-x-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 shadow-sm"
              >
                <PlusCircle size={16} />
                <span>{saving ? '保存中...' : '添加到知识库'}</span>
              </button>
            </div>
          </div>
        )}

        {saveMsg && (
          <div className={`mb-4 text-sm ${saveMsg.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>
            {saveMsg}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="px-6 pb-1">
          <div className="text-red-500 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</div>
        </div>
      )}

      {/* Input Bar */}
      <div className="px-6 pb-4 max-w-3xl mx-auto w-full shrink-0">
        <div className="flex space-x-2">
          <textarea
            className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none bg-white"
            rows={2}
            placeholder={
              phase === 'generated'
                ? '文案已生成，点击上方"新建会话"开始新的文案'
                : phase === 'idle'
                  ? '输入您的产品信息...'
                  : '继续补充信息...'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={phase === 'generated'}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending || phase === 'generated'}
            className="px-5 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            <Send size={18} />
          </button>
        </div>
        {phase !== 'generated' && (
          <p className="text-xs text-gray-400 mt-1.5 text-center">按 Enter 发送，Shift+Enter 换行</p>
        )}
      </div>

      {/* ── Preview/Edit Modal ── */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">文案预览与编辑</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowPreview(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <textarea
                className="w-full min-h-[400px] px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none font-mono"
                value={editedCopy}
                onChange={(e) => setEditedCopy(e.target.value)}
              />
            </div>
            <div className="p-4 border-t flex justify-between">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  className="px-3 py-2 border rounded-lg text-sm w-48"
                  value={saveFilename}
                  onChange={(e) => setSaveFilename(e.target.value)}
                />
                <span className="text-xs text-gray-400">.md</span>
              </div>
              <div className="flex space-x-3">
                <button
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                  onClick={() => setShowPreview(false)}
                >
                  取消
                </button>
                <button
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center space-x-1"
                  onClick={() => {
                    setGeneratedCopy(editedCopy);
                    setShowPreview(false);
                  }}
                >
                  <Edit3 size={14} />
                  <span>保存修改</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Compliance Rules Modal ── */}
      {showRules && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">合规规则管理</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowRules(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1">
              {/* Rule form */}
              {showRuleForm && (
                <div className="mb-4 p-4 border border-primary/30 rounded-lg bg-gold-50/50">
                  <h4 className="text-sm font-semibold mb-3">
                    {editingRule ? '编辑规则' : '新建规则'}
                  </h4>
                  <input
                    type="text"
                    placeholder="规则标题"
                    className="w-full px-3 py-2 border rounded-lg text-sm mb-2 focus:outline-none focus:ring-1 focus:ring-primary"
                    value={ruleTitle}
                    onChange={(e) => setRuleTitle(e.target.value)}
                  />
                  <textarea
                    placeholder="规则内容（例如：广告法禁用词汇、合规要求说明等）"
                    rows={5}
                    className="w-full px-3 py-2 border rounded-lg text-sm mb-3 focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                    value={ruleContent}
                    onChange={(e) => setRuleContent(e.target.value)}
                  />
                  <div className="flex space-x-2">
                    <button
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
                      onClick={editingRule ? handleUpdateRule : handleCreateRule}
                    >
                      {editingRule ? '保存修改' : '创建规则'}
                    </button>
                    <button
                      className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 transition-colors"
                      onClick={cancelRuleForm}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* Rule list — action buttons */}
              {!showRuleForm && (
                <div className="flex space-x-2 mb-4">
                  <button
                    className="flex-1 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:text-primary hover:border-primary transition-colors"
                    onClick={() => setShowRuleForm(true)}
                  >
                    + 新建规则
                  </button>
                  <button
                    className="flex items-center justify-center space-x-1 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-400 hover:text-primary hover:border-primary transition-colors"
                    onClick={handleUploadClick}
                    disabled={uploadingRule}
                  >
                    <UploadIcon size={14} />
                    <span>{uploadingRule ? '上传中...' : '上传文件'}</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept=".md,.docx,.txt"
                    onChange={handleFileSelected}
                  />
                </div>
              )}

              {/* Upload warning dialog */}
              {uploadWarning && (
                <div className="mb-4 p-4 border border-yellow-300 rounded-lg bg-yellow-50">
                  <p className="text-sm text-yellow-700 mb-2">
                    与已有规则"<strong>{uploadWarning.similar_rule_title}</strong>"相似度 {Math.round(uploadWarning.similarity * 100)}%，是否仍然创建？
                  </p>
                  <div className="flex space-x-2">
                    <button
                      className="px-3 py-1.5 bg-primary text-white text-sm rounded hover:bg-primary/90"
                      onClick={handleForceUpload}
                    >
                      仍然创建
                    </button>
                    <button
                      className="px-3 py-1.5 border text-sm rounded hover:bg-gray-50"
                      onClick={() => setUploadWarning(null)}
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {rules.length === 0 && !showRuleForm && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  暂无合规规则，点击上方按钮添加
                </div>
              )}

              <div className="space-y-2">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-sm font-medium text-gray-700 truncate">{rule.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          rule.source_type === 'document'
                            ? 'bg-blue-50 text-blue-600'
                            : 'bg-green-50 text-green-600'
                        }`}>
                          {rule.source_type === 'document' ? '文档' : '手动'}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 truncate">{rule.content.slice(0, 100)}</p>
                    </div>
                    <div className="flex items-center space-x-1 ml-3 shrink-0">
                      {rule.source_type === 'document' && rule.file_path && (
                        <button
                          className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                          title="查看原文"
                          onClick={() => handleViewFile(rule)}
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <button
                        className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                        onClick={() => startEditRule(rule)}
                      >
                        <Edit3 size={14} />
                      </button>
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => handleDeleteRule(rule.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── File Viewer Modal ── */}
      {fileViewerOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-xl w-[700px] max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">查看原文: {fileViewerTitle}</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setFileViewerOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <pre className="whitespace-pre-wrap text-sm font-mono text-gray-700 bg-gray-50 rounded-lg p-4 max-h-[60vh] overflow-y-auto">
                {fileViewerContent}
              </pre>
            </div>
            <div className="p-4 border-t flex justify-end">
              <button
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
                onClick={() => setFileViewerOpen(false)}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
