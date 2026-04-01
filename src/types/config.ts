export interface AppConfig {
  llm: LLMConfig;
  ui: UIConfig;
  storage: StorageConfig;
  shortcuts: Record<string, string>;
  logging: LoggingConfig;
}

export interface LLMConfig {
  defaultProvider: 'glm' | 'qwen' | 'openai' | 'claude';
  providers: Record<string, ProviderConfig>;
}

export interface ProviderConfig {
  apiKeyRef: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface UIConfig {
  theme: string;
  fontSize: number;
}

export interface StorageConfig {
  dataDir: string;
}

export interface LoggingConfig {
  level: string;
  filePath: string;
}
