// tests/react/Canvas.test.tsx
import { render, screen } from '@testing-library/react';
import { Canvas } from '../../src/components/Canvas/Canvas';
import { KnowledgeFramework } from '../../src/types/framework';
import { I18nProvider } from '../../src/i18n';

// React Flow requires ResizeObserver (browser API not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

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
