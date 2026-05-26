import { useState, useEffect } from 'react';
import { transferRuleApi, type TransferRule } from '../services/api';

export default function TransferPage() {
  const [rules, setRules] = useState<TransferRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [keyword, setKeyword] = useState('');
  const [reply, setReply] = useState('');

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    setLoading(true);
    setError('');
    try {
      setRules(await transferRuleApi.list());
    } catch (e: any) {
      setError('加载规则失败: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function addRule() {
    const kw = keyword.trim();
    const rp = reply.trim();
    if (!kw || !rp) {
      alert('请填写关键词和回复内容');
      return;
    }
    try {
      const created = await transferRuleApi.create({ keyword: kw, reply: rp, enabled: true });
      setRules((prev) => [...prev, created]);
      setKeyword('');
      setReply('');
    } catch (e: any) {
      alert('添加失败: ' + e.message);
    }
  }

  async function deleteRule(id: string) {
    if (!confirm('确定删除该规则?')) return;
    try {
      await transferRuleApi.delete(id);
      setRules((prev) => prev.filter((r) => r.id !== id));
    } catch (e: any) {
      alert('删除失败: ' + e.message);
    }
  }

  async function updateRule(id: string, patch: Partial<{ keyword: string; reply: string; enabled: boolean }>) {
    try {
      await transferRuleApi.update(id, patch);
    } catch (e: any) {
      alert('更新失败: ' + e.message);
    }
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6">
      <div className="mb-6 mt-4">
        <h1 className="text-2xl font-bold">转人工设置</h1>
      </div>

      {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold mb-4">触发规则</h3>

        {loading ? (
          <div className="text-center py-8 text-gray-400">加载中...</div>
        ) : (
          <div className="space-y-4">
            {rules.map((rule) => (
              <div key={rule.id} className="flex items-center space-x-4">
                <div className="flex items-center">
                  <span className="mr-2 text-sm">关键词</span>
                  <input
                    type="text"
                    defaultValue={rule.keyword}
                    onBlur={(e) => {
                      if (e.target.value !== rule.keyword) updateRule(rule.id, { keyword: e.target.value });
                    }}
                    className="w-48 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="flex items-center">
                  <span className="mr-2 text-sm">→先回复</span>
                  <input
                    type="checkbox"
                    defaultChecked={rule.enabled}
                    onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                    className="mr-2 focus:ring-1 focus:ring-primary"
                  />
                  <span className="mr-2 text-sm">启用</span>
                  <input
                    type="text"
                    defaultValue={rule.reply}
                    onBlur={(e) => {
                      if (e.target.value !== rule.reply) updateRule(rule.id, { reply: e.target.value });
                    }}
                    className="w-64 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <button
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm transition-colors"
                  onClick={() => deleteRule(rule.id)}
                >
                  删除
                </button>
              </div>
            ))}

            {/* Add new rule */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <span className="mr-2 text-sm">关键词</span>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="多个关键词用空格/逗号/分号分隔"
                  className="w-64 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="flex items-center">
                <span className="mr-2 text-sm">→先回复</span>
                <input
                  type="text"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="请输入自动回复内容"
                  className="w-64 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <button
                className="px-6 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors"
                onClick={addRule}
              >
                添加规则
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
