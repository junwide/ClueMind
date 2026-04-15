// tests/react/SyncSettings.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncSettings } from '../../src/components/Settings/SyncSettings';
import { I18nProvider } from '../../src/i18n';

// Mock Tauri APIs
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

// Default mock config loader
function setupMocks(overrides: Record<string, unknown> = {}) {
  mockInvoke.mockImplementation((cmd: string) => {
    if (cmd === 'get_sync_config') {
      return Promise.resolve(overrides.get_sync_config ?? {
        serverUrl: null,
        enabled: false,
        autoSyncIntervalMinutes: 30,
      });
    }
    if (cmd === 'get_sync_token') {
      return Promise.resolve(overrides.get_sync_token ?? null);
    }
    if (cmd === 'get_sync_status') {
      return Promise.resolve(overrides.get_sync_status ?? null);
    }
    if (cmd === 'test_server_connection') {
      return Promise.resolve('Connection successful');
    }
    return Promise.resolve({});
  });
}

describe('SyncSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMocks();
  });

  it('renders sync settings panel', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    // Renders the title (Chinese by default)
    expect(await screen.findByText('服务器同步')).toBeInTheDocument();
    // Renders server URL label
    expect(screen.getByText('服务器地址')).toBeInTheDocument();
  });

  it('displays server URL input with placeholder', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const input = await screen.findByPlaceholderText('http://localhost:3817');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'text');
  });

  it('displays auth token as password input', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const input = await screen.findByPlaceholderText('输入服务器认证令牌');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('disables test connection when inputs are empty', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    // "测试连接" = Test Connection in Chinese
    const btn = await screen.findByText('测试连接');
    expect(btn).toBeDisabled();
  });

  it('enables test connection when server URL and token are filled', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const urlInput = await screen.findByPlaceholderText('http://localhost:3817');
    const tokenInput = await screen.findByPlaceholderText('输入服务器认证令牌');

    fireEvent.change(urlInput, { target: { value: 'http://localhost:3817' } });
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });

    const btn = screen.getByText('测试连接');
    expect(btn).not.toBeDisabled();
  });

  it('calls test_server_connection on test click', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const urlInput = await screen.findByPlaceholderText('http://localhost:3817');
    const tokenInput = await screen.findByPlaceholderText('输入服务器认证令牌');
    fireEvent.change(urlInput, { target: { value: 'http://localhost:3817' } });
    fireEvent.change(tokenInput, { target: { value: 'my-token' } });

    const btn = screen.getByText('测试连接');
    fireEvent.click(btn);

    // Wait for async invoke to complete
    await screen.findByText('Connection successful');
    expect(mockInvoke).toHaveBeenCalledWith('test_server_connection', {
      serverUrl: 'http://localhost:3817',
      token: 'my-token',
    });
  });

  it('shows save button', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    // "保存" = Save in Chinese
    expect(await screen.findByText('保存')).toBeInTheDocument();
  });

  it('shows last synced as "从未同步" when no sync has happened', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    expect(await screen.findByText(/从未同步/)).toBeInTheDocument();
  });

  it('masks existing token on load', async () => {
    setupMocks({ get_sync_token: 'my-secret-token' });

    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const tokenInput = await screen.findByDisplayValue('••••••••');
    expect(tokenInput).toBeInTheDocument();
  });

  it('save invokes save_sync_config, save_sync_token, and rebuild_sync_engine', async () => {
    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const urlInput = await screen.findByPlaceholderText('http://localhost:3817');
    const tokenInput = await screen.findByPlaceholderText('输入服务器认证令牌');
    fireEvent.change(urlInput, { target: { value: 'http://localhost:3817' } });
    fireEvent.change(tokenInput, { target: { value: 'new-token' } });

    const saveBtn = screen.getByText('保存');
    fireEvent.click(saveBtn);

    // Wait for async operations
    await screen.findByText('同步设置已保存');

    expect(mockInvoke).toHaveBeenCalledWith('save_sync_config', {
      serverUrl: 'http://localhost:3817',
      enabled: false,
      autoSyncIntervalMinutes: 30,
    });
    expect(mockInvoke).toHaveBeenCalledWith('save_sync_token', { token: 'new-token' });
    expect(mockInvoke).toHaveBeenCalledWith('rebuild_sync_engine');
  });

  it('shows error when test connection fails', async () => {
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'get_sync_config') return Promise.resolve({ serverUrl: null, enabled: false, autoSyncIntervalMinutes: 30 });
      if (cmd === 'get_sync_token') return Promise.resolve(null);
      if (cmd === 'get_sync_status') return Promise.resolve(null);
      if (cmd === 'test_server_connection') return Promise.reject(new Error('Connection refused'));
      return Promise.resolve({});
    });

    render(<I18nProvider><SyncSettings /></I18nProvider>);

    const urlInput = await screen.findByPlaceholderText('http://localhost:3817');
    const tokenInput = await screen.findByPlaceholderText('输入服务器认证令牌');
    fireEvent.change(urlInput, { target: { value: 'http://bad-server' } });
    fireEvent.change(tokenInput, { target: { value: 'token' } });

    const testBtn = screen.getByText('测试连接');
    fireEvent.click(testBtn);

    // Error message should appear
    expect(await screen.findByText(/Error: Connection refused/)).toBeInTheDocument();
  });
});
