import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../../stores/documentStore';
import { useAuthStore } from '../../stores/authStore';
import axios from 'axios';
import DocumentPreviewModal from '../../components/DocumentPreviewModal';

// 테이블 편집 컴포넌트
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

// 개별 테이블 셀 컴포넌트 - 독립적인 상태 관리
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
  
  // initialValue가 변경될 때만 상태 업데이트
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue); // 즉시 로컬 상태 업데이트
    onCellChange(rowIndex, colIndex, newValue); // 부모로 변경사항 전달
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

// 간단한 debounce 유틸 함수
const createDebounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// CoordinateField 타입 정의
interface CoordinateField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  value?: string;
  required?: boolean;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[];
  };
}

// 템플릿 필드 타입 정의
interface TemplateField {
  id: number;
  fieldKey: string;
  label: string;
  fieldType: string;
  width: number;
  height: number;
  required: boolean;
  x: number;
  y: number;
  type?: 'field' | 'table';
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  color?: string;
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[];
  };
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDocument, loading, getDocument, updateDocumentSilently, clearCurrentDocument } = useDocumentStore();
  const { user } = useAuthStore();

  // 템플릿 필드 기반 입력 시스템 상태
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  
  // CoordinateFields 상태를 별도로 관리
  const [coordinateFields, setCoordinateFields] = useState<CoordinateField[]>([]);
  
  // 저장 상태 관리
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // 편집 완료 관련 상태
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // 저장 관련 refs
  const pendingSaves = useRef<Map<number, string>>(new Map());
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // 템플릿 필드가 로드되면 coordinateFields 초기화
  useEffect(() => {
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      
      // 템플릿 필드 기반으로 coordinateFields 초기화
      const initialFields = templateFields
        .filter(field => field.x !== undefined && field.y !== undefined)
        .map(field => {
          const pixelCoords = {
            x: field.x,
            y: field.y,
            width: field.width || 100,
            height: field.height || 30
          };

          return {
            id: field.id.toString(),
            label: field.label,
            x: pixelCoords.x,
            y: pixelCoords.y,
            width: pixelCoords.width,
            height: pixelCoords.height,
            type: (field.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date',
            value: field.fieldType === 'table' && field.tableData 
              ? JSON.stringify({
                  rows: field.tableData.rows,
                  cols: field.tableData.cols,
                  cells: Array(field.tableData.rows).fill(null).map(() => 
                    Array(field.tableData!.cols).fill('')
                  )
                }) 
              : '',
            required: field.required,
            fontSize: field.fontSize || 14,
            fontFamily: field.fontFamily || 'Arial',
            fontWeight: field.fontWeight || 'normal',
            color: field.color || '#000000',
            ...(field.fieldType === 'table' && field.tableData && {
              tableData: field.tableData
            })
          };
        });
      
      setCoordinateFields(initialFields);
    }
  }, [templateFields, id]);

  // 디바운스된 문서 업데이트 함수
  const debouncedUpdateDocument = useCallback(
    createDebounce(async (documentId: number, data: any) => {
      const success = await updateDocumentSilently(documentId, data);
      if (success) {
        setLastSaved(new Date());
      }
    }, 1000),
    [updateDocumentSilently]
  );

  // 수동 저장 함수
  const handleManualSave = useCallback(async () => {
    if (!id || !currentDocument) return;
    
    setIsSaving(true);
    try {
      const updatedData = {
        coordinateFields: coordinateFields.map(field => ({
          id: field.id,
          label: field.label,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          type: field.type,
          value: field.value,
          required: field.required,
          fontSize: field.fontSize || 14,
          fontFamily: field.fontFamily || 'Arial',
          fontWeight: field.fontWeight || 'normal',
          color: field.color || '#000000',
          ...(field.tableData && { tableData: field.tableData })
        }))
      };
      
      await updateDocumentSilently(parseInt(id), { data: updatedData });
      
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('수동 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [id, currentDocument, coordinateFields, updateDocumentSilently]);

  // 필수 필드 검증 함수
  const validateRequiredFields = useCallback(() => {
    const missingFields: string[] = [];
    
    coordinateFields.forEach(field => {
      if (field.required && (!field.value || field.value.trim() === '')) {
        missingFields.push(field.label || `필드 ${field.id}`);
      }
    });
    
    return missingFields;
  }, [coordinateFields]);

  // 편집 완료 처리 함수
  const handleCompleteEditing = useCallback(async () => {
    if (!id || !currentDocument) return;

    const missingFields = validateRequiredFields();
    if (missingFields.length > 0) {
      alert(`다음 필수 필드를 채워주세요:\n• ${missingFields.join('\n• ')}`);
      return;
    }

    setShowCompleteModal(true);
  }, [id, currentDocument, validateRequiredFields]);

  // 편집 완료 확인 함수
  const confirmCompleteEditing = useCallback(async () => {
    if (!id) return;

    setIsCompleting(true);
    try {
      await handleManualSave();
      
      const response = await axios.post(`/api/documents/${id}/complete-editing`);
      
      if (response.status === 200) {
        const hasAssignReviewerPermission = currentDocument?.tasks?.some(task => 
          task.assignedUserEmail === user?.email && 
          (task.role === 'CREATOR' || (task.role === 'EDITOR' && task.canAssignReviewer))
        );

        if (hasAssignReviewerPermission) {
          alert('편집이 완료되었습니다. 검토자 지정 단계로 이동합니다.');
          navigate(`/documents/${id}/review`);
        } else {
          alert('편집이 완료되었습니다. 생성자 또는 권한이 있는 편집자가 검토자를 지정할 수 있습니다.');
          navigate('/documents');
        }
      }
    } catch (error: any) {
      console.error('편집 완료 실패:', error);
      let errorMessage = '편집 완료 중 오류가 발생했습니다.';
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }
      
      alert(errorMessage);
    } finally {
      setIsCompleting(false);
      setShowCompleteModal(false);
    }
  }, [id, handleManualSave, navigate, currentDocument, user]);

  // 안정된 핸들러 ref
  const stableHandlersRef = useRef({
    debouncedUpdateDocument
  });

  useEffect(() => {
    stableHandlersRef.current.debouncedUpdateDocument = debouncedUpdateDocument;
  }, [debouncedUpdateDocument]);

  // CoordinateField 값 변경 핸들러
  const handleCoordinateFieldChange = useCallback((fieldId: string, value: string) => {
    if (!id || !currentDocument) return;

    setCoordinateFields(prev => {
      const updated = prev.map(field => 
        field.id === fieldId 
          ? { ...field, value } 
          : field
      );
      return updated;
    });

    const updatedFields = coordinateFields.map(field => 
      field.id === fieldId 
        ? { ...field, value } 
        : field
    );
    
    const updatedData = {
      coordinateFields: updatedFields
    };
    
    stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
  }, [id, currentDocument, coordinateFields]);

  // 템플릿 필드 로드
  const loadTemplateFields = useCallback(async () => {
    if (!currentDocument?.templateId) {
      setTemplateFields([]);
      return;
    }

    try {
      const templateResponse = await axios.get(`/api/templates/${currentDocument.templateId}`);
      const template = templateResponse.data;

      let parsedFields: any[] = [];
      
      if (template.coordinateFields) {
        try {
          parsedFields = typeof template.coordinateFields === 'string' 
            ? JSON.parse(template.coordinateFields)
            : template.coordinateFields;
        } catch (error) {
          console.error('coordinateFields 파싱 실패:', error);
        }
      }
      
      const convertedFields = parsedFields.map((field, index) => {
        // 안전한 폰트 속성 파싱
        const safeFontSize = (() => {
          try {
            const size = field.fontSize || field.font_size || 14;
            const parsed = typeof size === 'string' ? parseInt(size) : size;
            return !isNaN(parsed) && parsed > 0 ? parsed : 14;
          } catch (error) {
            console.warn('fontSize 파싱 실패, 기본값 사용:', error);
            return 14;
          }
        })();

        const safeFontFamily = (() => {
          try {
            const family = field.fontFamily || field.font_family || 'Arial';
            return typeof family === 'string' && family.trim() ? family.trim() : 'Arial';
          } catch (error) {
            console.warn('fontFamily 파싱 실패, 기본값 사용:', error);
            return 'Arial';
          }
        })();

        const safeFontWeight = (() => {
          try {
            const weight = field.fontWeight || field.font_weight || 'normal';
            const validWeights = ['normal', 'bold', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
            return validWeights.includes(String(weight)) ? String(weight) : 'normal';
          } catch (error) {
            console.warn('fontWeight 파싱 실패, 기본값 사용:', error);
            return 'normal';
          }
        })();

        const safeColor = (() => {
          try {
            const color = field.color || field.fontColor || field.font_color || '#000000';
            // 기본 색상 형식 검증 (hex, rgb, rgba, 이름)
            const colorString = String(color).trim();
            if (colorString.match(/^#[0-9A-Fa-f]{3,6}$/) || 
                colorString.match(/^rgb\(/) || 
                colorString.match(/^rgba\(/) ||
                ['black', 'white', 'red', 'blue', 'green', 'gray', 'grey'].includes(colorString.toLowerCase())) {
              return colorString;
            }
            return '#000000';
          } catch (error) {
            console.warn('color 파싱 실패, 기본값 사용:', error);
            return '#000000';
          }
        })();

        return {
          id: parseInt(field.id?.replace(/\D/g, '') || index.toString()),
          fieldKey: field.id,
          label: field.label,
          fieldType: field.type === 'table' ? 'table' : 'text',
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          required: field.required || false,
          type: field.type || 'field',
          fontSize: safeFontSize,
          fontFamily: safeFontFamily,
          fontWeight: safeFontWeight,
          color: safeColor,
          tableData: field.tableData
        };
      });

      setTemplateFields(convertedFields);
      
    } catch (error) {
      console.error('템플릿 필드 로드 실패:', error);
      setTemplateFields([]);
    }
  }, [currentDocument?.templateId, currentDocument?.id]);

  // 문서 필드 값 로드
  const loadDocumentFieldValues = useCallback(async () => {
    if (!id || !Array.isArray(templateFields) || templateFields.length === 0) {
      return;
    }

    try {
      let fieldValues: any[] = [];
      
      if (currentDocument?.data?.coordinateFields) {
        fieldValues = currentDocument.data.coordinateFields;
      }
      
      const updated = templateFields.map(templateField => {
        const savedField = Array.isArray(fieldValues) ? 
          fieldValues.find((fv: any) => 
            fv.id === templateField.id.toString() || 
            fv.label === templateField.label
          ) : null;
        
        let value = '';
        if (templateField.fieldType === 'table' && templateField.tableData) {
          if (savedField && savedField.value) {
            value = savedField.value;
          } else {
            value = JSON.stringify({
              rows: templateField.tableData.rows,
              cols: templateField.tableData.cols,
              cells: Array(templateField.tableData.rows).fill(null).map(() => 
                Array(templateField.tableData!.cols).fill('')
              ),
              columnWidths: templateField.tableData.columnWidths || Array(templateField.tableData.cols).fill(1 / templateField.tableData.cols)
            });
          }
        } else {
          value = savedField ? (savedField.value || '') : '';
        }
        
        const pixelCoords = {
          x: templateField.x,
          y: templateField.y,
          width: templateField.width || 100,
          height: templateField.height || 30
        };
        
        return {
          id: templateField.id.toString(),
          label: templateField.label || `필드 ${templateField.id}`,
          x: pixelCoords.x,
          y: pixelCoords.y,
          width: pixelCoords.width,
          height: pixelCoords.height,
          type: (templateField.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date',
          value: value,
          required: templateField.required || false,
          fontSize: templateField.fontSize || 14,
          fontFamily: templateField.fontFamily || 'Arial',
          fontWeight: templateField.fontWeight || 'normal',
          color: templateField.color || '#000000',
          ...(templateField.fieldType === 'table' && templateField.tableData && {
            tableData: templateField.tableData
          })
        };
      });
      
      setCoordinateFields(updated);
    } catch (error) {
      console.error('문서 필드 값 로드 실패:', error);
    }
  }, [id, templateFields, currentDocument]);

  // 초기 데이터 로드
  useEffect(() => {
    if (id) {
      setTemplateFields([]);
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 권한 확인
  useEffect(() => {
    const checkPermissionAndStartEditing = async () => {
      if (currentDocument && user) {
        const isCreator = currentDocument.tasks?.some(task => 
          task.role === 'CREATOR' && task.assignedUserEmail === user.email
        );

        if (isCreator) {
          alert('생성자는 문서를 편집할 수 없습니다. 편집자에게 할당된 문서만 편집 가능합니다.');
          navigate('/documents');
          return;
        }

        const isEditor = currentDocument.tasks?.some(task => 
          task.role === 'EDITOR' && task.assignedUserEmail === user.email
        );

        if (!isEditor) {
          alert('이 문서를 편집할 권한이 없습니다.');
          navigate('/documents');
          return;
        }

        if (currentDocument.status === 'DRAFT' && isEditor) {
          try {
            await axios.post(`/api/documents/${currentDocument.id}/start-editing`);
            getDocument(parseInt(id!));
          } catch (error) {
            console.error('편집 시작 실패:', error);
            alert('편집을 시작할 수 없습니다.');
            navigate('/documents');
          }
        }
      }
    };

    checkPermissionAndStartEditing();
  }, [currentDocument, user, navigate, id, getDocument]);

  useEffect(() => {
    if (currentDocument) {
      loadTemplateFields();
    }
  }, [currentDocument, loadTemplateFields]);

  useEffect(() => {
    if (templateFields.length > 0) {
      loadDocumentFieldValues();
    }
  }, [templateFields, loadDocumentFieldValues]);

  // 키보드 단축키
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleManualSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleManualSave]);

  // PDF 뷰어 렌더링
  const renderPdfViewer = useMemo(() => {
    if (!currentDocument?.template?.pdfImagePath) return null;
    
    const imageFileName = currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    const pdfImageUrl = `/uploads/pdf-templates/${imageFileName}`;
    
    return (
      <div className="relative bg-gray-100 h-full overflow-auto flex justify-center items-start p-4">
        <div 
          className="relative bg-white shadow-sm border"
          style={{
            width: '1240px',
            height: '1754px',
            minWidth: '1240px',
            minHeight: '1754px',
            flexShrink: 0
          }}
        >
          <img 
            src={pdfImageUrl}
            alt="PDF Preview"
            className="absolute inset-0"
            style={{
              width: '1240px',
              height: '1754px',
              objectFit: 'fill'
            }}
            onError={() => {
              console.error('PDF 이미지 로드 실패:', pdfImageUrl);
            }}
          />
          
          <div className="absolute inset-0">
            {coordinateFields.map((field) => {
              const leftPercent = field.x;
              const topPercent = field.y;
              const widthPercent = field.width;
              const heightPercent = field.height;

              // 테이블 필드인지 확인
              let isTableField = false;
              let tableInfo = null;
              
              if (field.tableData) {
                isTableField = true;
                tableInfo = field.tableData;
              } else {
                try {
                  if (field.value && typeof field.value === 'string') {
                    const parsedValue = JSON.parse(field.value);
                    if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                      isTableField = true;
                      tableInfo = {
                        rows: parsedValue.rows,
                        cols: parsedValue.cols,
                        columnWidths: parsedValue.columnWidths
                      };
                    }
                  }
                } catch (e) {
                  // JSON 파싱 실패 시 일반 필드로 처리
                }
              }

              return (
                <div
                  key={field.id}
                  className={`absolute border-2 bg-opacity-30 hover:bg-opacity-50 transition-colors flex flex-col justify-center cursor-pointer ${
                    isTableField ? 'bg-purple-100 border-purple-500' : 'bg-blue-100 border-blue-500'
                  }`}
                  style={{
                    left: `${leftPercent}px`,
                    top: `${topPercent}px`,
                    width: `${widthPercent}px`,
                    height: `${heightPercent}px`,
                  }}
                  onClick={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    if (!isTableField) {
                      const templateField = templateFields.find(tf => tf.id.toString() === field.id);
                      if (templateField) {
                        const input = document.querySelector(`input[data-field-id="${field.id}"]`) as HTMLInputElement;
                        if (input) {
                          input.focus();
                          input.select();
                        }
                      }
                    }
                  }}
                >
                  {isTableField && tableInfo ? (
                    <div className="w-full h-full p-1">
                      <div className="text-xs font-medium mb-1 text-purple-700 truncate">
                        {field.label} ({tableInfo.rows}×{tableInfo.cols})
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                      <div 
                        className="grid gap-px bg-purple-300" 
                        style={{
                          gridTemplateColumns: tableInfo.columnWidths 
                            ? tableInfo.columnWidths.map((width: number) => `${width * 100}%`).join(' ')
                            : `repeat(${tableInfo.cols}, 1fr)`,
                          height: 'calc(100% - 20px)'
                        }}
                      >
                        {Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
                          Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                            let cellText = '';
                            
                            try {
                              if (field.value) {
                                let savedTableData: any = {};
                                
                                if (typeof field.value === 'string') {
                                  savedTableData = JSON.parse(field.value);
                                } else {
                                  savedTableData = field.value;
                                }
                                
                                if (savedTableData.cells && 
                                    Array.isArray(savedTableData.cells) && 
                                    savedTableData.cells[rowIndex] && 
                                    Array.isArray(savedTableData.cells[rowIndex])) {
                                  cellText = savedTableData.cells[rowIndex][colIndex] || '';
                                }
                              }
                              
                              if (!cellText && field.tableData && field.tableData.cells) {
                                cellText = field.tableData.cells[rowIndex]?.[colIndex] || '';
                              }
                              
                            } catch (error) {
                              cellText = '';
                            }
                            
                            return (
                              <div 
                                key={`${rowIndex}-${colIndex}`}
                                className="bg-white bg-opacity-70 border border-purple-200 hover:bg-opacity-90 cursor-pointer flex items-center justify-center p-1 transition-colors"
                                style={{ 
                                  minHeight: '20px',
                                  fontSize: `${field.fontSize || 14}px`,
                                  fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                  fontWeight: field.fontWeight || '500',
                                  color: field.color || '#6b21a8'
                                }}
                                title={cellText || '클릭하여 편집'}
                              >
                                <span 
                                  className="text-center truncate leading-tight"
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    fontSize: `${field.fontSize || 14}px`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                    fontWeight: field.fontWeight || '500',
                                    color: field.color || '#6b21a8'
                                  }}
                                >
                                  {cellText}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : field.value ? (
                    <div className="text-gray-900 p-1 truncate text-center"
                      style={{
                        fontSize: `${field.fontSize || 14}px`,
                        fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                        fontWeight: field.fontWeight || '500',
                        color: field.color || '#111827'
                      }}
                    >
                      {field.value}
                    </div>
                  ) : (
                    <div className="text-xs text-blue-700 font-medium p-1 truncate text-center">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }, [currentDocument?.template?.pdfImagePath, coordinateFields, templateFields]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">문서를 불러오는 중...</div>;
  }

  if (!currentDocument) {
    return <div className="flex items-center justify-center h-64">문서를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="min-h-screen w-full bg-gray-50">
      {/* 헤더 - 고정 위치 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-6 py-4 flex justify-between items-center w-full">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{currentDocument.data?.title || '문서 편집'}</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">문서 편집</p>
            {lastSaved && (
              <span className="text-xs text-green-600">
                • 마지막 저장: {lastSaved.toLocaleTimeString()}
              </span>
            )}
            {isSaving && (
              <span className="text-xs text-blue-600 flex items-center gap-1">
                <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                저장 중...
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreviewModal(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            미리보기
          </button>
          <button
            onClick={handleCompleteEditing}
            disabled={isCompleting}
            className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 transition-colors ${
              isCompleting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isCompleting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                완료 중
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                편집완료
              </>
            )}
          </button>
          <button
            onClick={handleManualSave}
            disabled={isSaving}
            className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
              isSaving 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSaving ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                저장 중
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                저장
              </>
            )}
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            돌아가기
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 - 헤더 아래 고정 레이아웃 */}
      <div className="fixed top-24 left-0 right-0 bottom-0 flex w-full">
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex justify-center items-start p-4">
          {renderPdfViewer || (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">PDF 파일이 없습니다.</p>
            </div>
          )}
        </div>

        {/* 오른쪽 패널 - 필드 목록 */}
        <div className="w-96 bg-white border-l overflow-y-auto flex-shrink-0 h-full">
          <div className="p-4 border-b bg-gray-50">
            <h2 className="font-medium text-gray-900">문서 필드</h2>
            <p className="text-sm text-gray-500 mt-1">
              {coordinateFields.length}개 필드
            </p>
          </div>
          
          <div className="p-4 space-y-4">
            {coordinateFields.map((field) => {
              // 테이블 필드인지 확인
              let isTableField = false;
              let tableInfo = null;
              let tableData = null;
              
              if (field.value) {
                try {
                  const parsedValue = JSON.parse(field.value);
                  if (parsedValue.rows && parsedValue.cols) {
                    isTableField = true;
                    tableInfo = {
                      rows: parsedValue.rows,
                      cols: parsedValue.cols,
                      columnWidths: parsedValue.columnWidths
                    };
                    tableData = parsedValue;
                  }
                } catch (error) {
                  // JSON 파싱 실패 시 일반 필드로 처리
                }
              }
              
              if (!isTableField && field.tableData) {
                isTableField = true;
                tableInfo = field.tableData;
                tableData = {
                  rows: field.tableData.rows,
                  cols: field.tableData.cols,
                  cells: Array(field.tableData.rows).fill(null).map(() => 
                    Array(field.tableData!.cols).fill('')
                  ),
                  columnWidths: field.tableData.columnWidths
                };
              }

              return (
                <div key={field.id} className="border rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    {isTableField && <span className="text-purple-600 text-xs ml-1">(표)</span>}
                  </label>
                  
                  {isTableField && tableInfo ? (
                    <TableEditComponent 
                      tableInfo={tableInfo}
                      tableData={tableData}
                      onCellChange={(rowIndex, colIndex, newValue) => {
                        setCoordinateFields(prev => {
                          return prev.map(f => {
                            if (f.id === field.id) {
                              try {
                                const currentValue = f.value || '{}';
                                const currentTableData = JSON.parse(currentValue);
                                
                                if (!currentTableData.cells) {
                                  currentTableData.cells = [];
                                }
                                
                                while (currentTableData.cells.length <= rowIndex) {
                                  currentTableData.cells.push([]);
                                }
                                
                                while (currentTableData.cells[rowIndex].length <= colIndex) {
                                  currentTableData.cells[rowIndex].push('');
                                }
                                
                                currentTableData.cells[rowIndex][colIndex] = newValue;
                                
                                const updatedValue = JSON.stringify(currentTableData);
                                
                                const updatedData = {
                                  coordinateFields: prev.map(prevField => 
                                    prevField.id === field.id 
                                      ? { 
                                          ...prevField, 
                                          value: updatedValue,
                                          fontSize: prevField.fontSize || 14,
                                          fontFamily: prevField.fontFamily || 'Arial',
                                          fontWeight: prevField.fontWeight || 'normal',
                                          color: prevField.color || '#000000'
                                        }
                                      : prevField
                                  )
                                };
                                stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
                                
                                return { ...f, value: updatedValue };
                              } catch (error) {
                                console.error('테이블 데이터 업데이트 실패:', error);
                                return f;
                              }
                            }
                            return f;
                          });
                        });
                      }}
                    />
                  ) : field.type === 'date' ? (
                    <input
                      type="date"
                      value={field.value || ''}
                      data-field-id={field.id}
                      onChange={(e) => handleCoordinateFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <input
                      type="text"
                      value={field.value || ''}
                      data-field-id={field.id}
                      onChange={(e) => handleCoordinateFieldChange(field.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder={`${field.label} 입력`}
                    />
                  )}
                </div>
              );
            })}
            
            {coordinateFields.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>표시할 필드가 없습니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      
      {/* 미리보기 모달 */}
      {currentDocument?.template?.pdfImagePath && (
        <DocumentPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          pdfImageUrl={`/uploads/pdf-templates/${currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || ''}`}
          coordinateFields={coordinateFields}
          documentTitle={currentDocument.template.name || '문서'}
        />
      )}

      {/* 편집 완료 확인 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">편집 완료 확인</h3>
            
            <div className="space-y-4">
              <p className="text-gray-600">
                문서 편집을 완료하시겠습니까?
              </p>
              <p className="text-sm text-amber-600">
                ⚠️ 편집 완료 후에는 문서를 수정할 수 없으며, 검토자 지정 단계로 이동합니다.
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCompleteModal(false)}
                disabled={isCompleting}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={confirmCompleteEditing}
                disabled={isCompleting}
                className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                  isCompleting 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isCompleting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                        <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                        <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                      </circle>
                    </svg>
                    완료 중...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    확인
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentEditor;