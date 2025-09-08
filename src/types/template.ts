export interface Template {
  id: number;
  name: string;
  description?: string;
  isPublic?: boolean;
  pdfFilePath?: string;
  pdfImagePath?: string;
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
}