// src/utils/dropHelpers.ts
import type { Drop, DropContent } from '../types/drop';

export type DropCategory = 'text' | 'url' | 'other';

export interface GroupedDrops {
  text: Drop[];
  url: Drop[];
  other: Drop[];
}

export function getCategory(drop: Drop): DropCategory {
  const type = drop.content?.type;
  if (type === 'text') return 'text';
  if (type === 'url') return 'url';
  return 'other';
}

export function groupByType(drops: Drop[]): GroupedDrops {
  const result: GroupedDrops = { text: [], url: [], other: [] };
  for (const drop of drops) {
    result[getCategory(drop)].push(drop);
  }
  return result;
}

export function groupByDate(drops: Drop[]): Map<string, Drop[]> {
  const map = new Map<string, Drop[]>();
  for (const drop of drops) {
    const day = drop.createdAt.slice(0, 10); // YYYY-MM-DD
    if (!map.has(day)) map.set(day, []);
    map.get(day)!.push(drop);
  }
  return map;
}

export function getCategoryLabel(cat: DropCategory): string {
  switch (cat) {
    case 'text': return '文本';
    case 'url': return 'URL';
    case 'other': return '其他';
  }
}

export function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'text': '文本',
    'url': '链接',
    'image': '图片',
    'file': '文件',
    'voice': '语音',
  };
  return labels[type] || type;
}

export function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    'text': 'bg-blue-100 text-blue-700',
    'url': 'bg-green-100 text-green-700',
    'image': 'bg-purple-100 text-purple-700',
    'file': 'bg-orange-100 text-orange-700',
    'voice': 'bg-pink-100 text-pink-700',
  };
  return colors[type] || 'bg-gray-100 text-gray-700';
}

export function getPreview(content: DropContent): string {
  if (!content || typeof content !== 'object') return '无效内容';
  if (content.type === 'text') return content.text || '';
  if (content.type === 'url') return content.url || '';
  if (content.type === 'image') return content.path || content.ocrText || '';
  if (content.type === 'file') return content.path || '';
  if (content.type === 'voice') return content.transcription || content.path || '';
  return '未知类型';
}

export function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().slice(0, 10);
  const day = dateStr.slice(0, 10);

  if (day === todayStr) return '今天';
  if (day === yesterdayStr) return '昨天';
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
