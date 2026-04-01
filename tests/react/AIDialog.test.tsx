// tests/react/AIDialog.test.tsx
import { render, screen } from '@testing-library/react';
import { AIDialog } from '../../src/components/AI/AIDialog';
import { I18nProvider } from '../../src/i18n';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue({ frameworks: [], recommended_drops: [] }),
}));

// Mock Zustand store
vi.mock('../../src/stores/dropStore', () => ({
  useDropStore: () => ({
    drops: [],
    loading: false,
    error: null,
    fetchDrops: vi.fn(),
    createTextDrop: vi.fn(),
    createUrlDrop: vi.fn(),
    createImageDrop: vi.fn(),
    deleteDrop: vi.fn(),
    updateDrop: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useAIChat', () => ({
  useAIChat: () => ({
    generateFrameworks: vi.fn().mockResolvedValue({ frameworks: [], recommended_drops: [] }),
    refineFramework: vi.fn().mockResolvedValue({ frameworks: [], recommended_drops: [] }),
    status: 'idle',
    error: null,
    reset: vi.fn(),
  }),
}));

describe('AIDialog', () => {
  it('should render drop selection UI', () => {
    render(<I18nProvider><AIDialog /></I18nProvider>);

    expect(screen.getByText(/AI 助手 - 选择素材/)).toBeInTheDocument();
    expect(screen.getByText(/选择你想要整理的 Drop/)).toBeInTheDocument();
  });

  it('should show empty state when no drops', () => {
    render(<I18nProvider><AIDialog /></I18nProvider>);

    expect(screen.getByText(/还没有任何 Drop/)).toBeInTheDocument();
  });

  it('should show generate button (disabled)', () => {
    render(<I18nProvider><AIDialog /></I18nProvider>);

    const generateButton = screen.getByText('生成框架');
    expect(generateButton).toBeInTheDocument();
    expect(generateButton).toBeDisabled();
  });
});
