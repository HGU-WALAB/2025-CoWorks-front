import React, { useState, useEffect, useRef } from 'react';
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setText(currentText);
      // 모달이 열릴 때 textarea에 포커스
      setTimeout(() => {
        textareaRef.current?.focus();
        textareaRef.current?.select();
      }, 100);
    }
  }, [isOpen, currentText]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(text);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter 키로 저장 (Shift+Enter는 줄바꿈)
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div 
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            테이블 셀 편집
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="px-6 py-4">
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-2">
              <span className="font-medium text-purple-600">{tableName}</span>의{' '}
              <span className="font-medium text-purple-600">{cellPosition.row + 1}행 {cellPosition.col + 1}열</span> 셀 내용을 입력하세요.
            </p>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-gray-900 resize-none"
              placeholder="셀에 표시할 텍스트를 입력하세요"
              rows={3}
            />
          </div>
          <p className="text-xs text-gray-500">
            * Enter 키를 눌러 저장하거나, ESC 키를 눌러 취소할 수 있습니다. 
            <br />
            (줄바꿈: Shift+Enter)
          </p>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableCellEditModal;