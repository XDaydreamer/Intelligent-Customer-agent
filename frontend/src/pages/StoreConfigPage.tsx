import { ShoppingBag } from 'lucide-react';

export default function StoreConfigPage() {
  return (
    <div className="flex flex-1 flex-col px-6 pb-6">
      <div className="mb-6 mt-4">
        <div className="flex items-center space-x-2 mb-1">
          <ShoppingBag size={28} className="text-gray-700" />
          <h1 className="text-2xl font-bold">商店配置</h1>
        </div>
        <p className="text-gray-500 text-sm">商店相关设置和管理</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border p-8 text-center text-gray-400">
        商店配置功能开发中
      </div>
    </div>
  );
}
