import { useState, useCallback } from 'react';
import { CoordinateField } from '../types/field';
import { createDebounce } from '../utils/debounce';

export const useDocumentEditor = () => {
  const [coordinateFields, setCoordinateFields] = useState<CoordinateField[]>([]);
  const [documentData, setDocumentData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);

  const debouncedSave = useCallback(
    createDebounce(async (data: any) => {
      setIsSaving(true);
      try {
        // Save logic here
        console.log('Saving document data:', data);
      } catch (error) {
        console.error('Save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  const updateFieldValue = useCallback((fieldId: string, value: any) => {
    const newData = { ...documentData, [fieldId]: value };
    setDocumentData(newData);
    debouncedSave(newData);
  }, [documentData, debouncedSave]);

  const updateTableCell = useCallback((fieldId: string, rowIndex: number, colIndex: number, value: string) => {
    const field = coordinateFields.find(f => f.id === fieldId);
    if (!field?.tableData) return;

    const updatedCells = field.tableData.cells?.map((row: string[], rIdx: number) =>
      rIdx === rowIndex 
        ? row.map((cell: string, cIdx: number) => cIdx === colIndex ? value : cell)
        : row
    ) || [];

    const updatedTableData = {
      ...field.tableData,
      cells: updatedCells
    };

    updateFieldValue(fieldId, updatedTableData);
  }, [coordinateFields, updateFieldValue]);

  return {
    coordinateFields,
    documentData,
    isSaving,
    setCoordinateFields,
    setDocumentData,
    updateFieldValue,
    updateTableCell
  };
};