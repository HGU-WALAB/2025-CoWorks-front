import React from 'react';
import { TemplateField } from '../../../types/field';
import { Position } from '../../../types/common';

interface TemplatePreviewProps {
  pdfImageUrl: string | null;
  fields: TemplateField[];
  selectedFieldId: string | null;
  onFieldClick: (field: TemplateField) => void;
  onFieldMove: (fieldId: string, updates: Partial<TemplateField>) => void;
  onFieldResize: (fieldId: string, updates: Partial<TemplateField>) => void;
  onTableCellClick: (fieldId: string, row: number, col: number) => void;
  onCanvasClick: (position: Position) => void;
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  pdfImageUrl,
  fields,
  selectedFieldId,
  onFieldClick,
  onFieldMove,
  onFieldResize,
  onTableCellClick,
  onCanvasClick
}) => {
  const handleCanvasClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onCanvasClick({ x, y });
  };

  const renderField = (field: TemplateField) => {
    const isSelected = selectedFieldId === field.id;
    
    if (field.type === 'table' && field.tableData) {
      return (
        <div
          key={field.id}
          className={`absolute border bg-white bg-opacity-90 ${
            isSelected ? 'border-blue-500 shadow-lg' : 'border-purple-400'
          }`}
          style={{
            left: field.x,
            top: field.y,
            width: field.width,
            height: field.height,
            fontSize: field.fontSize || 12,
            fontFamily: field.fontFamily || 'Arial'
          }}
        >
          <div className="w-full h-full overflow-hidden">
            <table className="w-full h-full border-collapse text-xs">
              <tbody>
                {Array(field.tableData.rows).fill(null).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array(field.tableData.cols).fill(null).map((_, colIndex) => {
                      const cellContent = field.tableData.cells?.[rowIndex]?.[colIndex] || '';
                      return (
                        <td
                          key={`${rowIndex}-${colIndex}`}
                          className="border border-gray-400 px-1 py-0.5 cursor-pointer hover:bg-purple-50"
                          style={{ width: `${100 / field.tableData.cols}%` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onTableCellClick(field.id, rowIndex, colIndex);
                          }}
                        >
                          <div className="truncate" title={cellContent}>
                            {cellContent || `${rowIndex + 1}-${colIndex + 1}`}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {isSelected && (
            <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              📊 {field.label}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={field.id}
        className={`absolute border-2 border-dashed bg-white bg-opacity-75 flex items-center justify-center cursor-pointer ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : field.required
            ? 'border-red-400 hover:border-red-500'
            : 'border-gray-400 hover:border-gray-500'
        }`}
        style={{
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height,
          fontSize: field.fontSize || 12,
          fontFamily: field.fontFamily || 'Arial'
        }}
        onClick={(e) => {
          e.stopPropagation();
          onFieldClick(field);
        }}
      >
        <div className="text-center p-1">
          <div className="text-sm font-medium text-gray-700 truncate">
            {field.label}
          </div>
          {field.required && (
            <div className="text-xs text-red-500">필수</div>
          )}
        </div>
        
        {isSelected && (
          <div className="absolute -top-6 left-0 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            📝 {field.label}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="bg-gray-100 px-4 py-3 border-b">
        <h3 className="font-medium text-gray-800">템플릿 미리보기</h3>
        <p className="text-sm text-gray-500">PDF 위에서 클릭하여 새 필드를 추가하세요</p>
      </div>
      
      <div className="relative bg-gray-200 overflow-auto" style={{ minHeight: '600px' }}>
        {pdfImageUrl ? (
          <div className="relative inline-block">
            <img
              src={pdfImageUrl}
              alt="PDF Preview"
              className="max-w-none"
              style={{ minWidth: '100%' }}
            />
            <div
              className="absolute inset-0 cursor-crosshair"
              onClick={handleCanvasClick}
            >
              {fields.map(renderField)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-lg font-medium">PDF를 업로드하면 여기에 미리보기가 표시됩니다</p>
              <p className="text-sm mt-2">파일을 선택하여 시작하세요</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TemplatePreview;