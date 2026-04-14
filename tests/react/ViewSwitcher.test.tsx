// tests/react/ViewSwitcher.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { ViewSwitcher } from '../../src/components/Mindscape/ViewSwitcher';
import { useMindscapeStore } from '../../src/stores/mindscapeStore';

// Reset store between tests
beforeEach(() => {
  useMindscapeStore.setState({
    viewMode: 'circle',
    graphData: null,
    materialData: null,
    loading: false,
    error: null,
    selectedFrameworkId: null,
    materialFilter: ['text', 'url', 'image', 'file', 'voice'],
    viewports: {},
  });
});

vi.mock('@xyflow/react', async () => {
  return {
    Panel: ({ children }: { children: React.ReactNode; position?: string }) =>
      <div data-testid="panel">{children}</div>,
  };
});

describe('ViewSwitcher', () => {
  it('renders 4 view mode buttons', () => {
    render(<ViewSwitcher />);
    expect(screen.getByText('Circle')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Structure')).toBeInTheDocument();
    expect(screen.getByText('Material')).toBeInTheDocument();
  });

  it('highlights the active view mode', () => {
    useMindscapeStore.setState({ viewMode: 'timeline' });
    render(<ViewSwitcher />);
    const timelineBtn = screen.getByText('Timeline').closest('button')!;
    expect(timelineBtn.className).toContain('bg-cyan-600');
  });

  it('changes view mode on click', () => {
    render(<ViewSwitcher />);
    fireEvent.click(screen.getByText('Structure'));
    expect(useMindscapeStore.getState().viewMode).toBe('structure');
  });
});
