import { useState, useEffect, useCallback, useRef, type DragEvent } from 'react';
import { BookOpen, CloudUpload, ChevronDown, FileText, CheckCircle, XCircle } from 'lucide-react';
import { knowledgeApi, type KBItem } from '../services/api';

const SUPPORTED_FORMATS =
  'HTML, HTM, MHTML, MD, JSON, JSONL, CSV, PDF, DOCX, PPT, PNG, JPG, JPEG, BMP, TXT, XLSX, XLS';

interface Props {
  selectedKbId: string;
  onSelectKB: (id: string) => void;
}

export default function KnowledgeUploadPage({ selectedKbId, onSelectKB }: Props) {
  const [kbList, setKbList] = useState<KBItem[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [description, setDescription] = useState('1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    knowledgeApi.list().then(setKbList).catch(console.error);
  }, []);

  const handleDrop = useCallback(async (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) await uploadFile(files[0]);
  }, [selectedKbId]);

  async function uploadFile(file: File) {
    if (!selectedKbId) {
      setUploadResult({ success: false, msg: '请先选择知识库' });
      return;
    }
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await knowledgeApi.upload(selectedKbId, file);
      setUploadResult({ success: true, msg: `上传成功！${result.chunk_count} 个文本块已入库` });
    } catch (e: any) {
      setUploadResult({ success: false, msg: '上传失败: ' + e.message });
    } finally {
      setUploading(false);
    }
  }

  async function handleBrowse() {
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await uploadFile(file);
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
        <label className="block text-sm text-gray-600 mb-2">请选择知识库</label>
        <div className="relative">
          <select
            className="w-full px-4 py-3 border rounded-lg text-sm appearance-none focus:outline-none focus:ring-1 focus:ring-primary shadow-sm"
            value={selectedKbId}
            onChange={(e) => onSelectKB(e.target.value)}
          >
            <option value="">请选择知识库...</option>
            {kbList.map((kb) => (
              <option key={kb.id} value={kb.id}>
                {kb.name} ({kb.document_count} 个文档)
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-2">上传知识文件</label>
        <div
          className={`border-2 border-dashed rounded-lg p-6 bg-white flex items-center justify-between cursor-pointer transition-colors ${
            dragOver ? 'border-primary bg-gold-50' : 'border-gray-200 hover:border-gold-200'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
        >
          <div className="flex flex-col items-center justify-center flex-1">
            {uploading ? (
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                <p className="text-gray-600">上传中...</p>
              </div>
            ) : (
              <>
                <CloudUpload size={32} className="text-gray-400 mb-2" />
                <p className="text-gray-700 font-medium mb-1">拖拽文件到此处 或 点击选择</p>
                <p className="text-xs text-gray-500 text-center">
                  单文件不超过200MB • {SUPPORTED_FORMATS}
                </p>
              </>
            )}
          </div>
          <button
            className="ml-4 bg-gold-100 text-primary px-4 py-2 rounded text-sm hover:bg-gold-200 transition-colors"
            onClick={(e) => { e.stopPropagation(); handleBrowse(); }}
            disabled={uploading}
          >
            选择文件
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".txt,.json,.docx,.csv,.xlsx,.md,.html,.pdf,.png,.jpg,.jpeg,.bmp"
        />
      </div>

      {uploadResult && (
        <div className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
          uploadResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {uploadResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <span className="text-sm">{uploadResult.msg}</span>
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm text-gray-600 mb-2">知识库介绍</label>
        <textarea
          className="w-full px-4 py-3 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-sm resize-none"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <button className="w-full py-3 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
        添加文件到知识库
      </button>
    </div>
  );
}
