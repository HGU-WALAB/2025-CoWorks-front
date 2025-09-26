export interface Template {
  id: number;
  name: string;
  description?: string;
  isPublic?: boolean;
  pdfFilePath?: string;
  pdfImagePath?: string;
  deadline?: string; // 만료일 추가
  defaultFolderId?: string | null;
  defaultFolderName?: string | null;
  createdById: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCreateRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  pdfFilePath?: string;
  pdfImagePath?: string;
  deadline?: string; // 만료일 추가
  defaultFolderId?: string | null;
}