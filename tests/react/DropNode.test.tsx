// tests/react/DropNode.test.tsx
import { render, screen } from '@testing-library/react';
import { DropNode } from '../../src/components/Mindscape/DropNode';

// Mock React Flow's Handle component since it requires zustand context
vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<typeof import('@xyflow/react')>('@xyflow/react');
  return {
    ...actual,
    Handle: ({ position: _p }: { position: string; type: string; className?: string }) =>
      null,
  };
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function renderDropNode(overrides: Record<string, unknown> = {}) {
  const props = {
    data: {
      id: 'drop-1',
      label: 'Some text content',
      contentType: 'text',
      frameworkCount: 2,
      ...((overrides.data as Record<string, unknown>) || {}),
    },
    selected: false,
    id: 'drop-1',
    type: 'dropNode',
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

  return render(<DropNode {...(props as any)} />);
}

describe('DropNode', () => {
  it('renders the label text', () => {
    renderDropNode();
    expect(screen.getByText('Some text content')).toBeInTheDocument();
  });

  it('shows content type label', () => {
    renderDropNode();
    expect(screen.getByText('text')).toBeInTheDocument();
  });

  it('shows framework count when > 0', () => {
    renderDropNode();
    expect(screen.getByText(/2 frameworks/)).toBeInTheDocument();
  });

  it('shows singular "framework" for count of 1', () => {
    renderDropNode({ data: { frameworkCount: 1 } });
    expect(screen.getByText(/1 framework$/)).toBeInTheDocument();
  });

  it('renders with different content types', () => {
    renderDropNode({ data: { contentType: 'url', label: 'https://example.com' } });
    expect(screen.getByText('url')).toBeInTheDocument();
    expect(screen.getByText('https://example.com')).toBeInTheDocument();
  });
});
