// tests/react/FrameworkDetailPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FrameworkDetailPanel } from '../../src/components/Mindscape/FrameworkDetailPanel';
import { useMindscapeStore } from '../../src/stores/mindscapeStore';
import type { FrameworkGraphData } from '../../src/types/mindscape';

// Mock ResizablePanel
vi.mock('../../src/components/Layout/ResizablePanel', () => ({
  ResizablePanel: ({ children }: { children: React.ReactNode }) =>
    <div data-testid="resizable-panel">{children}</div>,
}));

const mockGraphData: FrameworkGraphData = {
  nodes: [
    {
      id: 'fw-1',
      title: 'Test Framework',
      description: 'A test description',
      lifecycle: 'building',
      structureType: 'pyramid',
      nodeCount: 5,
      edgeCount: 3,
      dropCount: 2,
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-02-01T12:00:00Z',
    },
  ],
  edges: [],
};

beforeEach(() => {
  useMindscapeStore.setState({
    viewMode: 'circle',
    graphData: mockGraphData,
    selectedFrameworkId: 'fw-1',
    loading: false,
    error: null,
    materialData: null,
    materialFilter: ['text', 'url', 'image', 'file', 'voice'],
    viewports: {},
  });
});

describe('FrameworkDetailPanel', () => {
  it('renders nothing when no framework is selected', () => {
    useMindscapeStore.setState({ selectedFrameworkId: null });
    const { container } = render(
      <FrameworkDetailPanel onNavigateToCanvas={() => {}} />
    );
    expect(container.innerHTML).toBe('');
  });

  it('renders framework details when selected', () => {
    render(<FrameworkDetailPanel onNavigateToCanvas={() => {}} />);
    expect(screen.getByText('Test Framework')).toBeInTheDocument();
    expect(screen.getByText('Building')).toBeInTheDocument();
    expect(screen.getByText('Pyramid')).toBeInTheDocument();
  });

  it('shows stats', () => {
    render(<FrameworkDetailPanel onNavigateToCanvas={() => {}} />);
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    render(<FrameworkDetailPanel onNavigateToCanvas={() => {}} />);
    fireEvent.click(screen.getByText('✕'));
    expect(useMindscapeStore.getState().selectedFrameworkId).toBeNull();
  });

  it('calls onNavigateToCanvas when Open in Canvas is clicked', () => {
    const navigate = vi.fn();
    render(<FrameworkDetailPanel onNavigateToCanvas={navigate} />);
    fireEvent.click(screen.getByText('Open in Canvas'));
    expect(navigate).toHaveBeenCalledWith('fw-1');
  });
});
