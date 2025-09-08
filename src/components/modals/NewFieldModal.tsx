import React, { useState, useEffect } from 'react';
import { TemplateField } from '../../types/field';
import { ModalProps, Position, SelectionBox } from '../../types/common';

interface NewFieldModalProps extends ModalProps {
  onSave: (field: TemplateField) => void;
  initialPosition: Position;
  selectionBox?: SelectionBox | null;
  defaultFontSize: number;
  defaultFontFamily: string;
}

const NewFieldModal: React.FC<NewFieldModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPosition,
  selectionBox,
  defaultFontSize,
  defaultFontFamily
}) => {
  const [label, setLabel] = useState('');
  const [required, setRequired] = useState(false);
  const [isTable, setIsTable] = useState(false);
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);

  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setRequired(false);
      setIsTable(false);
      setTableRows(2);
      setTableCols(2);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (label.trim()) {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const autoId = `${isTable ? 'table' : 'field'}_${timestamp}_${randomStr}`;

      const fieldWidth = selectionBox?.width || 150;
      const fieldHeight = selectionBox?.height || 30;
      const fieldX = selectionBox?.x || initialPosition.x;
      const fieldY = selectionBox?.y || initialPosition.y;

      const newField: TemplateField = {
        id: autoId,
        label: label.trim(),
        x: fieldX,
        y: fieldY,
        width: fieldWidth,
        height: fieldHeight,
        page: 1,
        required,
        type: isTable ? 'table' : 'field',
        fontSize: defaultFontSize,
        fontFamily: defaultFontFamily,
        ...(isTable && {
          tableData: {
            rows: tableRows,
            cols: tableCols,
            cells: Array(tableRows).fill(null).map(() => Array(tableCols).fill('')),
            columnWidths: Array(tableCols).fill(1 / tableCols)
          }
        })
      };

      onSave(newField);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">새 필드 추가</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              필드명 *
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="예: 성명, 날짜, 서명 등"
              autoFocus
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="newRequired"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="newRequired" className="ml-2 text-sm text-gray-700">
              필수 필드
            </label>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="isTable"
              checked={isTable}
              onChange={(e) => setIsTable(e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="isTable" className="ml-2 text-sm text-gray-700">
              테이블 생성
            </label>
          </div>

          {isTable && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-md">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    행 개수
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={tableRows}
                    onChange={(e) => setTableRows(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    열 개수
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={tableCols}
                    onChange={(e) => setTableCols(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!label.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
          >
            추가
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewFieldModal;