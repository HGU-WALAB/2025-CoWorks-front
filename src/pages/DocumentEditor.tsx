import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { usePrint, type PrintField, type PrintSignatureField } from '../utils/printUtils';

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

// CoordinateField 타입 정의 (PdfViewer에서 가져오지 않고 직접 정의)
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
  // 폰트 설정 추가
  fontSize?: number; // 폰트 크기 (px)
  fontFamily?: string; // 폰트 패밀리
  // 테이블 정보 추가
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][];
    columnWidths?: number[]; // 컬럼 너비 비율 추가
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
  x: number; // coordinateX -> x로 변경
  y: number; // coordinateY -> y로 변경
  type?: 'field' | 'table'; // 필드 타입 추가
  // 폰트 설정 추가
  fontSize?: number; // 폰트 크기 (px)
  fontFamily?: string; // 폰트 패밀리
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][]; // 각 셀의 내용
    columnWidths?: number[]; // 컬럼 너비 비율 추가
  };
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDocument, loading, getDocument, updateDocumentSilently, clearCurrentDocument } = useDocumentStore();
  const { user } = useAuthStore();

  // 템플릿 필드 기반 입력 시스템 상태
  const [templateFields, setTemplateFields] = useState<TemplateField[]>([]);
  
  // CoordinateFields 상태를 별도로 관리 (리렌더링 최적화)
  const [coordinateFields, setCoordinateFields] = useState<CoordinateField[]>([]);
  
  // 저장 상태 관리
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  // 미리보기 모달 상태
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewCoordinateFields, setPreviewCoordinateFields] = useState<any[]>([]);
  const [previewSignatureFields, setPreviewSignatureFields] = useState<any[]>([]);

  // 미리보기 처리 함수 (DocumentList와 동일한 로직)
  const handlePreview = useCallback(() => {
    console.log('🔍 DocumentEditor - handlePreview 호출됨');

    if (!currentDocument) {
      console.warn('⚠️ DocumentEditor - currentDocument가 없습니다');
      return;
    }

    try {
      console.log('🔍 DocumentEditor - 미리보기 문서:', currentDocument);
      console.log('🔍 DocumentEditor - PDF 이미지 경로:', currentDocument.template?.pdfImagePath);

      // 템플릿 필드와 저장된 필드를 합쳐서 설정
      let allFields: any[] = [];

      // 템플릿 필드 추가
      if (currentDocument.template?.coordinateFields) {
        try {
          const templateFields = JSON.parse(currentDocument.template.coordinateFields);
          allFields = [...templateFields];
          console.log('📄 DocumentEditor - 템플릿 필드:', templateFields);
        } catch (error) {
          console.error('템플릿 필드 파싱 오류:', error);
        }
      }

      // 저장된 추가 필드 추가
      const savedFields = currentDocument.data?.coordinateFields || [];
      allFields = [...allFields, ...savedFields];

      console.log('📄 DocumentEditor - 모든 필드:', allFields);
      setPreviewCoordinateFields(allFields);

      // 서명 필드 처리
      const docSignatureFields = currentDocument.data?.signatureFields || [];
      const docSignatures = currentDocument.data?.signatures || {};

      const processedSignatureFields = docSignatureFields.map((field: any) => ({
        ...field,
        signatureData: docSignatures[field.reviewerEmail]
      }));

      console.log('🖋️ DocumentEditor - 서명 필드 처리:', {
        originalSignatureFields: docSignatureFields,
        signatures: docSignatures,
        processedSignatureFields
      });

      setPreviewSignatureFields(processedSignatureFields);

      console.log('🔍 DocumentEditor - 미리보기 모달 표시');
      setShowPreviewModal(true);
    } catch (error) {
      console.error('문서 미리보기 실패:', error);
    }
  }, [currentDocument]);
  
  // 인쇄 기능
  const { isPrinting, print } = usePrint();

  // 편집 완료 관련 상태
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);


  // 저장 관련 refs
  const pendingSaves = useRef<Map<number, string>>(new Map());
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // 템플릿 필드가 로드되면 coordinateFields 초기화
  useEffect(() => {
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      
      // 템플릿 필드 기반으로 coordinateFields 초기화 (픽셀값 직접 사용)
      const initialFields = templateFields
        .filter(field => field.x !== undefined && field.y !== undefined)
        .map(field => {
          // 픽셀 좌표를 그대로 사용 (변환 없음)
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
              : '', // 테이블인 경우 기본 빈 셀 배열 생성, 아니면 빈 값
            required: field.required || false,
            fontSize: field.fontSize || 14, // 기본 폰트 크기를 14px로 설정
            fontFamily: field.fontFamily || 'Arial',
            page: 1, // page 속성 추가
            // 테이블 정보 추가
            ...(field.fieldType === 'table' && field.tableData && {
              tableData: field.tableData
            })
          };
        });
      
      setCoordinateFields(initialFields);
    }
  }, [templateFields, id]);

  // CoordinateFields 초기화 (문서별 독립적 관리)
  useEffect(() => {
    
    // 문서 ID가 다르면 필드 구조는 유지하되 값만 초기화
    if (currentDocument && id && currentDocument.id !== parseInt(id)) {
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      return;
    }
    
    // 템플릿 필드가 없고 기존 문서 데이터가 있는 경우에만 사용
    if ((!Array.isArray(templateFields) || templateFields.length === 0) && 
        currentDocument?.data?.coordinateFields && 
        Array.isArray(currentDocument.data.coordinateFields)) {
      // 기존 문서 데이터 기반으로 설정 (이 문서의 저장된 값 사용)
      const processedFields = currentDocument.data.coordinateFields.map(field => ({
        id: field.id.toString(),
        label: field.label || `필드 ${field.id}`,
        x: field.x,
        y: field.y,
        width: field.width || 100,
        height: field.height || 20,
        type: 'text' as 'text' | 'date',
        value: field.value || '', // 이 문서에 저장된 값 사용
        required: field.required || false,
        fontSize: field.fontSize || 12, // 폰트 크기 추가
        fontFamily: field.fontFamily || 'Arial', // 폰트 패밀리 추가
        page: 1, // page 속성 추가
        // 테이블 정보도 보존
        ...(field.tableData && { tableData: field.tableData })
      }));
      setCoordinateFields(processedFields);
    }
  }, [currentDocument?.data?.coordinateFields, currentDocument?.id, id, templateFields]);

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

  // 문서 필드 값 저장
  const saveDocumentFieldValue = useCallback(async (templateFieldId: number, value: string) => {
    if (!id) return;

    try {
      console.log('💾 필드 값 저장 시작:', { 
        documentId: id, 
        templateFieldId, 
        value,
        timestamp: new Date().toISOString()
      });
      
      // 백엔드 API는 단일 객체를 받음 (배열이 아님)
      await axios.post(`/api/documents/${id}/field-values`, {
        templateFieldId,
        value
      });
      
      console.log('💾 필드 값 저장 성공:', {
        documentId: id,
        templateFieldId,
        value
      });
      
      // 자동 저장 성공 시 시간 업데이트
      setLastSaved(new Date());
    } catch (error) {
      console.error('문서 필드 값 저장 실패:', {
        documentId: id,
        templateFieldId,
        value,
        error
      });
    }
  }, [id]);

  // 수동 저장 함수
  const handleManualSave = useCallback(async () => {
    if (!id || !currentDocument) return;
    
    setIsSaving(true);
    try {
      // coordinateFields 저장 방식으로 통일
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
          required: field.required || false,
          fontSize: field.fontSize || 12, // 폰트 크기 추가
          fontFamily: field.fontFamily || 'Arial', // 폰트 패밀리 추가
          page: 1, // page 속성 추가
          // 테이블 정보도 보존
          ...(field.tableData && { tableData: field.tableData })
        }))
      };
      
      await updateDocumentSilently(parseInt(id), { data: updatedData });
      
      // 모든 타이머 클리어
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
      
      setLastSaved(new Date());
    } catch (error) {
      console.error('수동 저장 실패:', error);
    } finally {
      setIsSaving(false);
    }
  }, [id, currentDocument, templateFields, coordinateFields, saveDocumentFieldValue, updateDocumentSilently]);

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

    // 필수 필드 검증
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

    console.log('편집 완료 시작 - 문서 ID:', id);
    console.log('현재 문서 상태:', currentDocument?.status);
    console.log('현재 문서 데이터:', currentDocument);

    setIsCompleting(true);
    try {
      // 먼저 현재 데이터를 저장
      console.log('데이터 저장 시작');
      await handleManualSave();
      console.log('데이터 저장 완료');
      
      // 편집 완료 API 호출
      console.log('편집 완료 API 호출 시작');
      const response = await axios.post(`/api/documents/${id}/complete-editing`);
      console.log('편집 완료 API 응답:', response);
      
      if (response.status === 200) {
        // 현재 사용자가 검토자 지정 권한이 있는지 확인
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
      
      // 에러 메시지 추출
      let errorMessage = '편집 완료 중 오류가 발생했습니다.';
      
      if (error.response) {
        // 서버에서 응답이 온 경우
        console.error('Error response:', error.response.data);
        console.error('Error status:', error.response.status);
        
        if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data && typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      } else if (error.request) {
        // 요청이 만들어졌으나 응답을 받지 못한 경우
        console.error('Error request:', error.request);
        errorMessage = '서버와의 연결에 실패했습니다.';
      } else {
        // 요청을 설정하는 중에 오류가 발생한 경우
        console.error('Error message:', error.message);
        errorMessage = error.message;
      }
      
      alert(errorMessage);
    } finally {
      setIsCompleting(false);
      setShowCompleteModal(false);
    }
  }, [id, handleManualSave, navigate]);

  // 인쇄 기능 - 공통 유틸리티 사용
  const handlePrint = useCallback(async () => {
    try {
      // 인쇄 전 최신 데이터 저장
      await handleManualSave();
      
      // PDF 이미지 URL (절대 경로로 변경)
      const pdfImageUrl = currentDocument?.template?.pdfImagePath 
        ? `/uploads/pdf-templates/${currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || ''}` 
        : '';
      
      // 서명 필드 정보
      const signatureFields = (currentDocument?.data?.signatureFields || []).map((field: any) => ({
        ...field,
        signatureData: currentDocument?.data?.signatures?.[field.reviewerEmail]
      })) as PrintSignatureField[];
      
      // 좌표 필드를 PrintField 타입으로 변환
      const printFields: PrintField[] = coordinateFields.map(field => ({
        id: field.id,
        label: field.label,
        value: field.value || '',
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        fontSize: field.fontSize,
        fontFamily: field.fontFamily,
        tableData: field.tableData
      }));
      
      // 공통 인쇄 함수 호출
      await print({
        pdfImageUrl,
        coordinateFields: printFields,
        signatureFields,
        signatures: currentDocument?.data?.signatures || {},
        documentId: currentDocument?.id,
        documentTitle: currentDocument?.data?.title || '문서'
      });
      
    } catch (error) {
      console.error('DocumentEditor 인쇄 실패:', error);
    }
  }, [handleManualSave, coordinateFields, currentDocument, print]);

  // 안정된 핸들러 ref (리렌더링 방지)
  const stableHandlersRef = useRef({
    saveDocumentFieldValue,
    debouncedUpdateDocument
  });

  // 핸들러 ref 업데이트
  useEffect(() => {
    stableHandlersRef.current.saveDocumentFieldValue = saveDocumentFieldValue;
    stableHandlersRef.current.debouncedUpdateDocument = debouncedUpdateDocument;
  }, [saveDocumentFieldValue, debouncedUpdateDocument]);

  // PDF 필드 값 변경 핸들러 (최적화 - 안정된 참조)
  // 개별 CoordinateField 값 변경 핸들러 (간소화)
  const handleCoordinateFieldChange = useCallback((fieldId: string, value: string) => {
    if (!id || !currentDocument) return;

    // 즉시 로컬 coordinateFields 상태 업데이트 (리렌더링 방지)
    setCoordinateFields(prev => {
      const updated = prev.map(field => 
        field.id === fieldId 
          ? { ...field, value } 
          : field
      );
      console.log('🔧 coordinateFields 로컬 업데이트:', {
        documentId: id,
        fieldId,
        value,
        allFields: updated.map(f => ({ id: f.id, label: f.label, value: f.value }))
      });
      return updated;
    });

    // 템플릿 필드가 있는 경우도 coordinateFields 방식으로 저장
    console.log('🔧 좌표 필드 모드로 저장:', {
      documentId: id,
      fieldId,
      value,
      hasTemplateFields: Array.isArray(templateFields) && templateFields.length > 0
    });

    // coordinateFields 전체 업데이트 방식으로 통일
    const updatedFields = coordinateFields.map(field => 
      field.id === fieldId 
        ? { ...field, value } 
        : field
    );
    
    // 필요한 데이터만 포함하여 저장
    const updatedData = {
      coordinateFields: updatedFields.map(field => ({
        ...field,
        page: 1 // page 속성 추가
      }))
    };
    
    console.log('💾 coordinateFields 업데이트 저장:', {
      documentId: id,
      fieldId,
      value,
      updatedData
    });
    
    stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
  }, [id, currentDocument, templateFields, coordinateFields]);


  // 템플릿 필드 로드
  const loadTemplateFields = useCallback(async () => {
    if (!currentDocument?.templateId) {
      console.log('🔧 템플릿 ID가 없어서 템플릿 필드 로드 스킵');
      setTemplateFields([]);
      return;
    }

    try {
      console.log('🔧 [편집단계] 템플릿 필드 로드 시작:', {
        documentId: currentDocument.id,
        templateId: currentDocument.templateId
      });
      
      // 템플릿 정보를 가져와서 coordinateFields에서 테이블 데이터 추출
      const templateResponse = await axios.get(`/api/templates/${currentDocument.templateId}`);
      const template = templateResponse.data;
      
      console.log('🔧 [편집단계] 템플릿 정보 로드:', {
        template,
        hasCoordinateFields: !!template.coordinateFields,
        coordinateFieldsType: typeof template.coordinateFields,
        coordinateFieldsValue: template.coordinateFields
      });

      let parsedFields: any[] = [];
      
      // coordinateFields에서 필드 정보 파싱
      if (template.coordinateFields) {
        try {
          parsedFields = typeof template.coordinateFields === 'string' 
            ? JSON.parse(template.coordinateFields)
            : template.coordinateFields;
            
          console.log('🔧 [편집단계] 파싱된 coordinate fields 상세:', {
            parsedFields,
            isArray: Array.isArray(parsedFields),
            fieldsCount: Array.isArray(parsedFields) ? parsedFields.length : 0,
            tableFields: parsedFields.filter(f => f.type === 'table')
          });
        } catch (error) {
          console.error('coordinateFields 파싱 실패:', error);
        }
      }
      
      // coordinateFields를 템플릿 필드 형태로 변환
      const convertedFields = parsedFields.map((field, index) => {
        const converted = {
          id: parseInt(field.id?.replace(/\D/g, '') || index.toString()), // ID에서 숫자만 추출
          fieldKey: field.id,
          label: field.label,
          fieldType: field.type === 'table' ? 'table' : 'text',
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          required: field.required || false,
          type: field.type || 'field',
          fontSize: field.fontSize || 14, // 기본 폰트 크기를 14px로 설정
          fontFamily: field.fontFamily || 'Arial', // 폰트 패밀리 추가
          tableData: field.tableData
        };
        
        console.log('🔤 템플릿 필드 폰트 정보:', {
          fieldId: converted.id,
          fieldLabel: converted.label,
          fieldType: converted.fieldType,
          fontSize: converted.fontSize,
          fontFamily: converted.fontFamily,
          originalField: field
        });
        
        return converted;
      });

      setTemplateFields(convertedFields);
      
    } catch (error) {
      console.error('템플릿 필드 로드 실패:', {
        documentId: currentDocument.id,
        templateId: currentDocument.templateId,
        error
      });
      setTemplateFields([]);
    }
  }, [currentDocument?.templateId, currentDocument?.id]);

  // 문서 필드 값 로드
  const loadDocumentFieldValues = useCallback(async () => {
    if (!id || !Array.isArray(templateFields) || templateFields.length === 0) {
      console.log('📥 필드 값 로드 스킵:', { 
        hasId: !!id, 
        hasTemplateFields: Array.isArray(templateFields) && templateFields.length > 0 
      });
      return;
    }

    try {
      console.log('📥 필드 값 로드 시작:', {
        documentId: id,
        templateFieldsCount: templateFields.length,
        templateFieldIds: templateFields.map(tf => tf.id),
        currentDocumentData: currentDocument?.data
      });
      
      // 문서 데이터에서 필드 값 추출 (coordinateFields 사용)
      let fieldValues: any[] = [];
      
      if (currentDocument?.data?.coordinateFields) {
        fieldValues = currentDocument.data.coordinateFields;
        console.log('📥 문서의 coordinateFields에서 필드 값 로드:', fieldValues);
      } else {
        console.log('📥 문서에 저장된 coordinateFields가 없음, 빈 값으로 초기화');
      }
      
      // coordinateFields 업데이트 - 템플릿 필드 정보에 저장된 값 추가
      const updated = templateFields.map(templateField => {
        // coordinateFields에서 해당 필드 찾기 (ID 또는 label 기준)
        const savedField = Array.isArray(fieldValues) ? 
          fieldValues.find((fv: any) => 
            fv.id === templateField.id.toString() || 
            fv.label === templateField.label
          ) : null;
        
        // 테이블 필드인 경우 기본값 처리
        let value = '';
        if (templateField.fieldType === 'table' && templateField.tableData) {
          if (savedField && savedField.value) {
            value = savedField.value;
          } else {
            // 테이블 필드의 기본값: 빈 셀 배열 + 컬럼 너비
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
        
        console.log('📥 필드 값 매핑:', {
          templateFieldId: templateField.id,
          templateFieldLabel: templateField.label,
          templateFieldType: templateField.fieldType,
          foundSavedField: !!savedField,
          value: value,
          hasTableData: !!templateField.tableData,
          tableData: templateField.tableData
        });
        
        // 픽셀 좌표를 그대로 사용 (변환 없음)
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
          fontSize: templateField.fontSize || 14, // 기본 폰트 크기를 14px로 설정
          fontFamily: templateField.fontFamily || 'Arial',
          page: 1, // page 속성 추가
          // 테이블 정보 보존
          ...(templateField.fieldType === 'table' && templateField.tableData && {
            tableData: templateField.tableData
          })
        };
      });
      
      console.log('📥 업데이트된 coordinateFields:', {
        documentId: id,
        updated: updated.map(f => ({ id: f.id, label: f.label, value: f.value, x: f.x, y: f.y }))
      });
      setCoordinateFields(updated);
    } catch (error) {
      console.error('문서 필드 값 로드 실패:', {
        documentId: id,
        error
      });
      // 오류 시에도 템플릿 필드 기반으로 coordinateFields 설정 (값은 빈 상태)
      setCoordinateFields(templateFields.map(templateField => {
        const pixelCoords = {
          x: templateField.x,
          y: templateField.y,
          width: templateField.width || 100,
          height: templateField.height || 30
        };
        
        // 테이블 필드인 경우 기본값 설정
        let defaultValue = '';
        if (templateField.fieldType === 'table' && templateField.tableData) {
          defaultValue = JSON.stringify({
            rows: templateField.tableData.rows,
            cols: templateField.tableData.cols,
            cells: Array(templateField.tableData.rows).fill(null).map(() => 
              Array(templateField.tableData!.cols).fill('')
            ),
            columnWidths: templateField.tableData.columnWidths || Array(templateField.tableData.cols).fill(1 / templateField.tableData.cols)
          });
        }
        
        return {
          id: templateField.id.toString(),
          label: templateField.label || `필드 ${templateField.id}`,
          x: pixelCoords.x,
          y: pixelCoords.y,
          width: pixelCoords.width,
          height: pixelCoords.height,
          type: (templateField.fieldType?.toLowerCase() === 'date' ? 'date' : 'text') as 'text' | 'date',
          value: defaultValue,
          required: templateField.required || false,
          fontSize: templateField.fontSize || 14, // 기본 폰트 크기를 14px로 설정
          fontFamily: templateField.fontFamily || 'Arial',
          page: 1, // page 속성 추가
          // 테이블 정보 보존
          ...(templateField.fieldType === 'table' && templateField.tableData && {
            tableData: templateField.tableData
          })
        };
      }));
    }
  }, [id, templateFields]);

  // 초기 데이터 로드
  useEffect(() => {
    if (id) {
      // 페이지 방문 시 항상 최신 문서 데이터를 로드
      console.log('📄 문서 로드 시작:', id);
      
      // 상태 초기화 - 문서 변경 시 이전 상태 완전히 초기화
      setTemplateFields([]);
      // coordinateFields는 필드 구조 유지, 값만 초기화
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 권한 확인 - 생성자는 편집 불가
  useEffect(() => {
    const checkPermissionAndStartEditing = async () => {
      if (currentDocument && user) {
        console.log('권한 확인 시작:', {
          currentUser: user.email,
          documentTasks: currentDocument.tasks,
          documentStatus: currentDocument.status
        });

        if (!isEditor) {
          alert('이 문서를 편집할 권한이 없습니다.');
          navigate('/documents');
          return;
        }

        // 편집자인 경우, 문서가 DRAFT 상태라면 편집 시작
        if (currentDocument.status === 'DRAFT' && isEditor) {
          try {
            console.log('편집 시작 API 호출');
            await axios.post(`/api/documents/${currentDocument.id}/start-editing`);
            console.log('편집 시작 완료');
            // 문서 상태를 다시 로드
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

  // 문서가 변경될 때마다 상태 완전 초기화
  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 또는 문서 변경 시 상태 초기화
      console.log('🧹 문서 에디터 상태 초기화:', { documentId: id });
      setTemplateFields([]);
      // coordinateFields는 필드 구조 유지, 값만 초기화
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      setIsSaving(false);
      setLastSaved(null);
      
      // DocumentStore 상태도 초기화
      clearCurrentDocument();
      
      // 대기 중인 저장 작업 취소
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
    };
  }, [id, clearCurrentDocument]); // id가 변경될 때마다 초기화

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

  // 키보드 단축키 (Ctrl+S / Cmd+S로 저장)
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

  // 컴포넌트 언마운트 시 상태 정리
  useEffect(() => {
    return () => {
      // 타이머 정리
      saveTimeouts.current.forEach(timeout => clearTimeout(timeout));
      saveTimeouts.current.clear();
      pendingSaves.current.clear();
      
      // 상태 초기화
      setTemplateFields([]);
      setCoordinateFields([]);
      setIsSaving(false);
      setLastSaved(null);
    };
  }, []);

  // PDF 뷰어 렌더링 (CSS Transform 스케일링 적용)
  const renderPdfViewer = useMemo(() => {
    if (!currentDocument?.template?.pdfImagePath) return null;
    
    // PDF 이미지 파일 경로 (.png 파일 사용)
    const imageFileName = currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    const pdfImageUrl = `/uploads/pdf-templates/${imageFileName}`;
    
    return (
      <div className="relative bg-gray-100 h-full overflow-auto flex justify-center items-start p-4">
        {/* PDF 컨테이너 - 고정 크기 */}
        <div 
          className="relative bg-white shadow-sm border"
          style={{
            width: '1240px',
            height: '1754px',
            minWidth: '1240px', // 최소 크기를 원본 크기로 고정
            minHeight: '1754px', // 최소 높이도 원본 크기로 고정
            flexShrink: 0 // 컨테이너가 줄어들지 않도록 설정
          }}
        >
          {/* PDF 배경 이미지 */}
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
          
          {/* 필드 컨테이너 - 퍼센트 기반 위치 */}
          <div className="absolute inset-0"
          >
            {/* 필드 오버레이 - 퍼센트 기반 위치 */}
            {coordinateFields.map((field) => {
              console.log('🎯 편집 화면 - 필드 렌더링:', {
                id: field.id,
                label: field.label,
                x: field.x,
                y: field.y,
                width: field.width,
                height: field.height,
                value: field.value,
                hasTableData: !!field.tableData,
                tableData: field.tableData,
                fieldType: field.type,
                fontSize: field.fontSize, // 폰트 크기 로그 추가
                fontFamily: field.fontFamily // 폰트 패밀리 로그 추가
              });
              
              // 퍼센트 기반 위치 계산
              // const leftPercent = (field.x / 1240) * 100;
              // const topPercent = (field.y / 1754) * 100.5;
              // const widthPercent = (field.width / 1240) * 100.5;
              // const heightPercent = (field.height / 1754) * 100.5;

              // 픽셀값 직접 사용
              const leftPercent = field.x;
              const topPercent = field.y;
              const widthPercent = field.width;
              const heightPercent = field.height;

              // 테이블 필드인지 확인
              let isTableField = false;
              let tableInfo = null;
              
              // 1. tableData 속성으로 확인
              if (field.tableData) {
                isTableField = true;
                tableInfo = field.tableData;
              } else {
                // 2. value를 파싱해서 테이블 데이터 확인
                try {
                  if (field.value && typeof field.value === 'string') {
                    const parsedValue = JSON.parse(field.value);
                    if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                      isTableField = true;
                      tableInfo = {
                        rows: parsedValue.rows,
                        cols: parsedValue.cols,
                        columnWidths: parsedValue.columnWidths // 컬럼 너비 정보도 포함
                      };
                    }
                  }
                } catch (e) {
                  // JSON 파싱 실패 시 일반 필드로 처리
                }
              }
              
              console.log('🔍 테이블 필드 확인:', {
                fieldId: field.id,
                fieldLabel: field.label,
                isTableField,
                tableInfo,
                hasTableDataProperty: !!field.tableData,
                value: field.value
              });

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
                    
                    // 테이블이 아닌 일반 필드인 경우
                    if (!isTableField) {
                      // 필드를 찾아서 편집 상태로 설정
                      const templateField = templateFields.find(tf => tf.id.toString() === field.id);
                      if (templateField) {
                        // 우측 패널에서 해당 필드로 포커스 이동
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
                    // 테이블 렌더링
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
                              // 1. 서버에서 불러온 데이터 우선 확인 (field.value)
                              if (field.value) {
                                let savedTableData: any = {};
                                
                                if (typeof field.value === 'string') {
                                  savedTableData = JSON.parse(field.value);
                                } else {
                                  savedTableData = field.value;
                                }
                                
                                // 저장된 셀 데이터가 있으면 사용
                                if (savedTableData.cells && 
                                    Array.isArray(savedTableData.cells) && 
                                    savedTableData.cells[rowIndex] && 
                                    Array.isArray(savedTableData.cells[rowIndex])) {
                                  cellText = savedTableData.cells[rowIndex][colIndex] || '';
                                }
                              }
                              
                              // 2. 서버 데이터가 없으면 템플릿 기본값 확인
                              if (!cellText && field.tableData && field.tableData.cells) {
                                cellText = field.tableData.cells[rowIndex]?.[colIndex] || '';
                              }
                              
                              console.log(`📋 테이블 셀 데이터 [${rowIndex}][${colIndex}]:`, {
                                fieldId: field.id,
                                fieldLabel: field.label,
                                cellText,
                                hasFieldValue: !!field.value,
                                hasTableData: !!field.tableData,
                                rowIndex,
                                colIndex
                              });
                              
                            } catch (error) {
                              console.error(`❌ 테이블 데이터 파싱 실패 [${rowIndex}][${colIndex}]:`, {
                                fieldId: field.id,
                                fieldLabel: field.label,
                                rawValue: field.value,
                                error
                              });
                              cellText = '';
                            }
                            
                            // 디버깅: 폰트 정보 로그
                            if (rowIndex === 0 && colIndex === 0) {
                              console.log('🔤 테이블 셀 폰트 정보:', {
                                fieldId: field.id,
                                fontSize: field.fontSize,
                                fontFamily: field.fontFamily,
                                hasTableData: !!field.tableData,
                                cellText
                              });
                            }
                            
                            return (
                              <div 
                                key={`${rowIndex}-${colIndex}`}
                                className="bg-white bg-opacity-70 border border-purple-200 hover:bg-opacity-90 cursor-pointer flex items-center justify-center p-1 transition-colors"
                                style={{ 
                                  minHeight: '20px',
                                  fontSize: `${field.fontSize || 14}px !important`,
                                  fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                  color: '#6b21a8', // text-purple-700 색상을 직접 적용
                                  fontWeight: '500'
                                }}
                                title={cellText || '클릭하여 편집'}
                              >
                                <span 
                                  className="text-center truncate leading-tight"
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    // 명시적으로 폰트 스타일 적용
                                    fontSize: `${field.fontSize || 14}px !important`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                    fontWeight: '500 !important',
                                    color: '#6b21a8 !important'
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
                    // 일반 필드 - 값이 있는 경우
                    <div className="text-gray-900 p-1 truncate text-center"
                      style={{
                        fontSize: `${field.fontSize || 14}px !important`,
                        fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                        fontWeight: '500 !important'
                      }}
                    >
                      {field.value}
                    </div>
                  ) : (
                    // 일반 필드 - 값이 없는 경우 (제목만 표시, 고정 스타일)
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
    <>
      {/* 인쇄용 스타일 */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            /* 모든 요소 숨김 */
            * {
              -webkit-print-color-adjust: exact !important;
              color-adjust: exact !important;
              visibility: hidden !important;
            }
            
            /* 인쇄용 컨테이너만 보이게 */
            .print-only {
              visibility: visible !important;
              display: block !important;
              position: fixed !important;
              top: 0 !important;
              left: 0 !important;
              width: 100vw !important;
              height: 100vh !important;
              background: white !important;
              z-index: 9999 !important;
            }
            
            .print-only * {
              visibility: visible !important;
            }
            
            @page {
              size: A4;
              margin: 0;
            }
            
            body {
              margin: 0 !important;
              padding: 0 !important;
            }
            
            .print-container {
              width: 210mm !important;
              height: 297mm !important;
              margin: 0 !important;
              padding: 0 !important;
              background: white !important;
              position: relative !important;
              overflow: hidden !important;
              page-break-after: avoid !important;
            }
            
            .print-pdf-container {
              width: 1240px !important;
              height: 1754px !important;
              transform: scale(0.169) !important;
              transform-origin: top left !important;
              position: absolute !important;
              top: 0 !important;
              left: 0 !important;
            }
            
            .print-field {
              position: absolute !important;
              background: transparent !important;
              border: none !important;
              font-weight: 600 !important;
              color: black !important;
              padding: 2px !important;
            }
            
            .print-table {
              background: transparent !important;
              border: 1px solid black !important;
            }
            
            .print-table-cell {
              border: 1px solid black !important;
              background: transparent !important;
              color: black !important;
              font-weight: 500 !important;
              padding: 2px !important;
            }
          }
        `
      }} />
      
    <div className="min-h-screen w-full bg-gray-50">
      {/* 헤더 - 고정 위치 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-6 py-4 flex justify-between items-center w-full">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{currentDocument.title || '문서 편집'}</h1>
          <div className="flex items-center gap-2 mt-1">
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
            onClick={handlePrint}
            disabled={isPrinting}
            className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 transition-colors ${
              isPrinting 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {isPrinting ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" strokeDasharray="32" strokeDashoffset="32">
                    <animate attributeName="stroke-dasharray" dur="1s" values="0 32;16 16;0 32;0 32" repeatCount="indefinite"/>
                    <animate attributeName="stroke-dashoffset" dur="1s" values="0;-16;-32;-32" repeatCount="indefinite"/>
                  </circle>
                </svg>
                준비 중...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                인쇄
              </>
            )}
          </button>
          <button
            onClick={handlePreview}
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
      <div className="fixed top-24 left-0 right-0 bottom-0 flex w-full no-print">
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex justify-center items-start p-4">
          {renderPdfViewer || (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-500">PDF 파일이 없습니다.</p>
            </div>
          )}
        </div>
        
        {/* 인쇄 전용 컨테이너 (화면에서는 숨김) */}
        <div className="hidden print-only print-container">
          {currentDocument?.template?.pdfImagePath && (
            <div className="print-pdf-container">
              {/* PDF 배경 이미지 */}
              <img 
                src={`/uploads/pdf-templates/${currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || ''}`}
                alt="PDF Document"
                style={{
                  width: '1240px',
                  height: '1754px',
                  objectFit: 'fill'
                }}
              />
              
              {/* 필드 데이터 오버레이 */}
              {coordinateFields.map((field) => {
                // 테이블 필드 확인
                let isTableField = false;
                let tableInfo = null;
                let tableData = null;
                
                if (field.tableData) {
                  isTableField = true;
                  tableInfo = field.tableData;
                } else if (field.value) {
                  try {
                    const parsedValue = JSON.parse(field.value);
                    if (parsedValue.rows && parsedValue.cols && parsedValue.cells) {
                      isTableField = true;
                      tableInfo = {
                        rows: parsedValue.rows,
                        cols: parsedValue.cols,
                        columnWidths: parsedValue.columnWidths
                      };
                      tableData = parsedValue;
                    }
                  } catch (e) {
                    // JSON 파싱 실패 시 일반 필드로 처리
                  }
                }
                
                return (
                  <div
                    key={field.id}
                    className="print-field"
                    style={{
                      left: `${field.x}px`,
                      top: `${field.y}px`,
                      width: `${field.width}px`,
                      height: `${field.height}px`,
                      fontSize: `${field.fontSize || 14}px`,
                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                    }}
                  >
                    {isTableField && tableData ? (
                      // 테이블 인쇄
                      <table className="print-table" style={{ width: '100%', height: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {Array(tableInfo!.rows).fill(null).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                              {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                                const cellContent = tableData.cells?.[rowIndex]?.[colIndex] || '';
                                return (
                                  <td 
                                    key={colIndex}
                                    className="print-table-cell"
                                    style={{
                                      width: tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`,
                                      fontSize: `${field.fontSize || 14}px`,
                                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                      textAlign: 'center',
                                      verticalAlign: 'middle'
                                    }}
                                  >
                                    {cellContent}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      // 일반 필드 인쇄
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${field.fontSize || 14}px`,
                        fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                        fontWeight: '600',
                        color: 'black'
                      }}>
                        {field.value || ''}
                      </div>
                    )}
                  </div>
                );
              })}
              
              {/* 서명 필드 인쇄 */}
              {currentDocument?.data?.signatureFields?.map((field: any) => {
                const signatureData = currentDocument.data?.signatures?.[field.reviewerEmail];
                return (
                  <div
                    key={`signature-${field.id}`}
                    className="print-field"
                    style={{
                      left: `${field.x}px`,
                      top: `${field.y}px`,
                      width: `${field.width}px`,
                      height: `${field.height}px`,
                    }}
                  >
                    {signatureData && (
                      <img 
                        src={signatureData} 
                        alt="서명"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'contain'
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 오른쪽 패널 - 필드 목록 (고정 너비, 고정 위치) */}
        <div className="w-96 bg-white border-l overflow-y-auto flex-shrink-0 h-full no-print">
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
              
              // 1. 서버에서 불러온 데이터 우선 확인 (field.value)
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
                    tableData = parsedValue; // 서버에서 불러온 실제 데이터 (cells 포함)
                    
                    console.log('📋 우측 패널 - 서버 테이블 데이터 사용:', {
                      fieldId: field.id,
                      fieldLabel: field.label,
                      tableInfo,
                      hasCells: !!parsedValue.cells,
                      cellsLength: parsedValue.cells?.length
                    });
                  }
                } catch (error) {
                  console.error('서버 테이블 데이터 파싱 실패:', error);
                }
              }
              
              // 2. 서버 데이터가 없으면 템플릿 tableData 속성 확인
              if (!isTableField && field.tableData) {
                isTableField = true;
                tableInfo = field.tableData;
                // 템플릿 데이터만 있고 서버 데이터가 없는 경우 빈 테이블로 초기화
                tableData = {
                  rows: field.tableData.rows,
                  cols: field.tableData.cols,
                  cells: Array(field.tableData.rows).fill(null).map(() => 
                    Array(field.tableData!.cols).fill('')
                  ),
                  columnWidths: field.tableData.columnWidths
                };
                
                console.log('📋 우측 패널 - 템플릿 테이블 데이터 사용 (빈 셀):', {
                  fieldId: field.id,
                  fieldLabel: field.label,
                  tableInfo
                });
              }

              return (
                <div key={field.id} className="border rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    {isTableField && <span className="text-purple-600 text-xs ml-1">(표)</span>}
                  </label>
                  
                  {isTableField && tableInfo ? (
                    // 테이블 편집 UI
                    <TableEditComponent 
                      tableInfo={tableInfo}
                      tableData={tableData}
                      onCellChange={(rowIndex, colIndex, newValue) => {
                        // coordinateFields 상태 업데이트
                        setCoordinateFields(prev => {
                          return prev.map(f => {
                            if (f.id === field.id) {
                              try {
                                const currentValue = f.value || '{}';
                                const currentTableData = JSON.parse(currentValue);
                                
                                // cells 배열이 없으면 초기화
                                if (!currentTableData.cells) {
                                  currentTableData.cells = [];
                                }
                                
                                // 해당 행이 없으면 생성
                                while (currentTableData.cells.length <= rowIndex) {
                                  currentTableData.cells.push([]);
                                }
                                
                                // 해당 열이 없으면 생성
                                while (currentTableData.cells[rowIndex].length <= colIndex) {
                                  currentTableData.cells[rowIndex].push('');
                                }
                                
                                // 셀 값 업데이트
                                currentTableData.cells[rowIndex][colIndex] = newValue;
                                
                                const updatedValue = JSON.stringify(currentTableData);
                                
                                // 서버 저장
                                const updatedData = {
                                  coordinateFields: prev.map(prevField => 
                                    prevField.id === field.id 
                                      ? { ...prevField, value: updatedValue }
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
      {showPreviewModal && currentDocument && (
        <DocumentPreviewModal
          isOpen={showPreviewModal}
          onClose={() => setShowPreviewModal(false)}
          pdfImageUrl={(() => {
            if (!currentDocument.template?.pdfImagePath) {
              console.warn('⚠️ DocumentEditor - PDF 이미지 경로가 없습니다');
              return '';
            }
            const filename = currentDocument.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
            return `/uploads/pdf-templates/${filename}`;
          })()}
          coordinateFields={previewCoordinateFields}
          signatureFields={previewSignatureFields}
          documentTitle={currentDocument.title || currentDocument.template?.name || '문서'}
        />
      )}

      {/* 편집 완료 확인 모달 */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 no-print">
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
    </>
  );
};

export default DocumentEditor;
