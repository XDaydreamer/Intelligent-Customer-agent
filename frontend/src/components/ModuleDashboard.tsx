import { MessageCircle, BookOpen, History, Headphones, ShoppingBag, User, ChevronRight } from 'lucide-react';
import type { TabId } from '../types';

interface ModuleDef {
  id: TabId;
  label: string;
  desc: string;
  icon: React.ReactNode;
}

const modules: ModuleDef[] = [
  { id: 'chat', label: '智能对话', desc: '与 AI 客服进行实时对话', icon: <MessageCircle size={36} /> },
  { id: 'knowledge-new', label: '知识库管理', desc: '管理知识库、文档与预设问答', icon: <BookOpen size={36} /> },
  { id: 'chat-history', label: '聊天记录', desc: '查看和编辑历史客户对话', icon: <History size={36} /> },
  { id: 'cs-template', label: '客服模版', desc: '管理客服回复模版', icon: <Headphones size={36} /> },
  { id: 'store-config', label: '商店配置', desc: '商店相关设置', icon: <ShoppingBag size={36} /> },
  { id: 'transfer', label: '转人工设置', desc: '配置转人工触发规则', icon: <User size={36} /> },
];

interface Props {
  onEnter: (tab: TabId) => void;
}

export default function ModuleDashboard({ onEnter }: Props) {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">智能客服系统</h1>
          <p className="text-gray-400">选择一个模块开始工作</p>
        </div>
        <div className="grid grid-cols-3 gap-5">
          {modules.map((m) => (
            <div
              key={m.id}
              onClick={() => onEnter(m.id)}
              className="bg-white border border-gray-200 rounded-xl p-6 cursor-pointer
                         hover:border-primary hover:shadow-lg hover:-translate-y-0.5
                         transition-all duration-200 group select-none"
            >
              <div className="text-primary mb-4 group-hover:scale-110 transition-transform duration-200">
                {m.icon}
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold text-gray-800 mb-1">{m.label}</div>
                  <div className="text-xs text-gray-400">{m.desc}</div>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
