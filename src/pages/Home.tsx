// src/pages/Home.tsx
export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">欢迎使用 ReviewYourMind</h1>
      <p className="text-gray-600 mb-8">
        AI 驱动的知识架构升维引擎，帮助你把零散信息转化为结构化知识。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-2">📥 快速 Drop</h2>
          <p className="text-gray-600 text-sm">
            使用全局快捷键快速捕获信息（开发中）
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-2">🤖 AI 对话</h2>
          <p className="text-gray-600 text-sm">
            与 AI 一起构建知识框架（开发中）
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold mb-2">🗺️ Mindscape View</h2>
          <p className="text-gray-600 text-sm">
            全局知识空间可视化（开发中）
          </p>
        </div>
      </div>
    </div>
  )
}
