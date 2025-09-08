import React, { useState, useEffect } from 'react';
import { ModalProps } from '../../types/common';

interface TableCellEditModalProps extends ModalProps {
  onSave: (text: string) => void;
  currentText: string;
  cellPosition: { row: number; col: number };
  tableName: string;
}

const TableCellEditModal: React.FC<TableCellEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentText,
  cellPosition,
  tableName
}) => {
  const [text, setText] = useState(currentText);

  useEffect(() => {
    if (isOpen) {
      setText(currentText);
    }
  }, [isOpen, currentText]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">테이블 셀 편집</h3>
        
        <div className="space-y-4">
          <div className="text-sm text-gray-600">
            <div><strong>테이블:</strong> {tableName}</div>
            <div><strong>위치:</strong> {cellPosition.row + 1}행 {cellPosition.col + 1}열</div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              셀 내용
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-purple-500 resize-none"
              placeholder="셀에 표시할 텍스트를 입력하세요"
              rows={3}
              autoFocus
            />
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableCellEditModal;