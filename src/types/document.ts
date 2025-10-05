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
  reviewerName?: string;
  signatureData?: string;
  page: number;
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
  lastViewedAt?: string;
  status?: string;
  createdAt: string;
  updatedAt: string;
  isNew?: boolean; // 새로운 할당인지 확인하는 필드
}

export interface TemplateInfo {
  id: number;
  name: string;
  description?: string;
  isPublic?: boolean;
  pdfFilePath?: string;
  pdfImagePath?: string;
  pdfImagePaths?: string | string[]; // 다중 페이지 PDF 이미지 경로 추가
  isMultiPage?: boolean; // 다중 페이지 여부
  totalPages?: number; // 총 페이지 수
  pdfPagesData?: string; // PDF 페이지 메타데이터
  coordinateFields?: string;
  deadline?: string; // 만료일 추가
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
  deadline?: string;
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