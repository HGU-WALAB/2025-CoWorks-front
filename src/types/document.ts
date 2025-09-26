import { TemplateField } from './field';

export interface DocumentData {
  title?: string;
  content?: string;
  createdAt?: string;
  signatures?: Record<string, string>;
  coordinateFields?: CoordinateField[];
  signatureFields?: SignatureField[];
}

export interface CoordinateField extends TemplateField {
  value?: string;
}

export interface SignatureField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  reviewerEmail: string;
  signatureData?: string;
}

export interface DocumentStatusLog {
  id: number;
  status: 'DRAFT' | 'EDITING' | 'READY_FOR_REVIEW' | 'REVIEWING' | 'COMPLETED' | 'REJECTED';
  timestamp: string;
  changedByEmail?: string;
  changedByName?: string;
  comment?: string;
}

export interface TaskInfo {
  id: number;
  role: string;
  assignedUserName: string;
  assignedUserEmail: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateInfo {
  id: number;
  name: string;
  description?: string;
  isPublic?: boolean;
  pdfFilePath?: string;
  pdfImagePath?: string;
  coordinateFields?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Document {
  id: number;
  templateId: number;
  title: string;
  templateName?: string;
  data?: DocumentData;
  status: 'DRAFT' | 'EDITING' | 'READY_FOR_REVIEW' | 'REVIEWING' | 'COMPLETED' | 'REJECTED';
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  tasks?: TaskInfo[];
  template?: TemplateInfo;
  statusLogs?: DocumentStatusLog[];
  // 폴더 관련 필드
  folderId?: string | null;
  folderName?: string | null;
}

export interface DocumentCreateRequest {
  templateId: number;
  editorEmail?: string;
  title?: string;
}

export interface DocumentUpdateRequest {
  data: DocumentData;
}

export interface TableData {
  rows: number;
  cols: number;
  cells: string[][];
  columnWidths?: number[];
}