import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { templateApi, type Template, type TemplateCreate } from '../services/api';

export default function CSTemplatePage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Add state
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newIntro, setNewIntro] = useState('');

  useEffect(() => { loadTemplates(); }, []);

  async function loadTemplates() {
    setLoading(true);
    setError('');
    try {
      setTemplates(await templateApi.list());
    } catch (e: any) {
      setError('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === templates.length && templates.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(templates.map((t) => t.id)));
    }
  }

  async function handleAdd() {
    if (!newName.trim() || !newContent.trim()) {
      alert('请填写模板名称和内容');
      return;
    }
    try {
      await templateApi.create({
        name: newName.trim(),
        content: newContent.trim(),
        intro: newIntro.trim(),
      });
      setShowAdd(false);
      setNewName('');
      setNewContent('');
      setNewIntro('');
      await loadTemplates();
    } catch (e: any) {
      alert('创建失败: ' + e.message);
    }
  }

  async function handleDeleteSelected() {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 个模板?`)) return;
    try {
      await Promise.all([...selected].map((id) => templateApi.delete(id)));
      setSelected(new Set());
      await loadTemplates();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  }

  function formatTime(iso: string) {
    return iso.replace('T', ' ');
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6">
      <div className="mb-4 mt-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">客服模板</h1>
        <button
          className="flex items-center space-x-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          onClick={() => setShowAdd(true)}
        >
          <Plus size={16} /> <span>新增模板</span>
        </button>
      </div>

      {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 w-10">
                <input type="checkbox" className="h-4" checked={selected.size === templates.length && templates.length > 0} onChange={toggleAll} />
              </th>
              <th className="px-4 py-3 text-left text-sm">客户模板名称</th>
              <th className="px-4 py-3 text-left text-sm">模板内容</th>
              <th className="px-4 py-3 text-left text-sm">简介</th>
              <th className="px-4 py-3 text-left text-sm">更新时间</th>
              <th className="px-4 py-3 text-left text-sm">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">加载中...</td></tr>
            ) : templates.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">暂无模板</td></tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input type="checkbox" className="h-4" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} />
                  </td>
                  <td className="px-4 py-3">{t.name}</td>
                  <td className="px-4 py-3 truncate max-w-xs" title={t.content}>
                    {t.content.length > 30 ? t.content.slice(0, 30) + '...' : t.content}
                  </td>
                  <td className="px-4 py-3">{t.intro || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatTime(t.updated_at)}</td>
                  <td className="px-4 py-3">
                    <button className="text-primary hover:underline">编辑</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex space-x-4 mt-6">
        <button className="flex-1 py-3 border rounded-lg hover:bg-gray-50 transition-colors" onClick={() => setShowAdd(true)}>
          新增模板
        </button>
        <button
          className="flex-1 py-3 border rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          disabled={selected.size === 0}
          onClick={handleDeleteSelected}
        >
          删除选中 ({selected.size})
        </button>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">添加模板</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowAdd(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2"><span className="text-red-500">*</span>模板名称</label>
                <input className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newName} onChange={(e) => setNewName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2"><span className="text-red-500">*</span>模板内容</label>
                <textarea rows={4} className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newContent} onChange={(e) => setNewContent(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2">简介</label>
                <input className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newIntro} onChange={(e) => setNewIntro(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button className="px-6 py-2 border rounded-lg hover:bg-gray-50" onClick={() => setShowAdd(false)}>取消</button>
              <button className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90" onClick={handleAdd}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
