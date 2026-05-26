import { useState, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { dialogApi, type PresetDialog } from '../services/api';

export default function KnowledgeAIPage() {
  const [dialogs, setDialogs] = useState<PresetDialog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Add dialog state
  const [showAdd, setShowAdd] = useState(false);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [newShop, setNewShop] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);

  // Edit dialog state
  const [editTarget, setEditTarget] = useState<PresetDialog | null>(null);
  const [editQ, setEditQ] = useState('');
  const [editA, setEditA] = useState('');
  const [editShop, setEditShop] = useState('');

  useEffect(() => { loadDialogs(); }, []);

  async function loadDialogs() {
    setLoading(true);
    setError('');
    try {
      const list = await dialogApi.list();
      setDialogs(list);
    } catch (e: any) {
      setError('加载失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd() {
    if (!newQ.trim() || !newA.trim()) return;
    try {
      await dialogApi.create({
        question: newQ.trim(),
        answer: newA.trim(),
        shop: newShop.trim() || undefined,
        parent_id: parentId || undefined,
      });
      setShowAdd(false);
      setNewQ('');
      setNewA('');
      setNewShop('');
      setParentId(null);
      await loadDialogs();
    } catch (e: any) {
      alert('添加失败: ' + e.message);
    }
  }

  function openEdit(d: PresetDialog) {
    setEditTarget(d);
    setEditQ(d.question);
    setEditA(d.answer);
    setEditShop(d.shop || '');
  }

  async function handleEdit() {
    if (!editTarget || !editQ.trim() || !editA.trim()) return;
    try {
      await dialogApi.update(editTarget.id, {
        question: editQ.trim(),
        answer: editA.trim(),
        shop: editShop.trim() || undefined,
      });
      setEditTarget(null);
      await loadDialogs();
    } catch (e: any) {
      alert('修改失败: ' + e.message);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('确定删除?')) return;
    try {
      await dialogApi.delete(id);
      await loadDialogs();
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  }

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function truncate(text: string, max = 30) {
    return text.length > max ? text.slice(0, max) + '...' : text;
  }

  function renderRow(d: PresetDialog, depth = 0) {
    const hasChildren = d.children && d.children.length > 0;
    const expanded = expandedIds.has(d.id);
    return (
      <tbody key={d.id}>
        <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => hasChildren && toggleExpand(d.id)}>
          <td className="px-4 py-3 text-sm font-medium">
            <span className="inline-block" style={{ paddingLeft: depth * 20 }}>
              {hasChildren && <span className="mr-2">{expanded ? '▼' : '▶'}</span>}
              {d.question}
            </span>
          </td>
          <td className="px-4 py-3 text-sm truncate max-w-xs" title={d.answer}>
            {truncate(d.answer)}
          </td>
          <td className="px-4 py-3 text-sm">{d.shop || '-'}</td>
          <td className="px-4 py-3 space-x-2">
            <button className="text-primary hover:underline" onClick={(e) => { e.stopPropagation(); openEdit(d); }}>
              编辑
            </button>
            <button className="text-red-500 hover:underline" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }}>
              删除
            </button>
          </td>
        </tr>
        {expanded && hasChildren && d.children!.map((child) => renderRow(child, depth + 1))}
      </tbody>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6">
      <div className="mb-4 mt-4 flex justify-between items-center">
        <h1 className="text-2xl font-bold">知能对话</h1>
        <button
          className="flex items-center space-x-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
          onClick={() => { setParentId(null); setShowAdd(true); }}
        >
          <Plus size={16} /> <span>新增对话</span>
        </button>
      </div>

      {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium">问题</th>
              <th className="px-4 py-3 text-left text-sm font-medium">答案</th>
              <th className="px-4 py-3 text-left text-sm font-medium">店铺</th>
              <th className="px-4 py-3 text-left text-sm font-medium">操作</th>
            </tr>
          </thead>
          {loading ? (
            <tbody><tr><td colSpan={4} className="text-center py-8 text-gray-400">加载中...</td></tr></tbody>
          ) : dialogs.length === 0 ? (
            <tbody><tr><td colSpan={4} className="text-center py-8 text-gray-400">暂无数据，点击右上角新增</td></tr></tbody>
          ) : (
            dialogs.map((d) => renderRow(d))
          )}
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">新增对话</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowAdd(false)}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">问题</label>
                <input className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newQ} onChange={(e) => setNewQ(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2">答案</label>
                <textarea rows={4} className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newA} onChange={(e) => setNewA(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2">店铺</label>
                <input className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={newShop} onChange={(e) => setNewShop(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2">父级分组 (可选)</label>
                <select className="w-full px-4 py-2 border rounded-lg text-sm"
                  value={parentId || ''} onChange={(e) => setParentId(e.target.value || null)}>
                  <option value="">无 (根节点)</option>
                  {dialogs.map((d) => <option key={d.id} value={d.id}>{d.question}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button className="px-6 py-2 border rounded-lg hover:bg-gray-50" onClick={() => setShowAdd(false)}>取消</button>
              <button className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90" onClick={handleAdd}>确认</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">编辑对话</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setEditTarget(null)}><X size={18} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2">问题</label>
                <input className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editQ} onChange={(e) => setEditQ(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2">答案</label>
                <textarea rows={4} className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editA} onChange={(e) => setEditA(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm mb-2">店铺</label>
                <input className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                  value={editShop} onChange={(e) => setEditShop(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end space-x-4 mt-6">
              <button className="px-6 py-2 border rounded-lg hover:bg-gray-50" onClick={() => setEditTarget(null)}>取消</button>
              <button className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90" onClick={handleEdit}>确认</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
