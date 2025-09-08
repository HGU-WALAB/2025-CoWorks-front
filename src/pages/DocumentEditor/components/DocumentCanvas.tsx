import React from 'react';
import { Document } from '../../../stores/documentStore';
import { CoordinateField } from '../../../types/field';

interface DocumentCanvasProps {
  document: Document;
  fields: CoordinateField[];
  fieldValues: Record<string, any>;
}

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  document,
  fields,
  fieldValues
}) => {
  const renderFieldOverlay = (field: CoordinateField) => {
    const value = fieldValues[field.id];
    
    if (field.type === 'table' && field.tableData) {
      return (
        <div
          key={field.id}
          className="absolute border border-purple-400 bg-purple-50 bg-opacity-90"
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
                      const cellValue = value?.cells?.[rowIndex]?.[colIndex] || 
                                      field.tableData.cells?.[rowIndex]?.[colIndex] || '';
                      return (
                        <td
                          key={`${rowIndex}-${colIndex}`}
                          className="border border-gray-400 px-1 py-0.5"
                          style={{ width: `${100 / field.tableData.cols}%` }}
                        >
                          <div className="truncate" title={cellValue}>
                            {cellValue}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }

    return (
      <div
        key={field.id}
        className="absolute border border-blue-400 bg-blue-50 bg-opacity-90 flex items-center px-2"
        style={{
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height,
          fontSize: field.fontSize || 12,
          fontFamily: field.fontFamily || 'Arial'
        }}
      >
        <div className="w-full truncate text-gray-800">
          {value || `[${field.label}]`}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="bg-gray-100 px-4 py-3 border-b">
        <h3 className="font-medium text-gray-800">문서 미리보기</h3>
        <p className="text-sm text-gray-500">입력한 내용이 실시간으로 반영됩니다</p>
      </div>
      
      <div className="relative bg-gray-200 overflow-auto" style={{ minHeight: '600px' }}>
        {document.template?.pdfImagePath ? (
          <div className="relative inline-block">
            <img
              src={document.template.pdfImagePath}
              alt="Document Template"
              className="max-w-none"
              style={{ minWidth: '100%' }}
            />
            <div className="absolute inset-0">
              {fields.map(renderFieldOverlay)}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-96">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-4">📄</div>
              <p className="text-lg font-medium">템플릿 이미지를 불러올 수 없습니다</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;