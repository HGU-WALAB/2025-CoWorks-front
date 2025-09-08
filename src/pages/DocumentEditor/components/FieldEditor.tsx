import React from 'react';
import { CoordinateField } from '../../../types/field';
import TableEditComponent from '../../../components/tables/TableEditComponent';

interface FieldEditorProps {
  fields: CoordinateField[];
  fieldValues: Record<string, any>;
  onFieldChange: (fieldId: string, value: any) => void;
  onTableCellChange: (fieldId: string, rowIndex: number, colIndex: number, newValue: string) => void;
}

const FieldEditor: React.FC<FieldEditorProps> = ({
  fields,
  fieldValues,
  onFieldChange,
  onTableCellChange
}) => {
  const renderField = (field: CoordinateField) => {
    if (field.type === 'table' && field.tableData) {
      return (
        <div key={field.id} className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <TableEditComponent
            tableInfo={field.tableData}
            tableData={fieldValues[field.id] || field.tableData}
            onCellChange={(rowIndex, colIndex, newValue) => 
              onTableCellChange(field.id, rowIndex, colIndex, newValue)
            }
          />
        </div>
      );
    }

    return (
      <div key={field.id} className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </label>
        <input
          type="text"
          value={fieldValues[field.id] || ''}
          onChange={(e) => onFieldChange(field.id, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder={`${field.label}을(를) 입력하세요`}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {fields.map(renderField)}
    </div>
  );
};

export default FieldEditor;