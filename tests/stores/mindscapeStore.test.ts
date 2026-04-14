// tests/stores/mindscapeStore.test.ts
import { useMindscapeStore } from '../../src/stores/mindscapeStore';

beforeEach(() => {
  useMindscapeStore.setState({
    graphData: null,
    materialData: null,
    loading: false,
    error: null,
    viewMode: 'circle',
    selectedFrameworkId: null,
    materialFilter: ['text', 'url', 'image', 'file', 'voice'],
    viewports: {},
  });
});

describe('useMindscapeStore', () => {
  it('initializes with correct defaults', () => {
    const state = useMindscapeStore.getState();
    expect(state.viewMode).toBe('circle');
    expect(state.selectedFrameworkId).toBeNull();
    expect(state.graphData).toBeNull();
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setViewMode changes the view mode', () => {
    useMindscapeStore.getState().setViewMode('timeline');
    expect(useMindscapeStore.getState().viewMode).toBe('timeline');
  });

  it('setViewMode clears selected framework', () => {
    useMindscapeStore.getState().selectFramework('fw-1');
    expect(useMindscapeStore.getState().selectedFrameworkId).toBe('fw-1');
    useMindscapeStore.getState().setViewMode('structure');
    expect(useMindscapeStore.getState().selectedFrameworkId).toBeNull();
  });

  it('selectFramework sets and clears the selected ID', () => {
    useMindscapeStore.getState().selectFramework('fw-1');
    expect(useMindscapeStore.getState().selectedFrameworkId).toBe('fw-1');
    useMindscapeStore.getState().selectFramework(null);
    expect(useMindscapeStore.getState().selectedFrameworkId).toBeNull();
  });

  it('setViewport stores viewport per view mode', () => {
    useMindscapeStore.getState().setViewport('circle', { x: 10, y: 20, zoom: 1.5 });
    useMindscapeStore.getState().setViewport('timeline', { x: 50, y: 0, zoom: 0.8 });
    const state = useMindscapeStore.getState();
    expect(state.viewports.circle).toEqual({ x: 10, y: 20, zoom: 1.5 });
    expect(state.viewports.timeline).toEqual({ x: 50, y: 0, zoom: 0.8 });
  });

  it('setMaterialFilter updates the filter', () => {
    useMindscapeStore.getState().setMaterialFilter(['text', 'image']);
    expect(useMindscapeStore.getState().materialFilter).toEqual(['text', 'image']);
  });

  it('clearError clears the error', () => {
    useMindscapeStore.setState({ error: 'test error' });
    expect(useMindscapeStore.getState().error).toBe('test error');
    useMindscapeStore.getState().clearError();
    expect(useMindscapeStore.getState().error).toBeNull();
  });
});
