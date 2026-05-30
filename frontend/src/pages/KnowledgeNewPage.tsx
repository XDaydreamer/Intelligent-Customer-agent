import { useState, useEffect } from 'react';
import { BookOpen, ChevronDown, Plus } from 'lucide-react';
import { knowledgeApi, type KBItem, type KBDetail } from '../services/api';
import type { TabId } from '../types';

interface Props {
  onNavigate: (tab: TabId) => void;
  onSelectKB: (id: string) => void;
}

export default function KnowledgeNewPage({ onNavigate, onSelectKB }: Props) {
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [selectedKbId, setSelectedKbId] = useState<string>('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'list' | 'create'>('list');

  useEffect(() => {
    loadKBList();
  }, []);

  async function loadKBList() {
    try {
      const list = await knowledgeApi.list();
      setKbList(list);
    } catch (e: any) {
      setError('加载知识库列表失败: ' + e.message);
    }
  }

  async function handleCreate() {
    if (!name.trim()) {
      setError('请输入知识库名称');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const kb = await knowledgeApi.create({ name: name.trim(), description: description.trim() });
      setSelectedKbId(kb.id);
      onSelectKB(kb.id);
      await loadKBList();
      setMode('list');
      setName('');
      setDescription('');
      onNavigate('knowledge-upload');
    } catch (e: any) {
      setError('创建失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectChange(value: string) {
    if (value === '__create__') {
      setMode('create');
    } else if (value) {
      setSelectedKbId(value);
      onSelectKB(value);
    }
  }

  if (mode === 'create') {
    return (
      <div className="flex flex-1 flex-col px-6 pb-6">
        <div className="mb-6 mt-4">
          <div className="flex items-center space-x-2 mb-1">
            <BookOpen size={28} className="text-gray-700" />
            <h1 className="text-2xl font-bold">知识库管理</h1>
          </div>
          <p className="text-gray-500 text-sm">管理和维护您的知识库内容</p>
        </div>
        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-2">请选择或新建知识库</label>
          <div className="relative">
            <select
              className="w-full px-4 py-3 border rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
              value="__create__"
              onChange={() => {}}
            >
              <option value="__create__">新建知识库</option>
              {kbList.map((kb) => (
                <option key={kb.id} value={kb.id}>{kb.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
          <button
            className="text-primary text-sm mt-1 hover:underline"
            onClick={() => setMode('list')}
          >
            返回选择已有知识库
          </button>
        </div>
        {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}
        <div className="mb-6">
          <label className="block text-sm text-gray-600 mb-2">请输入知识库名称</label>
          <input
            type="text"
            placeholder="请输入知识库名称"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
          />
        </div>
        <div className="mb-8">
          <label className="block text-sm text-gray-600 mb-2">请输入知识库介绍</label>
          <textarea
            placeholder="请输入知识库的描述信息"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm resize-none"
          />
        </div>
        <button
          className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 shadow-sm transition-colors disabled:opacity-50"
          disabled={loading}
          onClick={handleCreate}
        >
          {loading ? '创建中...' : '新建知识库'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6">
      <div className="mb-6 mt-4">
        <div className="flex items-center space-x-2 mb-1">
          <BookOpen size={28} className="text-gray-700" />
          <h1 className="text-2xl font-bold">知识库管理</h1>
        </div>
        <p className="text-gray-500 text-sm">管理和维护您的知识库内容</p>
      </div>
      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-2">请选择或新建知识库</label>
        <div className="relative">
          <select
            className="w-full px-4 py-3 border rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            value={selectedKbId}
            onChange={(e) => handleSelectChange(e.target.value)}
          >
            <option value="">选择知识库...</option>
            {kbList.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name} ({kb.document_count} 个文档)
              </option>
            ))}
            <option value="__create__">+ 新建知识库</option>
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
      </div>

      {selectedKbId && (
        <div className="flex space-x-3 mb-6">
          <button
            className="flex-1 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            onClick={() => onNavigate('knowledge-upload')}
          >
            上传文件到该知识库
          </button>
          <button
            className="flex-1 py-3 border rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => onNavigate('copywriting')}
          >
            文案生成系统
          </button>
        </div>
      )}

      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  );
}
