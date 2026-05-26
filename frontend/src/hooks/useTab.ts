import { useState, useCallback } from 'react';
import type { TabId } from '../types';

export function useTab(defaultTab: TabId = 'chat') {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab);

  const switchTab = useCallback((tab: TabId) => {
    setActiveTab(tab);
  }, []);

  return { activeTab, switchTab };
}
