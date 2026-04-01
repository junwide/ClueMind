export type DropType = 'text' | 'url' | 'image' | 'file' | 'voice';

export interface TextContent {
  type: 'text';
  text: string;
}

export interface UrlContent {
  type: 'url';
  url: string;
  title?: string;
}

export interface ImageContent {
  type: 'image';
  path: string;
  ocrText?: string;
}

export interface FileContent {
  type: 'file';
  path: string;
  fileType: string;
}

export interface VoiceContent {
  type: 'voice';
  path: string;
  transcription?: string;
}

export type DropContent = TextContent | UrlContent | ImageContent | FileContent | VoiceContent;

export interface DropMetadata {
  source: 'sharesheet' | 'hotkey' | 'browser' | 'manual';
  tags: string[];
  relatedFrameworkIds: string[];
}

export interface Drop {
  id: string;
  content: DropContent;
  metadata: DropMetadata;
  createdAt: string;
  updatedAt: string;
  status: 'raw' | 'processed' | 'archived';
}
