import { useState, useRef, useEffect } from 'react';
import {
  MessageCircle,
  BookOpen,
  History,
  Headphones,
  ShoppingBag,
  User,
} from 'lucide-react';
import clsx from 'clsx';
import type { TabId } from '../types';

interface TabDef {
  id: TabId;
  label: string;
  desc: string;
  icon: React.ReactNode;
  hasDropdown?: boolean;
  dropdownItems?: { id: TabId; label: string }[];
}

const tabs: TabDef[] = [
  {
    id: 'chat',
    label: '智能对话',
    desc: 'AI智能客服对话',
    icon: <MessageCircle size={18} />,
  },
  {
    id: 'knowledge-new',
    label: '知识库管理',
    desc: '管理知识库内容',
    icon: <BookOpen size={18} />,
    hasDropdown: true,
    dropdownItems: [
      { id: 'knowledge-new', label: '新建知识库' },
      { id: 'knowledge-doc', label: '文档知识' },
      { id: 'knowledge-ai', label: '知能对话' },
    ],
  },
  {
    id: 'chat-history',
    label: '聊天记录',
    desc: '查看历史对话',
    icon: <History size={18} />,
  },
  {
    id: 'cs-template',
    label: '客服模版',
    desc: '管理客服模版',
    icon: <Headphones size={18} />,
  },
  {
    id: 'store-config',
    label: '商店配置',
    desc: '商店相关设置',
    icon: <ShoppingBag size={18} />,
  },
  {
    id: 'transfer',
    label: '转人工设置',
    desc: '转人工设置',
    icon: <User size={18} />,
  },
];

interface TabNavigationProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

export default function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  const [openDropdown, setOpenDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function isKnowledgeTab(id: TabId) {
    return id === 'knowledge-new' || id === 'knowledge-upload' || id === 'knowledge-doc' || id === 'knowledge-ai';
  }

  return (
    <div className="flex items-center space-x-4 px-6 py-5">
      {tabs.map((tab) => {
        const isActive = tab.hasDropdown ? isKnowledgeTab(activeTab) : activeTab === tab.id;

        if (tab.hasDropdown) {
          return (
            <div key={tab.id} className="relative" ref={dropdownRef}>
              <div
                className={clsx(
                  'bg-white border border-gray-200 rounded-lg p-3 w-48 cursor-pointer select-none',
                  isActive ? 'tab-active' : 'tab-hover',
                )}
                onClick={() => {
                  onTabChange(tab.id);
                  setOpenDropdown(!openDropdown);
                }}
              >
                <div className="flex items-center space-x-2">
                  <span className={isActive ? 'text-primary' : 'text-gray-400'}>{tab.icon}</span>
                  <div>
                    <div className="font-medium text-sm">{tab.label}</div>
                    <div className="text-xs text-gray-400">{tab.desc}</div>
                  </div>
                </div>
              </div>
              {openDropdown && (
                <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
                  {tab.dropdownItems?.map((item) => (
                    <div
                      key={item.id}
                      className={clsx(
                        'dropdown-item text-sm',
                        activeTab === item.id && 'bg-gold-50 text-primary font-medium',
                      )}
                      onClick={() => {
                        onTabChange(item.id);
                        setOpenDropdown(false);
                      }}
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <div
            key={tab.id}
            className={clsx(
              'bg-white border border-gray-200 rounded-lg p-3 w-48 cursor-pointer select-none',
              isActive ? 'tab-active' : 'tab-hover',
            )}
            onClick={() => onTabChange(tab.id)}
          >
            <div className="flex items-center space-x-2">
              <span className={isActive ? 'text-primary' : 'text-gray-400'}>{tab.icon}</span>
              <div>
                <div className="font-medium text-sm">{tab.label}</div>
                <div className="text-xs text-gray-400">{tab.desc}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
