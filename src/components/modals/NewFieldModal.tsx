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
  const [fieldTypeOption, setFieldTypeOption] = useState<'normal' | 'table' | 'editor_signature' | 'reviewer_signature'>('normal');
  const [tableRows, setTableRows] = useState(2);
  const [tableCols, setTableCols] = useState(2);
  const [columnHeaders, setColumnHeaders] = useState<string[]>(['', '']);

  useEffect(() => {
    if (isOpen) {
      setLabel('');
      setRequired(false);
      setFieldTypeOption('normal');
      setTableRows(2);
      setTableCols(2);
      setColumnHeaders(['', '']);
    }
  }, [isOpen]);

  // 열 개수가 변경될 때 columnHeaders 배열 크기 조정
  useEffect(() => {
    if (fieldTypeOption === 'table') {
      const currentLength = columnHeaders.length;
      if (tableCols > currentLength) {
        // 열 개수가 늘어나면 빈 문자열로 채움
        setColumnHeaders([...columnHeaders, ...Array(tableCols - currentLength).fill('')]);
      } else if (tableCols < currentLength) {
        // 열 개수가 줄어들면 뒤에서부터 제거
        setColumnHeaders(columnHeaders.slice(0, tableCols));
      }
    }
  }, [tableCols, fieldTypeOption]);

  // 서명자 서명 필드의 인덱스 계산 (기존 서명자 필드 개수 + 1)
  const getReviewerIndex = (): number => {
    // 이 함수는 실제 구현 시 부모 컴포넌트에서 전달받은 fields를 확인해야 하지만,
    // 현재는 모달에서 직접 접근할 수 없으므로 저장 시점에 부모에서 처리하도록 함
    return 1;
  };

  if (!isOpen) return null;

  const handleSave = () => {
    if (label.trim()) {
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fieldType = fieldTypeOption === 'editor_signature' ? 'editor_signature' : 
                        fieldTypeOption === 'reviewer_signature' ? 'reviewer_signature' :
                        fieldTypeOption === 'table' ? 'table' : 'field';
      const autoId = `${fieldType}_${timestamp}_${randomStr}`;

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
        type: fieldType,
        fontSize: defaultFontSize,
        fontFamily: defaultFontFamily,
        ...(fieldTypeOption === 'table' && {
          tableData: {
            rows: tableRows,
            cols: tableCols,
            cells: Array(tableRows).fill(null).map(() => Array(tableCols).fill('')),
            columnWidths: Array(tableCols).fill(1 / tableCols),
            columnHeaders: columnHeaders.slice(0, tableCols) // 열 개수만큼만 저장
          }
        }),
        // 서명자 서명 필드인 경우 reviewerIndex 추가 (부모에서 재계산됨)
        ...(fieldTypeOption === 'reviewer_signature' && {
          reviewerIndex: getReviewerIndex()
        })
      };

      onSave(newField);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[600px] max-w-full mx-4 max-h-[90vh] overflow-y-auto">
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
              disabled={fieldTypeOption === 'table'}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <label htmlFor="newRequired" className={`ml-2 text-sm ${fieldTypeOption === 'table' ? 'text-gray-400' : 'text-gray-700'}`}>
              필수 필드
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              필드 유형 선택
            </label>
            
            <div className="flex items-center">
              <input
                type="radio"
                id="normalField"
                name="fieldType"
                checked={fieldTypeOption === 'normal'}
                onChange={() => setFieldTypeOption('normal')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="normalField" className="ml-2 text-sm text-gray-700">
                텍스트
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="radio"
                id="tableField"
                name="fieldType"
                checked={fieldTypeOption === 'table'}
                onChange={() => setFieldTypeOption('table')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="tableField" className="ml-2 text-sm text-gray-700">
                테이블
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="radio"
                id="editorSignatureField"
                name="fieldType"
                checked={fieldTypeOption === 'editor_signature'}
                onChange={() => setFieldTypeOption('editor_signature')}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <label htmlFor="editorSignatureField" className="ml-2 text-sm text-gray-700">
                작성자 서명
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="radio"
                id="reviewerSignatureField"
                name="fieldType"
                checked={fieldTypeOption === 'reviewer_signature'}
                onChange={() => setFieldTypeOption('reviewer_signature')}
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300"
              />
              <label htmlFor="reviewerSignatureField" className="ml-2 text-sm text-gray-700">
                서명자 서명
              </label>
            </div>
          </div>

          {fieldTypeOption === 'table' && (
            <div className="space-y-3 p-3 bg-blue-50 rounded-md">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    행 개수(가로 ㅡ)
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
                    열 개수(세로 |)
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
              
              {/* Column Header 입력 필드들 */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  열 헤더 이름
                </label>
                <div className="overflow-x-auto">
                  <div className="flex gap-2 min-w-max pb-2">
                    {columnHeaders.slice(0, tableCols).map((header, index) => (
                      <div key={index} className="flex-shrink-0 w-32">
                        <label className="block text-xs text-gray-600 mb-1">
                          {index + 1}번째 열
                        </label>
                        <input
                          type="text"
                          value={header}
                          onChange={(e) => {
                            const newHeaders = [...columnHeaders];
                            newHeaders[index] = e.target.value;
                            setColumnHeaders(newHeaders);
                          }}
                          placeholder={`열 ${index + 1}`}
                          className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  헤더 이름을 입력하지 않으면 기본적으로 숫자(1, 2, 3...)로 표시됩니다.
                </p>
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