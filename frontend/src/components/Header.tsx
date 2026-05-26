import { useState, useEffect } from 'react';
import { Home, Headphones } from 'lucide-react';
import clsx from 'clsx';

function useClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return time.toLocaleTimeString('zh-CN', { hour12: false });
}

interface HeaderProps {
  activeMainTab: 'workspace' | 'reception';
  onMainTabChange: (tab: 'workspace' | 'reception') => void;
}

export default function Header({ activeMainTab, onMainTabChange }: HeaderProps) {
  const timeStr = useClock();

  return (
    <header className="bg-white border-b border-gray-200 h-12 flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center space-x-1">
        <button
          className={clsx(
            'flex items-center space-x-2 px-4 py-1.5 rounded-t-md transition-colors',
            activeMainTab === 'workspace'
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:text-primary',
          )}
          onClick={() => onMainTabChange('workspace')}
        >
          <Home size={16} />
          <span>工作台</span>
        </button>
        <button
          className={clsx(
            'flex items-center space-x-2 px-4 py-1.5 rounded-t-md transition-colors',
            activeMainTab === 'reception'
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:text-primary',
          )}
          onClick={() => onMainTabChange('reception')}
        >
          <Headphones size={16} />
          <span>接待中心</span>
        </button>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex items-center space-x-1">
          <span className="inline-block w-2 h-2 rounded-full bg-primary" />
          <span className="text-sm text-gray-600">系统正常</span>
        </div>
        <span className="text-sm text-gray-500">{timeStr}</span>
      </div>
    </header>
  );
}
