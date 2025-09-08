import React, { useState } from 'react';
import { CoordinateField } from '../../types/field';

interface PdfFieldOverlayProps {
  coordinateFields: CoordinateField[];
  selectedFieldId?: string | null;
  editable?: boolean;
  showFieldUI?: boolean;
  onFieldSelect?: (field: CoordinateField | null) => void;
  onCoordinateFieldsChange: (fields: CoordinateField[]) => void;
  getImageCoordinates: (clientX: number, clientY: number) => { x: number; y: number };
}

const PdfFieldOverlay: React.FC<PdfFieldOverlayProps> = ({
  coordinateFields,
  selectedFieldId,
  editable,
  showFieldUI,
  onFieldSelect,
  onCoordinateFieldsChange,
  getImageCoordinates
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [draggedFieldId, setDraggedFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);

  const handleFieldMouseDown = (e: React.MouseEvent, field: CoordinateField) => {
    if (!editable) return;
    
    e.stopPropagation();
    
    const { x, y } = getImageCoordinates(e.clientX, e.clientY);
    
    setIsDragging(true);
    setDraggedFieldId(field.id);
    setDragOffset({
      x: x - field.x,
      y: y - field.y
    });
    
    onFieldSelect?.(field);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !draggedFieldId || !dragOffset) return;
    
    const { x, y } = getImageCoordinates(e.clientX, e.clientY);
    
    const updatedFields = coordinateFields.map(field =>
      field.id === draggedFieldId
        ? {
            ...field,
            x: Math.max(0, x - dragOffset.x),
            y: Math.max(0, y - dragOffset.y)
          }
        : field
    );
    
    onCoordinateFieldsChange(updatedFields);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedFieldId(null);
    setDragOffset(null);
  };

  const renderField = (field: CoordinateField) => {
    const isSelected = selectedFieldId === field.id;
    
    if (field.type === 'table' && field.tableData) {
      return (
        <div
          key={field.id}
          className={`absolute border bg-white bg-opacity-90 cursor-move ${
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
          onMouseDown={(e) => handleFieldMouseDown(e, field)}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div className="w-full h-full overflow-hidden">
            <table className="w-full h-full border-collapse text-xs">
              <tbody>
                {Array(field.tableData.rows).fill(null).map((_, rowIndex) => (
                  <tr key={rowIndex}>
                    {Array(field.tableData.cols).fill(null).map((_, colIndex) => (
                      <td
                        key={`${rowIndex}-${colIndex}`}
                        className="border border-gray-400 px-1 py-0.5"
                        style={{ width: `${100 / field.tableData.cols}%` }}
                      >
                        <div className="truncate text-xs">
                          {field.tableData.cells?.[rowIndex]?.[colIndex] || ''}
                        </div>
                      </td>
                    ))}
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
        className={`absolute border-2 border-dashed bg-white bg-opacity-75 flex items-center justify-center cursor-move ${
          isSelected
            ? 'border-blue-500 bg-blue-50'
            : field.required
            ? 'border-red-400'
            : 'border-gray-400'
        }`}
        style={{
          left: field.x,
          top: field.y,
          width: field.width,
          height: field.height,
          fontSize: field.fontSize || 12,
          fontFamily: field.fontFamily || 'Arial'
        }}
        onMouseDown={(e) => handleFieldMouseDown(e, field)}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
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
    <div className="absolute inset-0 pointer-events-none">
      <div className="pointer-events-auto">
        {coordinateFields.map(renderField)}
      </div>
    </div>
  );
};

export default PdfFieldOverlay;