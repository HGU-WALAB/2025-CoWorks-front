import React, { useState, useEffect, useCallback } from 'react';

interface TableBulkInputProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: string[][]) => void;
  tableInfo: {
    rows: number;
    cols: number;
  };
  fieldLabel: string;
  existingData?: string[][]; // 기존 테이블 데이터
}

const TableBulkInput: React.FC<TableBulkInputProps> = ({
  isOpen,
  onClose,
  onApply,
  tableInfo,
  fieldLabel,
  existingData
}) => {
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string[][]>([]);

  // 기존 데이터를 텍스트로 변환하는 함수
  const convertDataToText = useCallback((data: string[][]): string => {
    return data.map(row => row.join(',')).join('\n');
  }, []);

  const parseAndPreview = useCallback((text: string) => {
    if (!text.trim()) {
      setPreview([]);
      setError('');
      return;
    }

    try {
      // '\n'으로 행 분리
      const rows = text.split('\n').filter(row => row.trim() !== '');

      // 각 행을 '|'로 열 분리
      const parsedData: string[][] = rows.map(row =>
        row.split('|').map(cell => cell.trim())
      );

      // 오류 검증
      const errors: string[] = [];

      // 행 수 검증
      if (parsedData.length > tableInfo.rows) {
        errors.push(`행 수가 초과되었습니다. (입력: ${parsedData.length}행, 최대: ${tableInfo.rows}행)`);
      }

      // 열 수 검증
      parsedData.forEach((row, rowIndex) => {
        if (row.length > tableInfo.cols) {
          errors.push(`${rowIndex + 1}행의 열 수가 초과되었습니다. (입력: ${row.length}열, 최대: ${tableInfo.cols}열)`);
        }
      });

      if (errors.length > 0) {
        setError(errors.join('\n'));
      } else {
        setError('');
      }

      // 표 크기에 맞게 데이터 조정 (미리보기용)
      const adjustedData: string[][] = Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
        Array(tableInfo.cols).fill(null).map((_, colIndex) => {
          if (parsedData[rowIndex] && parsedData[rowIndex][colIndex] !== undefined) {
            return parsedData[rowIndex][colIndex];
          }
          return '';
        })
      );

      setPreview(adjustedData);
    } catch (err) {
      setError('텍스트 파싱 중 오류가 발생했습니다.');
      setPreview([]);
    }
  }, [tableInfo]);

  // 모달이 열릴 때 기존 데이터 로드
  useEffect(() => {
    if (isOpen && existingData && existingData.length > 0) {
      // 기존 데이터에서 빈 값들을 제거하고 실제 데이터만 추출
      const filteredData = existingData.map(row =>
        row.map(cell => cell || '') // null이나 undefined를 빈 문자열로 변환
      ).filter(row =>
        row.some(cell => cell.trim() !== '') // 빈 행은 제외
      );

      if (filteredData.length > 0) {
        const initialText = convertDataToText(filteredData);
        setInputText(initialText);
        parseAndPreview(initialText);
      }
    } else if (isOpen) {
      setInputText('');
      setError('');
      setPreview([]);
    }
  }, [isOpen, existingData, convertDataToText, parseAndPreview]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    parseAndPreview(text);
  };

  const handleApply = () => {
    if (error) {
      alert('오류를 수정한 후 적용해주세요.');
      return;
    }

    if (preview.length === 0) {
      alert('입력할 데이터가 없습니다.');
      return;
    }

    onApply(preview);
    setInputText('');
    setPreview([]);
    setError('');
    onClose();
  };

  const handleClose = () => {
    setInputText('');
    setPreview([]);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-800">표 한번에 적기</h2>
          <p className="text-sm text-gray-600 mt-1">
            {fieldLabel} ({tableInfo.rows}행 × {tableInfo.cols}열)
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* 입력 영역 */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                텍스트 입력
              </label>
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-blue-800 mb-2">입력 형식</h4>
                <ul className="text-xs text-blue-700 space-y-1">
                  <li>• 각 열은 막대기(|)로 구분</li>
                  <li>• 각 행은 줄바꿈(Enter)으로 구분</li>
                </ul>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder={`예시:\n사과,바나나,오렌지\n빨강,노랑,주황\n달콤,부드러움,상큼`}
                className="flex-1 w-full p-3 border
                border-gray-300 rounded-lg focus:ring-2
                focus:ring-blue-500 focus:border-transparent resize-none font-mono text-sm min-h-[200px]"
                wrap="off"
              />

              {/* 오류 메시지 */}
              {error && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-medium text-red-800 mb-1">❌ 오류</h4>
                  <pre className="text-xs text-red-700 whitespace-pre-wrap">{error}</pre>
                </div>
              )}
            </div>

            {/* 미리보기 영역 */}
            <div className="flex flex-col">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                미리보기
              </label>
              <div className="border border-gray-300 rounded-lg overflow-hidden flex-1 min-h-[200px]">
                {preview.length > 0 ? (
                  <div className="overflow-auto max-h-80">
                    <table className="w-full border-collapse">
                      <tbody>
                        {preview.map((row, rowIndex) => (
                          <tr key={rowIndex}>
                            {row.map((cell, colIndex) => (
                              <td
                                key={colIndex}
                                className={`border border-gray-300 p-2 text-sm text-center ${
                                  cell ? 'bg-green-50' : 'bg-gray-50'
                                }`}
                                style={{ minWidth: '80px' }}
                              >
                                {cell || (
                                  <span className="text-gray-400 text-xs">빈 칸</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-80 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📋</div>
                      <div>데이터를 입력하면 미리보기가 표시됩니다</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleApply}
            disabled={!!error || preview.length === 0}
            className={`px-4 py-2 rounded-lg transition-colors ${
              error || preview.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );
};

export default TableBulkInput;