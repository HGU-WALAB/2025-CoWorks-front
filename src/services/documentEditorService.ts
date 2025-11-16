import axios from 'axios';
import { API_BASE_URL } from '../config/api';

/**
 * CoordinateField 타입 정의
 */
export interface CoordinateFieldData {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'text' | 'textarea' | 'date' | 'number' | 'editor_signature';
  value?: string;
  required?: boolean;
  fontSize?: number;
  fontFamily?: string;
  page?: number;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[];
  };
}

/**
 * 문서 필드 값 저장 (단일 필드)
 */
export const saveDocumentFieldValue = async (
  documentId: string | number,
  templateFieldId: number,
  value: string
): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/documents/${documentId}/field-values`, {
      templateFieldId,
      value
    });
  } catch (error) {
    console.error('문서 필드 값 저장 실패:', {
      documentId,
      templateFieldId,
      value,
      error
    });
    throw error;
  }
};

/**
 * 문서 전체 데이터 저장 (coordinateFields)
 */
export const saveDocumentData = async (
  documentId: string | number,
  coordinateFields: CoordinateFieldData[]
): Promise<void> => {
  try {
    const updatedData = {
      coordinateFields: coordinateFields.map(field => ({
        id: field.id,
        label: field.label,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        type: field.type,
        value: field.value,
        required: field.required || false,
        fontSize: field.fontSize || 18,
        fontFamily: field.fontFamily || 'Arial',
        page: field.page || 1,
        ...(field.tableData && { tableData: field.tableData })
      }))
    };

    await axios.put(`${API_BASE_URL}/documents/${documentId}`, {
      data: updatedData
    });
  } catch (error) {
    console.error('문서 데이터 저장 실패:', error);
    throw error;
  }
};

/**
 * 편집 시작 API 호출
 */
export const startEditing = async (documentId: string | number): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/documents/${documentId}/start-editing`);
  } catch (error) {
    console.error('편집 시작 실패:', error);
    throw error;
  }
};

/**
 * 편집 완료 API 호출
 */
export const completeEditing = async (documentId: string | number): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/documents/${documentId}/complete-editing`);
  } catch (error) {
    console.error('편집 완료 실패:', error);
    throw error;
  }
};

/**
 * 검토 제출 API 호출
 */
export const submitForReview = async (documentId: string | number): Promise<void> => {
  try {
    await axios.post(`${API_BASE_URL}/documents/${documentId}/submit-for-review`);
  } catch (error) {
    console.error('검토 제출 실패:', error);
    throw error;
  }
};
