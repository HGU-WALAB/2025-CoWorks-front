import React, { useState, useEffect } from 'react';

// 테이블 편집 컴포넌트
export interface TableEditComponentProps {
  tableInfo: { rows: number; cols: number; columnWidths?: number[]; columnHeaders?: string[] };
  tableData: any;
  fieldId: string;
  onCellChange: (rowIndex: number, colIndex: number, newValue: string) => void;
  onBulkInput?: () => void;
  onCellKeyDown?: (fieldId: string, rowIndex: number, colIndex: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
}

// 개별 테이블 셀 컴포넌트 - 독립적인 상태 관리
interface TableCellProps {
  initialValue: string;
  rowIndex: number;
  colIndex: number;
  tableRows: number;
  tableCols: number;
  fieldId: string;
  onCellChange: (rowIndex: number, colIndex: number, newValue: string) => void;
  onCellKeyDown?: (rowIndex: number, colIndex: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
}

const TableCell: React.FC<TableCellProps> = ({
  initialValue,
  rowIndex,
  colIndex,
  tableRows,
  tableCols,
  fieldId,
  onCellChange,
  onCellKeyDown
}) => {
  const [value, setValue] = useState(initialValue);

  // initialValue가 변경될 때만 상태 업데이트
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue); // 즉시 로컬 상태 업데이트
    onCellChange(rowIndex, colIndex, newValue); // 부모로 변경사항 전달
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      // 다음 셀 계산
      let nextRow = rowIndex;
      let nextCol = colIndex + 1;

      // 다음 열이 테이블 범위를 벗어나면 다음 행의 첫 번째 열로
      if (nextCol >= tableCols) {
        nextCol = 0;
        nextRow = rowIndex + 1;
      }

      // 다음 행이 테이블 범위를 벗어나면 다음 필드로 이동
      if (nextRow >= tableRows) {
        // 부모 컴포넌트에 다음 필드로 이동 요청
        onCellKeyDown?.(rowIndex, colIndex, e);
        return;
      }

      // 같은 테이블 내 다음 셀로 포커스 이동
      setTimeout(() => {
        const nextCellInput = document.querySelector(`input[data-cell-id="${fieldId}-${nextRow}-${nextCol}"]`) as HTMLInputElement;
        if (nextCellInput) {
          nextCellInput.focus();
          nextCellInput.select();
        }
      }, 0);
    }
  };

  return (
    <td className="border border-gray-300 p-1" style={{ minWidth: '120px', minHeight: '36px' }}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        data-cell-id={`${fieldId}-${rowIndex}-${colIndex}`}
        className="w-full h-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
        placeholder={`${rowIndex + 1}-${colIndex + 1}`}
        style={{ minHeight: '28px' }}
      />
    </td>
  );
};

const TableEditComponent: React.FC<TableEditComponentProps> = ({
  tableInfo,
  tableData,
  fieldId,
  onCellChange,
  onBulkInput,
  onCellKeyDown
}) => {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center mb-2">
        <div className="text-xs text-gray-500">
          {tableInfo.rows}행 × {tableInfo.cols}열 표
        </div>
        {onBulkInput && (
          <button
            onClick={onBulkInput}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            title="쉼표(,)로 열 구분, 줄바꿈으로 행 구분하여 한번에 입력"
          >
            한번에 적기
          </button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300">
          {/* 열 헤더가 있는 경우 thead 표시 */}
          {tableInfo.columnHeaders && tableInfo.columnHeaders.some(h => h) && (
            <thead>
              <tr className="bg-purple-100">
                {Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                  const headerText = tableInfo.columnHeaders?.[colIndex] || '';
                  return (
                    <th
                      key={`header-${colIndex}`}
                      className="border border-purple-300 px-2 py-1 text-sm font-semibold text-purple-800"
                      style={{ minWidth: '120px' }}
                    >
                      {headerText || (colIndex + 1)}
                    </th>
                  );
                })}
              </tr>
            </thead>
          )}
          <tbody>
            {Array(tableInfo.rows).fill(null).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                  let cellValue = '';
                  try {
                    if (tableData && tableData.cells) {
                      cellValue = tableData.cells[rowIndex]?.[colIndex] || '';
                    }
                  } catch (e) {
                    // 테이블 셀 값 파싱 실패
                  }

                  return (
                    <TableCell
                      key={`${rowIndex}-${colIndex}`}
                      initialValue={cellValue}
                      rowIndex={rowIndex}
                      colIndex={colIndex}
                      tableRows={tableInfo.rows}
                      tableCols={tableInfo.cols}
                      fieldId={fieldId}
                      onCellChange={onCellChange}
                      onCellKeyDown={(row, col, event) => {
                        onCellKeyDown?.(fieldId, row, col, event);
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableEditComponent;
