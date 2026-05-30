import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import Header from './components/Header';
import ModuleDashboard from './components/ModuleDashboard';
import ChatPage from './pages/ChatPage';
import KnowledgeNewPage from './pages/KnowledgeNewPage';
import KnowledgeUploadPage from './pages/KnowledgeUploadPage';
import KnowledgeAIPage from './pages/KnowledgeAIPage';
import CopywritingChatPage from './pages/CopywritingChatPage';
import ChatHistoryPage from './pages/ChatHistoryPage';
import CSTemplatePage from './pages/CSTemplatePage';
import StoreConfigPage from './pages/StoreConfigPage';
import TransferPage from './pages/TransferPage';
import type { TabId } from './types';

type View = 'home' | 'module';

export default function App() {
  const [view, setView] = useState<View>('home');
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [selectedKbId, setSelectedKbId] = useState('');

  function enterModule(tab: TabId) {
    setActiveTab(tab);
    setView('module');
  }

  function goHome() {
    setView('home');
  }

  function isKnowledgeTab() {
    return ['knowledge-new', 'knowledge-upload', 'knowledge-ai'].includes(activeTab);
  }

  const knowledgeSubTabs = [
    { id: 'knowledge-new' as TabId, label: '新建知识库' },
    { id: 'knowledge-ai' as TabId, label: '知能对话' },
  ];

  function renderContent() {
    switch (activeTab) {
      case 'chat':
        return <ChatPage />;
      case 'knowledge-new':
        return <KnowledgeNewPage onNavigate={setActiveTab} onSelectKB={setSelectedKbId} />;
      case 'knowledge-upload':
        return <KnowledgeUploadPage selectedKbId={selectedKbId} onSelectKB={setSelectedKbId} />;
      case 'knowledge-ai':
        return <KnowledgeAIPage />;
      case 'chat-history':
        return <ChatHistoryPage />;
      case 'cs-template':
        return <CSTemplatePage />;
      case 'store-config':
        return <StoreConfigPage />;
      case 'transfer':
        return <TransferPage />;
      case 'copywriting':
        return <CopywritingChatPage />;
      default:
        return <ChatPage />;
    }
  }

  function getModuleTitle(): string {
    const titles: Record<string, string> = {
      chat: '智能对话',
      'knowledge-new': '知识库管理',
      'knowledge-upload': '知识库管理',
      'knowledge-doc': '知识库管理',
      'knowledge-ai': '知识库管理',
      'chat-history': '聊天记录',
      'cs-template': '客服模版',
      'store-config': '商店配置',
      transfer: '转人工设置',
      copywriting: '文案生成系统',
    };
    return titles[activeTab] || '';
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gold-50/30">
      {view === 'home' ? (
        <>
          <Header
            activeMainTab="workspace"
            onMainTabChange={() => {}}
          />
          <ModuleDashboard onEnter={enterModule} />
        </>
      ) : (
        <>
          {/* Top bar */}
          <header className="bg-white border-b border-gray-200 h-12 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center space-x-4">
              <button
                onClick={goHome}
                className="flex items-center space-x-1 text-gray-500 hover:text-primary transition-colors"
              >
                <ArrowLeft size={16} />
                <span className="text-sm">返回</span>
              </button>
              <span className="text-gray-300">|</span>
              <span className="font-medium text-sm text-gray-700">{getModuleTitle()}</span>
            </div>

            {/* Knowledge sub-tabs */}
            {isKnowledgeTab() && (
              <div className="flex items-center space-x-1">
                {knowledgeSubTabs.map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setActiveTab(st.id)}
                    className={`px-3 py-1.5 rounded text-sm transition-colors ${
                      activeTab === st.id
                        ? 'bg-primary text-white'
                        : 'text-gray-500 hover:text-primary hover:bg-gold-50'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            )}
            <div className="w-20" /> {/* spacer for centering */}
          </header>

          {/* Module content */}
          <div className="flex-1 flex flex-col min-h-0">
            {renderContent()}
          </div>
        </>
      )}
    </div>
  );
}
