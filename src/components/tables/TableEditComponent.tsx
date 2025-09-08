import React from 'react';
import TableCell from './TableCell';

interface TableEditComponentProps {
  tableInfo: { rows: number; cols: number; columnWidths?: number[] };
  tableData: any;
  onCellChange: (rowIndex: number, colIndex: number, newValue: string) => void;
}

const TableEditComponent: React.FC<TableEditComponentProps> = ({
  tableInfo,
  tableData,
  onCellChange
}) => {
  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 mb-2">
        {tableInfo.rows}행 × {tableInfo.cols}열 표
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border border-gray-300">
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
                    console.error('테이블 셀 값 파싱 실패:', e);
                  }
                  
                  return (
                    <TableCell
                      key={`${rowIndex}-${colIndex}`}
                      initialValue={cellValue}
                      rowIndex={rowIndex}
                      colIndex={colIndex}
                      onCellChange={onCellChange}
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