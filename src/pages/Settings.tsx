// src/pages/Settings.tsx
interface SettingsProps {
  onNavigate: (page: 'home' | 'inbox' | 'settings') => void
}

export default function Settings({ onNavigate: _onNavigate }: SettingsProps) {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">设置</h1>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">API 配置</h2>
        <p className="text-gray-600 text-sm">
          配置你的 LLM API Key（GLM/Qwen/OpenAI/Claude）
        </p>
        <p className="text-gray-400 text-xs mt-2">
          * 开发中
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-4">快捷键设置</h2>
        <p className="text-gray-600 text-sm">
          自定义全局快捷键
        </p>
        <p className="text-gray-400 text-xs mt-2">
          * 开发中
        </p>
      </div>
    </div>
  )
}
