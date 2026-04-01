// src/pages/Settings.tsx
import { useState, useEffect } from 'react'
import { useAPIKeys, KeyStatus } from '../hooks/useAPIKeys'
import { PromptSettings } from '../components/Settings/PromptSettings'
import { useTranslation } from '../i18n'

interface SettingsProps {
  onNavigate: (page: 'home' | 'inbox' | 'settings') => void
}

interface ProviderInfo {
  id: string
  name: string
  defaultModels: string[]
  defaultBaseUrl: string
  apiFormat: 'openai' | 'anthropic'
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    defaultModels: ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini', 'gpt-3.5-turbo'],
    defaultBaseUrl: 'https://api.openai.com/v1',
    apiFormat: 'openai',
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    defaultModels: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    apiFormat: 'anthropic',
  },
  {
    id: 'glm',
    name: 'GLM (智谱)',
    defaultModels: ['glm-4-plus', 'glm-4', 'glm-3-turbo'],
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiFormat: 'openai',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    defaultModels: ['abab6.5s-chat', 'abab5.5-chat', 'abab6.5g-chat'],
    defaultBaseUrl: 'https://api.minimax.chat/v1',
    apiFormat: 'openai',
  },
]

function StatusBadge({ status }: { status: KeyStatus }) {
  const { t } = useTranslation()
  const styles = {
    saved: 'bg-green-100 text-green-700',
    missing: 'bg-gray-100 text-gray-600',
    invalid: 'bg-red-100 text-red-700',
    testing: 'bg-yellow-100 text-yellow-700',
  }

  const labels = {
    saved: t('settings.statusSaved'),
    missing: t('settings.statusMissing'),
    invalid: t('settings.statusInvalid'),
    testing: t('settings.statusTesting'),
  }

  return (
    <span className={`px-2 py-1 text-xs rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function Settings({ onNavigate: _onNavigate }: SettingsProps) {
  const { t, locale, setLocale } = useTranslation();
  const {
    keys,
    configs,
    statuses,
    saveKey,
    deleteKey,
    saveConfig,
    testKey,
    loading,
  } = useAPIKeys()

  const [activeProvider, setActiveProvider] = useState<string>('')
  const [editingProvider, setEditingProvider] = useState<string | null>(null)
  const [inputKey, setInputKey] = useState('')
  const [inputModel, setInputModel] = useState('')
  const [isCustomModelSelected, setIsCustomModelSelected] = useState(false)
  const [inputBaseUrl, setInputBaseUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [testingProvider, setTestingProvider] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Load active provider from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('activeProvider')
    if (saved && keys[saved]) {
      setActiveProvider(saved)
    } else {
      // Default to first configured provider
      const firstConfigured = PROVIDERS.find(p => keys[p.id])
      if (firstConfigured) {
        setActiveProvider(firstConfigured.id)
      }
    }
  }, [keys])

  // Save active provider to localStorage
  const handleSetActiveProvider = (providerId: string) => {
    setActiveProvider(providerId)
    localStorage.setItem('activeProvider', providerId)
  }

  const startEditing = (provider: ProviderInfo) => {
    setEditingProvider(provider.id)
    setInputKey('')
    const currentConfig = configs[provider.id]
    const currentModel = currentConfig?.model || provider.defaultModels[0]

    // Check if current model is custom (not in default list)
    const isCustom = !provider.defaultModels.includes(currentModel)
    setIsCustomModelSelected(isCustom)
    setInputModel(currentModel)
    setInputBaseUrl(currentConfig?.base_url || '')
    setTestResult(null)
    setTestingProvider(null)
  }

  const handleSave = async (providerId: string) => {
    if (!inputKey.trim() && !keys[providerId]) {
      return
    }

    const providerInfo = PROVIDERS.find(p => p.id === providerId)

    setSaving(true)
    try {
      if (inputKey.trim()) {
        await saveKey(providerId, inputKey.trim())
      }
      await saveConfig(providerId, {
        model: inputModel || providerInfo?.defaultModels[0] || '',
        base_url: inputBaseUrl || null,
      })
      setInputKey('')
      setEditingProvider(null)
      setTestResult(null)
      // Auto-set as active provider if no active provider set
      if (!activeProvider) {
        handleSetActiveProvider(providerId)
      }
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async (provider: string) => {
    if (!keys[provider]) {
      setTestResult({ success: false, message: t('settings.testApiKey') })
      setTestingProvider(provider)
      return
    }

    setTestingProvider(provider)
    setTestResult(null)
    try {
      const result = await testKey(provider)
      setTestResult(result)
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const handleDelete = async (provider: string) => {
    if (!confirm(t('settings.deleteProviderConfirm', { name: PROVIDERS.find(p => p.id === provider)?.name || provider }))) return

    try {
      await deleteKey(provider)
      // If deleting active provider, switch to another
      if (activeProvider === provider) {
        const nextProvider = PROVIDERS.find(p => p.id !== provider && keys[p.id])
        handleSetActiveProvider(nextProvider?.id || '')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
    }
  }

  const handleCancel = () => {
    setInputKey('')
    setEditingProvider(null)
    setIsCustomModelSelected(false)
    setTestResult(null)
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">{t('settings.title')}</h1>
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-8 max-w-2xl h-full overflow-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{t('settings.title')}</h1>

      {/* Active Provider Selector */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-semibold text-blue-800 mb-3">{t('settings.activeModel')}</h2>
        <div className="flex flex-wrap gap-2">
          {PROVIDERS.map((provider) => {
            const isConfigured = keys[provider.id]
            const isActive = activeProvider === provider.id
            return (
              <button
                key={provider.id}
                onClick={() => isConfigured && handleSetActiveProvider(provider.id)}
                disabled={!isConfigured}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md'
                    : isConfigured
                    ? 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {provider.name}
                {isActive && <span className="ml-2">✓</span>}
              </button>
            )
          })}
        </div>
        {!activeProvider && (
          <p className="text-xs text-blue-600 mt-2">{t('settings.configureFirst')}</p>
        )}
        {activeProvider && (
          <p className="text-xs text-gray-500 mt-2">
            {t('settings.currentlyUsing')}: <strong>{PROVIDERS.find(p => p.id === activeProvider)?.name}</strong> / {configs[activeProvider]?.model}
          </p>
        )}
      </div>

      {/* API Configuration */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">{t('settings.apiConfig')}</h2>
          <p className="text-gray-500 text-sm mt-1">
            {t('settings.apiConfigDescription')}
          </p>
        </div>

        <div className="divide-y divide-gray-100">
          {PROVIDERS.map((provider) => {
            const status = statuses[provider.id] || 'missing'
            const isEditing = editingProvider === provider.id
            const isTesting = testingProvider === provider.id
            const currentConfig = configs[provider.id]
            const isActive = activeProvider === provider.id

            return (
              <div key={provider.id} className={`p-4 ${isActive ? 'bg-blue-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="font-medium">{provider.name}</span>
                    <StatusBadge status={status} />
                    {isActive && (
                      <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded">{t('settings.active')}</span>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex gap-2">
                      {(status === 'saved' || status === 'invalid') && (
                        <>
                          <button
                            onClick={() => handleTest(provider.id)}
                            disabled={isTesting}
                            className="text-sm text-green-600 hover:text-green-700 disabled:opacity-50"
                          >
                            {isTesting ? t('settings.statusTesting') : t('settings.test')}
                          </button>
                          <button
                            onClick={() => handleDelete(provider.id)}
                            className="text-sm text-red-600 hover:text-red-700"
                          >
                            {t('settings.delete')}
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => startEditing(provider)}
                        className="text-sm text-blue-600 hover:text-blue-700"
                      >
                        {status === 'saved' || status === 'invalid' ? t('settings.edit') : t('settings.configure')}
                      </button>
                    </div>
                  )}
                </div>

                {/* Test Result */}
                {testResult && testingProvider === provider.id && (
                  <div className={`mt-2 p-2 rounded text-sm ${
                    testResult.success
                      ? 'bg-green-50 text-green-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {testResult.message}
                  </div>
                )}

                {/* Current Config Display */}
                {!isEditing && status === 'saved' && currentConfig && (
                  <div className="text-xs text-gray-500 space-y-1">
                    <div>{t('settings.model')} {currentConfig.model}</div>
                    <div>Host: {currentConfig.base_url || provider.defaultBaseUrl}</div>
                  </div>
                )}

                {/* Edit Form */}
                {isEditing && (
                  <div className="mt-3 space-y-3">
                    {/* API Key Input */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.apiKey')}</label>
                      <input
                        type="password"
                        value={inputKey}
                        onChange={(e) => setInputKey(e.target.value)}
                        placeholder={keys[provider.id] ? t('settings.keyPlaceholder.configured') : t('settings.keyPlaceholder.empty', { name: provider.name })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      {keys[provider.id] && (
                        <p className="text-xs text-gray-400 mt-1">
                          {t('settings.keyConfiguredHint')}
                        </p>
                      )}
                    </div>

                    {/* Model Selection */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('settings.modelLabel')}</label>
                      <select
                        value={isCustomModelSelected ? '__custom__' : inputModel}
                        onChange={(e) => {
                          if (e.target.value === '__custom__') {
                            setIsCustomModelSelected(true)
                            setInputModel('')
                          } else {
                            setIsCustomModelSelected(false)
                            setInputModel(e.target.value)
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      >
                        {provider.defaultModels.map((model) => (
                          <option key={model} value={model}>{model}</option>
                        ))}
                        <option value="__custom__">{t('settings.customModel')}</option>
                      </select>
                      {isCustomModelSelected && (
                        <input
                          type="text"
                          value={inputModel}
                          onChange={(e) => setInputModel(e.target.value)}
                          placeholder={t('settings.enterModelName')}
                          className="w-full mt-2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                      )}
                    </div>

                    {/* Base URL Input */}
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">API Host</label>
                      <input
                        type="text"
                        value={inputBaseUrl}
                        onChange={(e) => setInputBaseUrl(e.target.value)}
                        placeholder={provider.defaultBaseUrl}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        {provider.apiFormat === 'anthropic'
                          ? t('settings.anthropicFormatHint')
                          : t('settings.openaiFormatHint')}
                      </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSave(provider.id)}
                        disabled={saving || (!keys[provider.id] && !inputKey.trim())}
                        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50"
                      >
                        {saving ? t('settings.saving') : (keys[provider.id] && !inputKey.trim()) ? t('settings.updateConfig') : t('settings.save')}
                      </button>
                      <button
                        onClick={handleCancel}
                        className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                      >
                        {t('settings.cancel')}
                      </button>
                    </div>

                    <p className="text-xs text-gray-400">
                      {t('settings.keyStoredInKeyring')}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Language Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 p-4">
        <h2 className="text-lg font-semibold mb-2">{t('settings.language')}</h2>
        <p className="text-gray-500 text-sm mb-3">{t('settings.languageDescription')}</p>
        <div className="flex gap-2">
          <button
            onClick={() => setLocale('zh')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              locale === 'zh'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
            }`}
          >
            中文
          </button>
          <button
            onClick={() => setLocale('en')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              locale === 'en'
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h2 className="text-lg font-semibold mb-2">{t('settings.shortcuts')}</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-gray-700">{t('settings.quickCapture')}</span>
            <kbd className="px-2 py-1 bg-gray-100 rounded text-xs">Ctrl + Shift + D</kbd>
          </div>
          <div className="flex justify-between items-center py-2">
            <span className="text-gray-400">{t('settings.customShortcut')}</span>
            <span className="text-xs text-gray-400">{t('settings.inDevelopment')}</span>
          </div>
        </div>
      </div>

      {/* Prompt Settings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <PromptSettings />
      </div>
    </div>
  )
}
