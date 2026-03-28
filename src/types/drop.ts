export interface Drop {
  id: string;
  content: DropContent;
  metadata: DropMetadata;
  createdAt: string;
  updatedAt: string;
  status: 'raw' | 'processed' | 'archived';
}

export type DropContent =
  | { type: 'text'; text: string }
  | { type: 'url'; url: string; title?: string }
  | { type: 'image'; path: string; ocrText?: string }
  | { type: 'file'; path: string; fileType: string }
  | { type: 'voice'; path: string; transcription?: string };

export interface DropMetadata {
  source: 'shareSheet' | 'hotkey' | 'browser' | 'manual';
  tags: string[];
  relatedFrameworkIds: string[];
}
