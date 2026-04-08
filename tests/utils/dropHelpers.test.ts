// tests/utils/dropHelpers.test.ts
import {
  getCategory,
  groupByType,
  groupByDate,
  getCategoryLabel,
  getTypeLabel,
  getTypeColor,
  getPreview,
} from '../../src/utils/dropHelpers';
import type { Drop } from '../../src/types/drop';

// Helper to create mock drops
function makeDrop(overrides: Partial<Drop> & { id: string; type: string; text?: string; url?: string; path?: string }): Drop {
  const { id, type, text, url, path, ...rest } = overrides;
  let content: Drop['content'];
  switch (type) {
    case 'text':
      content = { type: 'text', text: text ?? 'hello' };
      break;
    case 'url':
      content = { type: 'url', url: url ?? 'https://example.com' };
      break;
    case 'image':
      content = { type: 'image', path: path ?? '/img/x.png' };
      break;
    case 'file':
      content = { type: 'file', path: path ?? '/file/doc.pdf', fileType: 'pdf' };
      break;
    case 'voice':
      content = { type: 'voice', path: path ?? '/voice/a.wav', transcription: 'hello world' };
      break;
    default:
      content = { type: 'text', text: 'fallback' };
  }
  return {
    id,
    content,
    metadata: { source: 'manual', tags: [], relatedFrameworkIds: [] },
    createdAt: rest.createdAt ?? '2026-01-15T10:00:00Z',
    updatedAt: rest.updatedAt ?? '2026-01-15T10:00:00Z',
    status: 'raw',
    ...rest,
  } as Drop;
}

describe('getCategory', () => {
  it('returns "text" for type="text"', () => {
    const drop = makeDrop({ id: '1', type: 'text' });
    expect(getCategory(drop)).toBe('text');
  });

  it('returns "url" for type="url"', () => {
    const drop = makeDrop({ id: '2', type: 'url' });
    expect(getCategory(drop)).toBe('url');
  });

  it('returns "other" for type="image"', () => {
    const drop = makeDrop({ id: '3', type: 'image' });
    expect(getCategory(drop)).toBe('other');
  });

  it('returns "other" for type="file"', () => {
    const drop = makeDrop({ id: '4', type: 'file' });
    expect(getCategory(drop)).toBe('other');
  });

  it('returns "other" for type="voice"', () => {
    const drop = makeDrop({ id: '5', type: 'voice' });
    expect(getCategory(drop)).toBe('other');
  });
});

describe('groupByType', () => {
  it('correctly groups drops into text/url/other arrays', () => {
    const drops = [
      makeDrop({ id: '1', type: 'text' }),
      makeDrop({ id: '2', type: 'url' }),
      makeDrop({ id: '3', type: 'image' }),
      makeDrop({ id: '4', type: 'text' }),
      makeDrop({ id: '5', type: 'file' }),
    ];
    const grouped = groupByType(drops);
    expect(grouped.text).toHaveLength(2);
    expect(grouped.url).toHaveLength(1);
    expect(grouped.other).toHaveLength(2);
    expect(grouped.text.map(d => d.id)).toEqual(['1', '4']);
    expect(grouped.url.map(d => d.id)).toEqual(['2']);
    expect(grouped.other.map(d => d.id)).toEqual(['3', '5']);
  });

  it('returns empty arrays for empty input', () => {
    const grouped = groupByType([]);
    expect(grouped.text).toHaveLength(0);
    expect(grouped.url).toHaveLength(0);
    expect(grouped.other).toHaveLength(0);
  });
});

describe('groupByDate', () => {
  it('groups drops by YYYY-MM-DD prefix', () => {
    const drops = [
      makeDrop({ id: '1', type: 'text', createdAt: '2026-01-15T10:00:00Z' } as any),
      makeDrop({ id: '2', type: 'text', createdAt: '2026-01-15T14:00:00Z' } as any),
      makeDrop({ id: '3', type: 'text', createdAt: '2026-01-16T09:00:00Z' } as any),
    ];
    const grouped = groupByDate(drops);
    expect(grouped.size).toBe(2);
    expect(grouped.get('2026-01-15')!).toHaveLength(2);
    expect(grouped.get('2026-01-16')!).toHaveLength(1);
  });

  it('returns empty Map for empty input', () => {
    const grouped = groupByDate([]);
    expect(grouped.size).toBe(0);
  });
});

describe('getCategoryLabel', () => {
  it('returns correct Chinese labels', () => {
    expect(getCategoryLabel('text')).toBe('文本');
    expect(getCategoryLabel('url')).toBe('URL');
    expect(getCategoryLabel('other')).toBe('其他');
  });
});

describe('getTypeLabel', () => {
  it('returns correct labels for known types', () => {
    expect(getTypeLabel('text')).toBe('文本');
    expect(getTypeLabel('url')).toBe('链接');
    expect(getTypeLabel('image')).toBe('图片');
    expect(getTypeLabel('file')).toBe('文件');
    expect(getTypeLabel('voice')).toBe('语音');
  });

  it('returns raw type string as fallback for unknown types', () => {
    expect(getTypeLabel('unknown')).toBe('unknown');
    expect(getTypeLabel('video')).toBe('video');
  });
});

describe('getTypeColor', () => {
  it('returns correct Tailwind classes for known types', () => {
    expect(getTypeColor('text')).toBe('bg-blue-100 text-blue-700');
    expect(getTypeColor('url')).toBe('bg-green-100 text-green-700');
    expect(getTypeColor('image')).toBe('bg-purple-100 text-purple-700');
    expect(getTypeColor('file')).toBe('bg-orange-100 text-orange-700');
    expect(getTypeColor('voice')).toBe('bg-pink-100 text-pink-700');
  });

  it('returns default gray classes for unknown types', () => {
    expect(getTypeColor('unknown')).toBe('bg-gray-100 text-gray-700');
  });
});

describe('getPreview', () => {
  it('returns text for text content', () => {
    expect(getPreview({ type: 'text', text: 'hello world' })).toBe('hello world');
  });

  it('returns url for url content', () => {
    expect(getPreview({ type: 'url', url: 'https://example.com' })).toBe('https://example.com');
  });

  it('returns path for image content', () => {
    expect(getPreview({ type: 'image', path: '/img/photo.png' })).toBe('/img/photo.png');
  });

  it('returns path for file content', () => {
    expect(getPreview({ type: 'file', path: '/docs/file.pdf', fileType: 'pdf' })).toBe('/docs/file.pdf');
  });

  it('returns transcription for voice content when available', () => {
    expect(getPreview({ type: 'voice', path: '/audio/a.wav', transcription: 'spoken text' })).toBe('spoken text');
  });

  it('returns path for voice content when transcription is missing', () => {
    expect(getPreview({ type: 'voice', path: '/audio/a.wav' })).toBe('/audio/a.wav');
  });

  it('returns invalid content string for null/undefined', () => {
    expect(getPreview(null as any)).toBe('无效内容');
    expect(getPreview(undefined as any)).toBe('无效内容');
  });

  it('returns empty string for text content with no text', () => {
    expect(getPreview({ type: 'text', text: '' })).toBe('');
  });

  it('returns unknown type for unrecognized content type', () => {
    expect(getPreview({ type: 'custom', foo: 'bar' } as any)).toBe('未知类型');
  });

  it('returns ocrText for image when path is empty', () => {
    expect(getPreview({ type: 'image', path: '', ocrText: 'recognized text' })).toBe('recognized text');
  });
});
