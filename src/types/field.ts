export interface TemplateField {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  type?: 'field' | 'table' | 'editor_signature' | 'signer_signature' | 'reviewer_signature';
  fontSize?: number;
  fontFamily?: string;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[];
  };
  reviewerIndex?: number; // 여러 서명자 필드 구분용
}

export interface CoordinateField {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  type?: 'field' | 'table' | 'editor_signature' | 'signer_signature' | 'reviewer_signature';
  value?: string;
  fontSize?: number;
  fontFamily?: string;
  tableData?: any;
  reviewerIndex?: number; // 여러 서명자 필드 구분용
}