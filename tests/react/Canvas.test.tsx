// tests/react/Canvas.test.tsx
import { render, screen, act } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { Canvas } from '../../src/components/Canvas/Canvas';
import { useFramework } from '../../src/hooks/useFramework';
import { KnowledgeFramework } from '../../src/types/framework';
import { I18nProvider } from '../../src/i18n';

const mockFramework: KnowledgeFramework = {
  id: '1',
  title: 'Test Framework',
  description: 'Test',
  structureType: 'pyramid',
  nodes: [
    {
      id: 'node-1',
      label: 'Test Node',
      content: 'Test Content',
      level: 1,
      state: 'virtual',
      metadata: {
        createdBy: 'ai',
      },
    },
    {
      id: 'node-2',
      label: 'Confirmed Node',
      content: 'Confirmed Content',
      level: 2,
      state: 'confirmed',
      metadata: {
        createdBy: 'user',
      },
    },
    {
      id: 'node-3',
      label: 'Locked Node',
      content: 'Locked Content',
      level: 3,
      state: 'locked',
      metadata: {
        createdBy: 'user',
      },
    },
  ],
  edges: [],
  createdFromDrops: [],
  lifecycle: 'building',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Canvas', () => {
  it('should render empty state when no framework', () => {
    render(
      <I18nProvider>
        <Canvas
          framework={null}
          onNodeClick={() => {}}
          onNodeContextMenu={() => {}}
        />
      </I18nProvider>
    );

    expect(screen.getByText('没有可显示的框架')).toBeInTheDocument();
  });

  it('should render nodes', () => {
    render(
      <I18nProvider>
        <Canvas
          framework={mockFramework}
          onNodeClick={() => {}}
          onNodeContextMenu={() => {}}
        />
      </I18nProvider>
    );

    expect(screen.getByText('Test Node')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });
});

describe('useFramework', () => {
  it('should initialize with null framework by default', () => {
    const { result } = renderHook(() => useFramework());
    expect(result.current.framework).toBeNull();
  });

  it('should initialize with provided framework', () => {
    const { result } = renderHook(() => useFramework(mockFramework));
    expect(result.current.framework).toEqual(mockFramework);
  });

  it('should confirm virtual node', () => {
    const { result } = renderHook(() => useFramework(mockFramework));

    expect(result.current.framework?.nodes[0].state).toBe('virtual');

    act(() => {
      result.current.confirmNode('node-1');
    });

    expect(result.current.framework?.nodes[0].state).toBe('confirmed');
  });

  it('should not confirm non-virtual node', () => {
    const { result } = renderHook(() => useFramework(mockFramework));

    expect(result.current.framework?.nodes[1].state).toBe('confirmed');

    act(() => {
      result.current.confirmNode('node-2');
    });

    // Should remain confirmed (not change)
    expect(result.current.framework?.nodes[1].state).toBe('confirmed');
  });

  it('should lock confirmed node', () => {
    const { result } = renderHook(() => useFramework(mockFramework));

    expect(result.current.framework?.nodes[1].state).toBe('confirmed');

    act(() => {
      result.current.lockNode('node-2');
    });

    expect(result.current.framework?.nodes[1].state).toBe('locked');
  });

  it('should not lock non-confirmed node', () => {
    const { result } = renderHook(() => useFramework(mockFramework));

    expect(result.current.framework?.nodes[0].state).toBe('virtual');

    act(() => {
      result.current.lockNode('node-1');
    });

    // Should remain virtual (not change)
    expect(result.current.framework?.nodes[0].state).toBe('virtual');
  });

  it('should delete node', () => {
    const { result } = renderHook(() => useFramework(mockFramework));

    expect(result.current.framework?.nodes.length).toBe(3);

    act(() => {
      result.current.deleteNode('node-1');
    });

    expect(result.current.framework?.nodes.length).toBe(2);
    expect(result.current.framework?.nodes.find(n => n.id === 'node-1')).toBeUndefined();
  });

  it('should handle state transitions (virtual -> confirmed -> locked)', () => {
    const { result } = renderHook(() => useFramework(mockFramework));

    // Start with virtual node
    expect(result.current.framework?.nodes[0].state).toBe('virtual');

    // Transition to confirmed
    act(() => {
      result.current.confirmNode('node-1');
    });
    expect(result.current.framework?.nodes[0].state).toBe('confirmed');

    // Transition to locked
    act(() => {
      result.current.lockNode('node-1');
    });
    expect(result.current.framework?.nodes[0].state).toBe('locked');
  });

  it('should set framework', () => {
    const { result } = renderHook(() => useFramework());

    expect(result.current.framework).toBeNull();

    act(() => {
      result.current.setFramework(mockFramework);
    });

    expect(result.current.framework).toEqual(mockFramework);
  });
});
