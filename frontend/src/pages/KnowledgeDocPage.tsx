import { useState, useEffect } from 'react';
import { X, ChevronDown, Eye, Download, Save, PlusCircle } from 'lucide-react';
import { copywritingApi, knowledgeApi, type KBItem } from '../services/api';

export default function KnowledgeDocPage() {
  const [productName, setProductName] = useState('白t');
  const [productType, setProductType] = useState('');
  const [customType, setCustomType] = useState('');
  const [features, setFeatures] = useState('');
  const [price, setPrice] = useState('');
  const [promotion, setPromotion] = useState('');
  const [audience, setAudience] = useState('');
  const [stock, setStock] = useState('s码到3xl都有货');
  const [activeBtn, setActiveBtn] = useState<'get' | 'reset' | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState('');
  const [editedCopy, setEditedCopy] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [saveTargetKbId, setSaveTargetKbId] = useState('');
  const [saveFilename, setSaveFilename] = useState('product_copy.md');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => {
    knowledgeApi.list().then(setKbList).catch(console.error);
  }, []);

  async function handleGenerate() {
    if (!productName.trim() || !productType) {
      setError('请填写产品名称和产品类型');
      return;
    }
    setGenerating(true);
    setError('');
    setActiveBtn('get');
    try {
      const res = await copywritingApi.generate({
        product_name: productName.trim(),
        product_type: productType === 'other' ? customType : productType,
        product_features: features,
        product_price: price,
        promotion_info: promotion,
        target_audience: audience,
        stock_status: stock,
      });
      setGeneratedCopy(res.content);
      setEditedCopy(res.content);
    } catch (e: any) {
      setError('生成失败: ' + e.message);
    } finally {
      setGenerating(false);
    }
  }

  function handleReset() {
    setProductName('');
    setProductType('');
    setCustomType('');
    setFeatures('');
    setPrice('');
    setPromotion('');
    setAudience('');
    setStock('');
    setGeneratedCopy('');
    setEditedCopy('');
    setError('');
    setActiveBtn('reset');
  }

  async function handleSaveToKB() {
    if (!saveTargetKbId) {
      setSaveMsg('请选择目标知识库');
      return;
    }
    setSaving(true);
    setSaveMsg('');
    try {
      await copywritingApi.save({
        content: editedCopy,
        knowledge_base_id: saveTargetKbId,
        filename: saveFilename,
      });
      setSaveMsg('已保存到知识库!');
    } catch (e: any) {
      setSaveMsg('保存失败: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleDownload() {
    const blob = new Blob([editedCopy], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = saveFilename;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-1 flex-col px-6 pb-6 overflow-y-auto">
      <div className="mb-6 mt-4">
        <h1 className="text-xl font-semibold text-center">输入所卖产品一键获取知识库</h1>
      </div>

      <div className="max-w-2xl mx-auto w-full bg-gray-100 rounded-lg p-8">
        {/* Product Name */}
        <div className="mb-6">
          <label className="block text-sm text-gray-700 mb-2">
            <span className="text-red-500 mr-1">*</span>产品名称
          </label>
          <div className="relative">
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary pr-10"
            />
            {productName && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setProductName('')}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Product Type */}
        <div className="mb-6">
          <label className="block text-sm text-gray-700 mb-2">
            <span className="text-red-500 mr-1">*</span>产品类型
          </label>
          <div className="relative mb-3">
            <select
              className="w-full px-4 py-3 border rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary"
              value={productType}
              onChange={(e) => { setProductType(e.target.value); if (e.target.value !== 'other') setCustomType(''); }}
            >
              <option value="">产品类型</option>
              <option>美妆</option>
              <option>服饰</option>
              <option>数码</option>
              <option>家居</option>
              <option>食品</option>
              <option>母婴</option>
              <option>电器</option>
              <option>厨房用品</option>
              <option value="other">其它类型</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
          </div>
          {productType === 'other' && (
            <input
              type="text"
              placeholder="请输入产品类型"
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
          )}
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-700 mb-2">产品特点</label>
          <input
            type="text"
            placeholder="例如:防水、持久、轻薄、无添加等"
            value={features}
            onChange={(e) => setFeatures(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm text-gray-700 mb-2">产品价格</label>
            <input
              type="text"
              placeholder="例如:¥199.9"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-2">促销信息</label>
            <input
              type="text"
              placeholder="例如:限时8折优惠, 赠送配套礼品等"
              value={promotion}
              onChange={(e) => setPromotion(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-700 mb-2">适用人群</label>
          <input
            type="text"
            placeholder="例如:青少年、中老年人、孕妇等"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
            className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm text-gray-700 mb-2">库存状况</label>
          <div className="relative">
            <input
              type="text"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary pr-10"
            />
            {stock && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600" onClick={() => setStock('')}>
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {error && <div className="mb-4 text-red-500 text-sm">{error}</div>}

        <div className="flex space-x-4 mt-6">
          <button
            className={`flex-1 py-3 rounded-lg transition-colors ${
              activeBtn === 'get' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            } disabled:opacity-50`}
            disabled={generating}
            onClick={handleGenerate}
          >
            {generating ? '生成中...' : '获取'}
          </button>
          <button
            className={`flex-1 py-3 rounded-lg transition-colors ${
              activeBtn === 'reset' ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            onClick={handleReset}
          >
            重置
          </button>
        </div>

        {/* Generated Copy Actions */}
        {generatedCopy && (
          <div className="mt-6 flex space-x-3">
            <button
              className="flex items-center space-x-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm transition-colors"
              onClick={() => setShowPreview(true)}
            >
              <Eye size={16} /> <span>查看</span>
            </button>
            <button
              className="flex items-center space-x-1 px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm transition-colors"
              onClick={handleDownload}
            >
              <Download size={16} /> <span>下载</span>
            </button>
            <div className="flex items-center space-x-2 flex-1">
              <select
                className="flex-1 px-3 py-2 border rounded-lg text-sm"
                value={saveTargetKbId}
                onChange={(e) => setSaveTargetKbId(e.target.value)}
              >
                <option value="">选择知识库</option>
                {kbList.map((kb) => (
                  <option key={kb.id} value={kb.id}>{kb.name}</option>
                ))}
              </select>
              <button
                className="flex items-center space-x-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                disabled={saving}
                onClick={handleSaveToKB}
              >
                <PlusCircle size={16} /> <span>{saving ? '保存中...' : '添加到知识库'}</span>
              </button>
            </div>
          </div>
        )}

        {saveMsg && <div className={`mt-2 text-sm ${saveMsg.includes('失败') ? 'text-red-500' : 'text-green-600'}`}>{saveMsg}</div>}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg shadow-lg w-[600px] max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h3 className="text-lg font-semibold">文案预览与编辑</h3>
              <button className="text-gray-400 hover:text-gray-600" onClick={() => setShowPreview(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              <textarea
                className="w-full min-h-[400px] px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
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
                  placeholder="文件名"
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
                  className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                  onClick={() => {
                    setGeneratedCopy(editedCopy);
                    setShowPreview(false);
                  }}
                >
                  <Save size={16} className="inline mr-1" />
                  保存修改
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
