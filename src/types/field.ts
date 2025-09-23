export interface TemplateField {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  type?: 'field' | 'table' | 'editor_signature';
  fontSize?: number;
  fontFamily?: string;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[];
  };
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
  type?: 'field' | 'table' | 'editor_signature';
  value?: string;
  fontSize?: number;
  fontFamily?: string;
  tableData?: any;
}