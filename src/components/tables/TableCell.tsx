import React, { useState, useEffect } from 'react';

interface TableCellProps {
  initialValue: string;
  rowIndex: number;
  colIndex: number;
  onCellChange: (rowIndex: number, colIndex: number, newValue: string) => void;
}

const TableCell: React.FC<TableCellProps> = ({
  initialValue,
  rowIndex,
  colIndex,
  onCellChange
}) => {
  const [value, setValue] = useState(initialValue);
  
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onCellChange(rowIndex, colIndex, newValue);
  };
  
  return (
    <td className="border border-gray-300 p-1" style={{ minWidth: '120px', minHeight: '36px' }}>
      <input
        type="text"
        value={value}
        onChange={handleChange}
        className="w-full h-full px-2 py-1 text-sm border-0 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
        placeholder={`${rowIndex + 1}-${colIndex + 1}`}
        style={{ minHeight: '28px' }}
      />
    </td>
  );
};

export default TableCell;