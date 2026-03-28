// src/pages/RawInbox.tsx
export default function RawInbox() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-4">Raw Inbox</h1>
      <p className="text-gray-600 mb-8">
        这里显示你快速捕获的所有信息。
      </p>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
        <p className="text-gray-400">
          还没有任何 Drop。使用全局快捷键开始捕获信息（开发中）
        </p>
      </div>
    </div>
  )
}
