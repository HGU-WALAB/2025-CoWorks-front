export interface TemplateField {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  required: boolean;
  type?: 'field' | 'table';
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
  type?: 'field' | 'table';
  value?: string;
  fontSize?: number;
  fontFamily?: string;
  tableData?: any;
}