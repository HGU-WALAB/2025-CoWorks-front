import React, { useState, useEffect } from 'react';
import { TemplateField } from '../../types/field';
import { ModalProps } from '../../types/common';

interface FieldEditModalProps extends ModalProps {
  field: TemplateField | null;
  onSave: (field: TemplateField) => void;
  onDelete: () => void;
  availableFonts: string[];
}

const FieldEditModal: React.FC<FieldEditModalProps> = ({
  field,
  isOpen,
  onClose,
  onSave,
  onDelete,
}) => {
  const [editField, setEditField] = useState<TemplateField | null>(field);

  useEffect(() => {
    setEditField(field);
  }, [field]);

  if (!isOpen || !editField) return null;

  const handleSave = () => {
    if (editField.label.trim() && editField.id.trim()) {
      onSave(editField);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
        <h3 className="text-lg font-semibold mb-4">필드 편집</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              필드명 *
            </label>
            <input
              type="text"
              value={editField.label}
              onChange={(e) => {
                const label = e.target.value;
                setEditField({ ...editField, label });
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="예: 성명, 날짜, 서명 등"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="editRequired"
              checked={editField.required}
              onChange={(e) => setEditField({ ...editField, required: e.target.checked })}
              disabled={editField.type === 'table'}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="editRequired" className={`ml-2 text-sm ${editField.type === 'table' ? 'text-gray-400' : 'text-gray-700'}`}>
              필수 필드
            </label>
          </div>

          {editField.type === 'table' && editField.tableData && (
            <div className="p-3 bg-purple-50 rounded-md">
              <div className="text-sm font-medium text-purple-900 mb-2">테이블 정보</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-gray-600">행 개수:</span>
                  <span className="ml-2 font-medium">{editField.tableData.rows}</span>
                </div>
                <div>
                  <span className="text-gray-600">열 개수:</span>
                  <span className="ml-2 font-medium">{editField.tableData.cols}</span>
                </div>
              </div>
              <div className="text-xs text-purple-600 mt-2">
                테이블 구조는 편집할 수 없습니다. 새로 생성해주세요.
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">페이지:</span>
              <span className="ml-2 font-medium">{editField.page}</span>
            </div>
            <div>
              <span className="text-gray-600">위치:</span>
              <span className="ml-2 font-medium">({editField.x}, {editField.y})</span>
            </div>
            <div>
              <span className="text-gray-600">타입:</span>
              <span className="ml-2 font-medium">{editField.type === 'table' ? '테이블' : '입력 필드'}</span>
            </div>
            <div>
              <span className="text-gray-600">크기:</span>
              <span className="ml-2 font-medium">{editField.width} × {editField.height}</span>
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <button
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            삭제
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!editField.label.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default FieldEditModal;