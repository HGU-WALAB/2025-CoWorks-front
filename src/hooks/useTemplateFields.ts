import { useState, useCallback } from 'react';
import { TemplateField } from '../types/field';

export const useTemplateFields = (initialFields: TemplateField[] = []) => {
  const [fields, setFields] = useState<TemplateField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  const addField = useCallback((field: TemplateField) => {
    setFields(prev => [...prev, field]);
  }, []);

  const updateField = useCallback((fieldId: string, updates: Partial<TemplateField>) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    ));
  }, []);

  const deleteField = useCallback((fieldId: string) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  }, [selectedFieldId]);

  const selectField = useCallback((fieldId: string | null) => {
    setSelectedFieldId(fieldId);
  }, []);

  const getSelectedField = useCallback(() => {
    return selectedFieldId ? fields.find(field => field.id === selectedFieldId) || null : null;
  }, [fields, selectedFieldId]);

  const clearFields = useCallback(() => {
    setFields([]);
    setSelectedFieldId(null);
  }, []);

  return {
    fields,
    selectedFieldId,
    selectedField: getSelectedField(),
    addField,
    updateField,
    deleteField,
    selectField,
    clearFields,
    setFields
  };
};