import { useState, useCallback, useRef } from 'react';
import { CoordinateFieldData, saveDocumentFieldValue as saveFieldValueAPI } from '../services/documentEditorService';

/**
 * 문서 필드 관리를 위한 커스텀 훅
 */
export const useDocumentFields = (documentId: string | undefined) => {
  const [coordinateFields, setCoordinateFields] = useState<CoordinateFieldData[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // 저장 타이머 및 대기 중인 저장 작업 관리
  const saveTimeouts = useRef(new Map<string, NodeJS.Timeout>());
  const pendingSaves = useRef(new Map<string, any>());

  /**
   * 필드 값 변경 핸들러
   */
  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setCoordinateFields(prev => 
      prev.map(field => 
        field.id === fieldId ? { ...field, value } : field
      )
    );
  }, []);

  /**
   * 테이블 셀 값 변경 핸들러
   */
  const handleTableCellChange = useCallback((
    fieldId: string,
    rowIndex: number,
    colIndex: number,
    newValue: string
  ) => {
    setCoordinateFields(prev =>
      prev.map(field => {
        if (field.id !== fieldId || !field.tableData) return field;

        const updatedCells = field.tableData.cells.map((row, rIdx) =>
          rIdx === rowIndex
            ? row.map((cell, cIdx) => (cIdx === colIndex ? newValue : cell))
            : row
        );

        return {
          ...field,
          tableData: {
            ...field.tableData,
            cells: updatedCells
          },
          value: JSON.stringify({
            rows: field.tableData.rows,
            cols: field.tableData.cols,
            cells: updatedCells,
            columnWidths: field.tableData.columnWidths
          })
        };
      })
    );
  }, []);

  /**
   * 필드 값 저장 (디바운스 포함)
   */
  const saveFieldValue = useCallback(async (
    templateFieldId: number,
    value: string
  ) => {
    if (!documentId) return;

    try {
      await saveFieldValueAPI(documentId, templateFieldId, value);
      setLastSaved(new Date());
    } catch (error) {
      console.error('필드 값 저장 실패:', error);
    }
  }, [documentId]);

  /**
   * 모든 저장 타이머 클리어
   */
  const clearAllSaveTimeouts = useCallback(() => {
    saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
    saveTimeouts.current.clear();
    pendingSaves.current.clear();
  }, []);

  return {
    coordinateFields,
    setCoordinateFields,
    isSaving,
    setIsSaving,
    lastSaved,
    setLastSaved,
    handleFieldChange,
    handleTableCellChange,
    saveFieldValue,
    clearAllSaveTimeouts,
    saveTimeouts,
    pendingSaves
  };
};
