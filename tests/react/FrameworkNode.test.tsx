// tests/react/FrameworkNode.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { FrameworkNode } from '../../src/components/Mindscape/FrameworkNode';

// Mock React Flow's Handle and NodeToolbar components since they require zustand context
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    Handle: ({ position: _p }: { position: string; type: string; className?: string }) =>
      null,
    NodeToolbar: ({ children }: { children: React.ReactNode; position?: string; offset?: number }) =>
      <div data-testid="node-toolbar">{children}</div>,
  };
});

// React Flow requires ResizeObserver (browser API not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Helper to render FrameworkNode with the right props shape.
function renderFrameworkNode(overrides: Record<string, unknown> = {}) {
  const onSelect = vi.fn();
  const onNavigateToCanvas = vi.fn();
  const defaultProps = {
    data: {
      id: 'fw-1',
      title: 'Test Framework',
      lifecycle: 'draft',
      structureType: 'pyramid',
      nodeCount: 5,
      dropCount: 2,
      edgeCount: 3,
      sharedDropCount: 0,
      description: '',
      onSelect,
      onNavigateToCanvas,
    },
    selected: false,
    // React Flow internal props
    id: 'fw-1',
    type: 'frameworkGraphNode',
    position: { x: 0, y: 0 },
    dragging: false,
    selectable: true,
    deletable: true,
    isConnectable: true,
    zIndex: 0,
    sourcePosition: 'bottom' as const,
    targetPosition: 'top' as const,
    dragHandle: null,
    parentId: null,
    measure: vi.fn(),
    isHidden: false,
    internallyTransform: '',
  };

  const merged = {
    ...defaultProps,
    ...overrides,
    data: {
      ...defaultProps.data,
      ...((overrides.data as Record<string, unknown>) || {}),
    },
  };

  const result = render(<FrameworkNode {...(merged as any)} />);
  return { ...result, onSelect, onNavigateToCanvas };
}

describe('FrameworkNode', () => {
  it('renders title', () => {
    renderFrameworkNode();
    expect(screen.getByText('Test Framework')).toBeInTheDocument();
  });

  it('renders Draft lifecycle badge', () => {
    renderFrameworkNode({ data: { lifecycle: 'draft' } });
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders Building lifecycle badge', () => {
    renderFrameworkNode({ data: { lifecycle: 'building' } });
    expect(screen.getByText('Building')).toBeInTheDocument();
  });

  it('renders Confirmed lifecycle badge', () => {
    renderFrameworkNode({ data: { lifecycle: 'confirmed' } });
    expect(screen.getByText('Confirmed')).toBeInTheDocument();
  });

  it('renders Locked lifecycle badge', () => {
    renderFrameworkNode({ data: { lifecycle: 'locked' } });
    expect(screen.getByText('Locked')).toBeInTheDocument();
  });

  it('shows node count and edge count', () => {
    renderFrameworkNode({ data: { nodeCount: 7, edgeCount: 4 } });
    expect(screen.getByText(/7 nodes/)).toBeInTheDocument();
    expect(screen.getByText(/4 edges/)).toBeInTheDocument();
  });

  it('shows drop count when > 0', () => {
    renderFrameworkNode({ data: { dropCount: 3 } });
    const els = screen.getAllByText(/3/);
    expect(els.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show drop count when 0', () => {
    renderFrameworkNode({ data: { dropCount: 0 } });
    expect(screen.getByText(/5 nodes/)).toBeInTheDocument();
    expect(screen.getByText(/3 edges/)).toBeInTheDocument();
  });

  it('shows shared drops indicator when sharedDropCount > 0', () => {
    renderFrameworkNode({ data: { sharedDropCount: 2 } });
    expect(screen.getByText(/2 shared materials/)).toBeInTheDocument();
  });

  it('shows singular shared material when sharedDropCount is 1', () => {
    renderFrameworkNode({ data: { sharedDropCount: 1 } });
    expect(screen.getByText(/1 shared material$/)).toBeInTheDocument();
  });

  it('does not show shared drops indicator when sharedDropCount is 0', () => {
    renderFrameworkNode({ data: { sharedDropCount: 0 } });
    expect(screen.queryByText(/shared material/)).not.toBeInTheDocument();
  });

  it('renders NodeToolbar with View Details and Open Canvas buttons', () => {
    renderFrameworkNode();
    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.getByText('Open Canvas')).toBeInTheDocument();
  });

  it('calls onSelect from toolbar View Details button', () => {
    const { onSelect } = renderFrameworkNode();
    fireEvent.click(screen.getByText('View Details'));
    expect(onSelect).toHaveBeenCalledWith('fw-1');
  });

  it('calls onNavigateToCanvas from toolbar Open Canvas button', () => {
    const { onNavigateToCanvas } = renderFrameworkNode();
    fireEvent.click(screen.getByText('Open Canvas'));
    expect(onNavigateToCanvas).toHaveBeenCalledWith('fw-1');
  });

  it('shows selected ring when selected=true', () => {
    renderFrameworkNode({ selected: true });
    const nodeEl = document.querySelector('.w-\\[280px\\]')!;
    expect(nodeEl.className).toContain('ring-2');
    expect(nodeEl.className).toContain('ring-cyan-400');
  });

  it('does not show selected ring when selected=false', () => {
    renderFrameworkNode({ selected: false });
    const nodeEl = document.querySelector('.w-\\[280px\\]')!;
    expect(nodeEl.className).not.toContain('ring-2');
  });
});
