import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import { SignatureModal } from '../components/SignatureModal';
import TableBulkInput from '../components/TableBulkInput';
import TableEditComponent from '../components/DocumentEditor/TableEditComponent';
import LoadDocumentDataModal from '../components/modals/LoadDocumentDataModal';
import { createDebounce } from '../utils/debounce';
import { usePdfPages } from '../hooks/usePdfPages';
import { usePrint, type PrintField, type PrintSignatureField } from '../utils/printUtils';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import { getResponsiveFontSize, getResponsiveFontSizeForTableCell } from '../utils/fontUtils';

// CoordinateField 타입 정의 (PdfViewer에서 가져오지 않고 직접 정의)
interface CoordinateField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number' | 'editor_signature';
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
    columnHeaders?: string[]; // 컬럼 헤더 이름들
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
  page: number; // 페이지 번호 추가
  type?: 'field' | 'table'; // 필드 타입 추가
  // 폰트 설정 추가
  fontSize?: number; // 폰트 크기 (px)
  fontFamily?: string; // 폰트 패밀리
  tableData?: {
    rows: number;
    cols: number;
    cells: string[][]; // 각 셀의 내용
    columnWidths?: number[]; // 컬럼 너비 비율 추가
    columnHeaders?: string[]; // 컬럼 헤더 이름들
  };
}

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentDocument, loading, getDocument, updateDocumentSilently, clearCurrentDocument } = useDocumentStore();
  const { user } = useAuthStore();

  // PDF 원본 크기 (A4 기준)
  const PDF_WIDTH = 1240;
  const PDF_HEIGHT = 1754;

  // 스케일 및 컨테이너 ref
  const [scale, setScale] = useState(1);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

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

  // 작성자 서명 모달 상태
  const [showEditorSignatureModal, setShowEditorSignatureModal] = useState(false);
  const [currentSignatureFieldId, setCurrentSignatureFieldId] = useState<string | null>(null);

  // 테이블 벌크 입력 모달 상태
  const [showTableBulkInput, setShowTableBulkInput] = useState(false);
  const [currentTableFieldId, setCurrentTableFieldId] = useState<string | null>(null);
  const [currentTableInfo, setCurrentTableInfo] = useState<{ rows: number; cols: number } | null>(null);
  const [currentTableLabel, setCurrentTableLabel] = useState<string>('');
  const [currentTableData, setCurrentTableData] = useState<string[][] | undefined>(undefined);
  const [currentTableColumnHeaders, setCurrentTableColumnHeaders] = useState<string[] | undefined>(undefined);
  const [currentTableColumnWidths, setCurrentTableColumnWidths] = useState<number[] | undefined>(undefined);

  // 문서 데이터 불러오기 모달 상태
  const [showLoadDataModal, setShowLoadDataModal] = useState(false);
  const [originalFieldData, setOriginalFieldData] = useState<CoordinateField[] | null>(null);
  const [hasLoadedExternalData, setHasLoadedExternalData] = useState(false);

  // 리사이저블 패널 상태
  const [rightPanelWidth, setRightPanelWidth] = useState(524);
  const [isResizing, setIsResizing] = useState(false);

  // PDF 페이지 관리 훅 사용
  const {
    currentPage: currentPageNumber,
    setCurrentPage: setCurrentPageNumber,
    totalPages,
    pdfPages,
    nextPage,
    previousPage,
    hasNextPage,
    hasPreviousPage
  } = usePdfPages(currentDocument?.template, coordinateFields);

  // 컨테이너 너비에 맞춰 스케일링
  useEffect(() => {
    const updateScale = () => {
      if (!pdfContainerRef.current) return;

      const containerRect = pdfContainerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width - 32; // 패딩 제외 (p-4 = 16px * 2)

      // 템플릿 너비를 컨테이너 너비에 맞춤
      const scaleX = containerWidth / PDF_WIDTH;

      // 최소 0.3배, 최대 2배로 제한
      const newScale = Math.max(0.3, Math.min(scaleX, 2.0));

      setScale(newScale);
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [PDF_WIDTH, rightPanelWidth]); // rightPanelWidth 변경 시에도 스케일 재계산

  // 마우스 이벤트 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const newWidth = window.innerWidth - e.clientX;
    const minWidth = 280; // 최소 너비
    const maxWidth = 700; // 최대 너비

    setRightPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 이메일이 비어있으면 사용자 정보 다시 불러오기 (회원가입 안한 유저가 문서 할당 받았을시에 사용)
  useEffect(() => {
    const { refreshUser, setAuthHeader } = useAuthStore.getState();
    try {
      setAuthHeader();
    } catch {}
    if (user && (!user.email || user.email.trim() === '')) {
      refreshUser().catch(() => {
        // 사용자 정보 갱신 실패
      });
    }
  }, [user?.id]);

  // 마우스 이벤트 리스너 등록
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none'; // 선택 방지

      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 미리보기 처리 함수 (최신 문서 데이터 로드 후 표시)
  const handlePreview = useCallback(async () => {

    if (!currentDocument || !id) {
      console.warn('⚠️ DocumentEditor - currentDocument 또는 id가 없습니다');
      return;
    }

    try {

      // 먼저 현재 편집 중인 데이터를 저장
      try {
        setIsSaving(true);
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
            fontSize: field.fontSize || 16,
            fontFamily: field.fontFamily || 'Arial',
            page: field.page || 1, // 필드의 실제 page 정보 사용
            ...(field.tableData && { tableData: field.tableData })
          }))
        };

        await updateDocumentSilently(parseInt(id), { data: updatedData });
        setLastSaved(new Date());
        setIsSaving(false);
      } catch (saveError) {
        console.error('저장 실패:', saveError);
        setIsSaving(false);
      }

      // 최신 문서 데이터를 서버에서 다시 가져오기
      const response = await axios.get(`/api/documents/${id}`);
      const latestDocument = response.data;

      setPreviewCoordinateFields(coordinateFields);

      // 최신 문서 데이터에서 서명 필드 처리
      const docSignatureFields = latestDocument.data?.signatureFields || [];
      const docSignatures = latestDocument.data?.signatures || {};

      const processedSignatureFields = docSignatureFields.map((field: any) => ({
        ...field,
        signatureData: docSignatures[field.reviewerEmail]
      }));

      setPreviewSignatureFields(processedSignatureFields);

      setShowPreviewModal(true);
    } catch (error) {
      console.error('문서 미리보기 실패:', error);

      setPreviewCoordinateFields(coordinateFields);

      const docSignatureFields = currentDocument.data?.signatureFields || [];
      const docSignatures = currentDocument.data?.signatures || {};

      const processedSignatureFields = docSignatureFields.map((field: any) => ({
        ...field,
        signatureData: docSignatures[field.reviewerEmail]
      }));

      setPreviewSignatureFields(processedSignatureFields);
      setShowPreviewModal(true);
    }
  }, [currentDocument, coordinateFields, id, updateDocumentSilently]);
  
  // 인쇄 기능
  const { isPrinting, print } = usePrint();

  // 편집 완료 관련 상태
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // 작성자 권한 확인
  const isEditor = useMemo(() => {
    if (!currentDocument || !user) return false;

    // CREATOR 역할을 가진 사용자이거나 EDITOR 역할을 가진 사용자
    const isCreator = currentDocument.tasks?.some(task =>
      task.assignedUserEmail && task.assignedUserEmail === user.email && task.role === 'CREATOR'
    ) || false;
    
    const hasEditorRole = currentDocument.tasks?.some(task =>
      task.assignedUserEmail && task.assignedUserEmail === user.email && task.role === 'EDITOR'
    ) || false;

    return isCreator || hasEditorRole;
  }, [currentDocument, user]);


  // 저장 관련 refs
  const pendingSaves = useRef<Map<number, string>>(new Map());
  const saveTimeouts = useRef<Map<number, NodeJS.Timeout>>(new Map());

  // 템플릿 필드가 로드되면 coordinateFields 초기화
  useEffect(() => {
    if (Array.isArray(templateFields) && templateFields.length > 0) {
      
      // 템플릿 필드 기반으로 coordinateFields 초기화 (픽셀값 직접 사용)
      // 서명자 서명 필드는 제외 (작성자는 서명자 필드를 볼 수 없음)
      const initialFields = templateFields
        .filter(field => field.x !== undefined && field.y !== undefined)
        .filter(field => field.fieldType !== 'reviewer_signature') // 서명자 서명 필드 제외
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
            type: (
              field.fieldType?.toLowerCase() === 'date' ? 'date' :
              field.fieldType === 'editor_signature' ? 'editor_signature' :
              'text'
            ) as 'text' | 'date' | 'editor_signature',
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
            fontSize: field.fontSize || 18, // 기본 폰트 크기를 18px로 설정
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
      // 서명자 서명 필드는 제외
      const processedFields = currentDocument.data.coordinateFields
        .filter((field: any) => field.type !== 'reviewer_signature') // 서명자 서명 필드 제외
        .map((field: any) => ({
          id: field.id.toString(),
          label: field.label || `필드 ${field.id}`,
          x: field.x,
          y: field.y,
          width: field.width || 100,
          height: field.height || 20,
          type: (
            field.type === 'editor_signature' ? 'editor_signature' :
            field.type === 'date' ? 'date' :
            'text'
          ) as 'text' | 'date' | 'editor_signature',
          value: field.value || '', // 이 문서에 저장된 값 사용
          required: field.required || false,
          fontSize: field.fontSize || 18, // 폰트 크기 추가
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
    }, 60000), // 1분(60초)으로 변경
    [updateDocumentSilently]
  );

  // 문서 필드 값 저장
  const saveDocumentFieldValue = useCallback(async (templateFieldId: number, value: string) => {
    if (!id) return;

    try {
      
      // 백엔드 API는 단일 객체를 받음 (배열이 아님)
      await axios.post(`/api/documents/${id}/field-values`, {
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
          fontSize: field.fontSize || 18, // 폰트 크기 추가
          fontFamily: field.fontFamily || 'Arial', // 폰트 패밀리 추가
          page: field.page || 1, // 템플릿 필드의 실제 page 정보 사용
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

  // 작성자 서명 핸들러
  const handleEditorSignature = useCallback((fieldId: string) => {
    // 작성자 권한 확인
    if (!isEditor) {
      alert('작성자만 서명할 수 있습니다.');
      return;
    }

    setCurrentSignatureFieldId(fieldId);
    setShowEditorSignatureModal(true);
  }, [isEditor]);

  const handleSignatureSave = useCallback((signatureData: string) => {
    if (!currentSignatureFieldId || !id || !currentDocument) return;

    // 서명 데이터를 해당 필드에 직접 저장
    setCoordinateFields(prev => {
      const updated = prev.map(field =>
        field.id === currentSignatureFieldId
          ? { ...field, value: signatureData }
          : field
      );

      // 서버에 저장
      const updatedData = {
        coordinateFields: updated.map(field => ({
          ...field,
          page: 1
        }))
      };

      // 비동기 저장 (에러가 발생해도 UI는 업데이트됨)
      updateDocumentSilently(parseInt(id), { data: updatedData }).catch(error => {
        console.error('서명 저장 실패:', error);
      });

      return updated;
    });

    // 모달 닫기
    setShowEditorSignatureModal(false);
    setCurrentSignatureFieldId(null);
  }, [currentSignatureFieldId, id, currentDocument, updateDocumentSilently]);

  const handleSignatureModalClose = useCallback(() => {
    setShowEditorSignatureModal(false);
    setCurrentSignatureFieldId(null);
  }, []);


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

  // 작성 완료 확인 함수
  const confirmCompleteEditing = useCallback(async () => {
    if (!id) return;

    setIsCompleting(true);
    try {

      await handleManualSave();

      const response = await axios.post(`/api/documents/${id}/complete-editing`);
      
      if (response.status === 200) {
        // 현재 사용자가 서명자 지정 권한이 있는지 확인
        const hasAssignReviewerPermission = currentDocument?.tasks?.some(task => 
          task.assignedUserEmail === user?.email && 
          (task.role === 'CREATOR' || (task.role === 'EDITOR'))
        );

        if (hasAssignReviewerPermission) {
          alert('문서 작성이 완료되었습니다. 서명자 지정 단계로 이동합니다.');
          navigate(`/documents/${id}/signer-assignment`);
        } else {
          alert('작성이 완료되었습니다. 생성자 또는 권한이 있는 작성자가 서명자를 지정할 수 있습니다.');
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
        type: field.type,
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
        documentTitle: currentDocument?.title || '문서'
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
      return updated;
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
    
    stableHandlersRef.current.debouncedUpdateDocument(parseInt(id!), { data: updatedData });
  }, [id, currentDocument, templateFields, coordinateFields]);

  // 테이블 벌크 입력 핸들러들
  const handleTableBulkInputOpen = useCallback((fieldId: string) => {
    const field = coordinateFields.find(f => f.id === fieldId);
    if (!field || !field.tableData) return;

    // 기존 테이블 데이터 추출
    let existingTableData: string[][] | undefined = undefined;

    // field.value에서 실제 저장된 데이터 확인
    if (field.value) {
      try {
        const parsedValue = JSON.parse(field.value);
        if (parsedValue.cells && Array.isArray(parsedValue.cells)) {
          existingTableData = parsedValue.cells.map(row =>
            Array.isArray(row) ? row.map(cell => cell ? String(cell) : '') : []
          );
        }
      } catch (error) {
        console.error('테이블 데이터 파싱 실패:', error);
      }
    }

    // field.value에서 데이터를 찾지 못한 경우, field.tableData.cells 확인 (fallback)
    if (!existingTableData && field.tableData.cells && Array.isArray(field.tableData.cells)) {
      existingTableData = field.tableData.cells.map(row =>
        Array.isArray(row) ? row.map(cell => cell ? String(cell) : '') : []
      );
    }

    // column headers 추출
    let columnHeaders: string[] | undefined = undefined;
    if (field.tableData.columnHeaders && Array.isArray(field.tableData.columnHeaders)) {
      columnHeaders = field.tableData.columnHeaders;
    }

    // column widths 추출
    let columnWidths: number[] | undefined = undefined;
    if (field.tableData.columnWidths && Array.isArray(field.tableData.columnWidths)) {
      columnWidths = field.tableData.columnWidths;
    }

    setCurrentTableFieldId(fieldId);
    setCurrentTableInfo({ rows: field.tableData.rows, cols: field.tableData.cols });
    setCurrentTableLabel(field.label || '표');
    setCurrentTableData(existingTableData);
    setCurrentTableColumnHeaders(columnHeaders);
    setCurrentTableColumnWidths(columnWidths);
    setShowTableBulkInput(true);
  }, [coordinateFields]);

  const handleTableBulkInputClose = useCallback(() => {
    setShowTableBulkInput(false);
    setCurrentTableFieldId(null);
    setCurrentTableInfo(null);
    setCurrentTableLabel('');
    setCurrentTableData(undefined);
    setCurrentTableColumnHeaders(undefined);
    setCurrentTableColumnWidths(undefined);
  }, []);

  const handleTableBulkInputApply = useCallback((data: string[][]) => {
    if (!currentTableFieldId) return;

    const fieldIndex = coordinateFields.findIndex(f => f.id === currentTableFieldId);
    if (fieldIndex === -1) return;

    const field = coordinateFields[fieldIndex];
    if (!field.tableData) return;

    // 새로운 테이블 데이터 생성
    const updatedTableData = {
      ...field.tableData,
      cells: data
    };

    // 필드 업데이트
    const updatedFields = [...coordinateFields];
    updatedFields[fieldIndex] = {
      ...field,
      tableData: updatedTableData,
      value: JSON.stringify(updatedTableData)
    };

    setCoordinateFields(updatedFields);
    handleTableBulkInputClose();

    // 서버에 저장
    if (field.id) {
      handleCoordinateFieldChange(field.id, JSON.stringify(updatedTableData));
    }
  }, [currentTableFieldId, coordinateFields, handleCoordinateFieldChange, handleTableBulkInputClose]);

  // 템플릿 필드 로드
  const loadTemplateFields = useCallback(async () => {
    if (!currentDocument?.templateId) {
      setTemplateFields([]);
      return;
    }

    try {
      
      // 템플릿 정보를 가져와서 coordinateFields에서 테이블 데이터 추출
      const templateResponse = await axios.get(`/api/templates/${currentDocument.templateId}`);
      const template = templateResponse.data;


      let parsedFields: any[] = [];
      
      // coordinateFields에서 필드 정보 파싱
      if (template.coordinateFields) {
        try {
          parsedFields = typeof template.coordinateFields === 'string' 
            ? JSON.parse(template.coordinateFields)
            : template.coordinateFields;

        } catch (error) {
          console.error('coordinateFields 파싱 실패:', error);
        }
      }
      
      // coordinateFields를 템플릿 필드 형태로 변환
      // 서명자 서명 필드는 제외 (작성자는 서명자 필드를 볼 수 없음)
      const convertedFields = parsedFields
        .filter(field => field.type !== 'reviewer_signature') // 서명자 서명 필드 제외
        .map((field, index) => {
          const converted = {
            id: parseInt(field.id?.replace(/\D/g, '') || index.toString()), // ID에서 숫자만 추출
            fieldKey: field.id,
            label: field.label,
            fieldType: field.type === 'table' ? 'table' : field.type === 'editor_signature' ? 'editor_signature' : 'text',
            x: field.x,
            y: field.y,
            width: field.width,
            height: field.height,
            required: field.required || false,
            page: field.page || 1, // 페이지 정보 추가
            type: field.type || 'field',
        fontSize: field.fontSize || 18, // 기본 폰트 크기를 18px로 설정
            fontFamily: field.fontFamily || 'Arial', // 폰트 패밀리 추가
            tableData: field.tableData
          };

          
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

    try {
      
      // 문서 데이터에서 필드 값 추출 (coordinateFields 사용)
      let fieldValues: any[] = [];
      
      if (currentDocument?.data?.coordinateFields) {
        fieldValues = currentDocument.data.coordinateFields;
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
          type: (
            templateField.fieldType?.toLowerCase() === 'date' ? 'date' :
            templateField.fieldType === 'editor_signature' ? 'editor_signature' :
            'text'
          ) as 'text' | 'date' | 'editor_signature',
          value: value,
          required: templateField.required || false,
        fontSize: templateField.fontSize || 18, // 기본 폰트 크기를 18px로 설정
          fontFamily: templateField.fontFamily || 'Arial',
          page: templateField.page || 1, // 템플릿 필드의 실제 page 정보 사용
          // 테이블 정보 보존
          ...(templateField.fieldType === 'table' && templateField.tableData && {
            tableData: templateField.tableData
          })
        };
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
          type: (
            templateField.fieldType?.toLowerCase() === 'date' ? 'date' :
            templateField.fieldType === 'editor_signature' ? 'editor_signature' :
            'text'
          ) as 'text' | 'date' | 'editor_signature',
          value: defaultValue,
          required: templateField.required || false,
        fontSize: templateField.fontSize || 18, // 기본 폰트 크기를 18px로 설정
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

  // 외부 문서 데이터 불러오기 핸들러
  const handleLoadExternalData = useCallback((loadedFields: any[]) => {
    // 현재 데이터를 원본으로 저장 (처음 불러올 때만)
    if (!originalFieldData) {
      setOriginalFieldData([...coordinateFields]);
    }
    
    // 불러온 데이터를 현재 필드에 적용
    setCoordinateFields(prevFields => {
      return prevFields.map(field => {
        // 서명 관련 필드는 건드리지 않음
        if (field.type === 'editor_signature') {
          return field;
        }
        
        // 불러온 데이터에서 해당 필드 찾기 (ID 또는 label 기준)
        const loadedField = loadedFields.find((lf: any) => 
          lf.id === field.id || lf.label === field.label
        );
        
        if (loadedField && loadedField.value) {
          return {
            ...field,
            value: loadedField.value
          };
        }
        
        return field;
      });
    });
    
    setHasLoadedExternalData(true);
  }, [coordinateFields, originalFieldData]);

  // 불러온 문서 데이터 지우기 핸들러
  const handleClearLoadedData = useCallback(() => {
    if (!originalFieldData) {
      alert('불러온 데이터가 없습니다.');
      return;
    }
    
    if (window.confirm('불러온 문서 내용을 모두 지우고 원래 상태로 복구하시겠습니까?')) {
      setCoordinateFields(originalFieldData);
      setOriginalFieldData(null);
      setHasLoadedExternalData(false);
    }
  }, [originalFieldData]);

  // 초기 데이터 로드
  useEffect(() => {
    if (id) {
      
      // 상태 초기화 - 문서 변경 시 이전 상태 완전히 초기화
      setTemplateFields([]);
      // coordinateFields는 필드 구조 유지, 값만 초기화
      setCoordinateFields(prev => prev.map(field => ({ ...field, value: '' })));
      // 불러온 데이터 상태 초기화
      setOriginalFieldData(null);
      setHasLoadedExternalData(false);
      
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 권한 확인 - 문서 상태에 따른 접근 제한
  useEffect(() => {
    const checkPermissionAndStartEditing = async () => {
      if (currentDocument && user && id) {
        // currentDocument.id와 URL의 id가 일치하는지 확인 (잘못된 캐시 방지)
        if (currentDocument.id !== parseInt(id)) {
          console.log('⚠️ DocumentEditor: Document ID mismatch, waiting for correct document...', {
            currentDocId: currentDocument.id,
            urlId: parseInt(id)
          });
          return; // 올바른 문서가 로드될 때까지 대기
        }
        
        const status = currentDocument.status;
        const isRejected = currentDocument.isRejected;

        // 반려된 문서는 상태와 관계없이 편집 가능
        if (!isRejected) {
          // 문서 상태별 접근 제한 (반려되지 않은 경우만)
          if (status === 'REVIEWING') {
            // 검토 중일 때는 작성자 접근 불가
            alert('현재 문서는 검토 중입니다. 검토가 완료될 때까지 편집할 수 없습니다.');
            navigate('/documents');
            return;
          }

          if (status === 'SIGNING') {
            // 서명 중일 때는 작성자 접근 불가
            alert('현재 문서는 서명 중입니다. 서명이 완료될 때까지 편집할 수 없습니다.');
            navigate('/documents');
            return;
          }

          if (status === 'COMPLETED') {
            // 완료된 문서는 편집 불가
            alert('이미 완료된 문서입니다. 편집할 수 없습니다.');
            navigate('/documents');
            return;
          }

          if (status === 'READY_FOR_REVIEW') {
            // 서명자 지정 단계에서는 편집 불가
            alert('현재 문서는 서명자 지정 단계입니다. 편집할 수 없습니다.');
            navigate('/documents');
            return;
          }
        }

        // 작성자 권한 확인
        if (!isEditor) {
          alert('이 문서를 편집할 권한이 없습니다.');
          navigate('/documents');
          return;
        }

        // 작성자인 경우, 문서가 DRAFT 상태라면 편집 시작
        if (status === 'DRAFT' && isEditor) {
          try {
            await axios.post(`/api/documents/${currentDocument.id}/start-editing`);
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
  }, [currentDocument, user, navigate, id, getDocument, isEditor]);

  // 문서가 변경될 때마다 상태 완전 초기화
  useEffect(() => {
    return () => {
      setTemplateFields([]);
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

  // 엔터키로 다음 필드 이동 핸들러
  const handleFieldKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>, currentFieldId: string) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      // 현재 필드의 인덱스 찾기
      const currentIndex = coordinateFields.findIndex(field => field.id === currentFieldId);

      if (currentIndex !== -1) {
        // 다음 입력 가능한 필드 찾기 (테이블이나 서명 필드가 아닌 일반 입력 필드)
        let nextIndex = currentIndex + 1;
        let nextField = null;

        while (nextIndex < coordinateFields.length) {
          const field = coordinateFields[nextIndex];
          // 일반 텍스트나 날짜 필드만 포커스 이동 대상
          if (field.type !== 'editor_signature' && !field.tableData &&
              (!field.value || !field.value.includes('rows'))) {
            nextField = field;
            break;
          }
          nextIndex++;
        }

        if (nextField) {
          // 다음 필드로 포커스 이동
          setTimeout(() => {
            const nextInput = document.querySelector(`input[data-field-id="${nextField.id}"]`) as HTMLInputElement;
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
            }
          }, 0);
        } else {
          // 마지막 필드인 경우 첫 번째 필드로 이동
          const firstField = coordinateFields.find(field =>
            field.type !== 'editor_signature' && !field.tableData &&
            (!field.value || !field.value.includes('rows'))
          );

          if (firstField) {
            setTimeout(() => {
              const firstInput = document.querySelector(`input[data-field-id="${firstField.id}"]`) as HTMLInputElement;
              if (firstInput) {
                firstInput.focus();
                firstInput.select();
              }
            }, 0);
          }
        }
      }
    }
  }, [coordinateFields]);

  // 테이블 셀에서 Enter 키 핸들링 (다음 필드로 이동)
  const handleTableCellKeyDown = useCallback((
    fieldId: string,
    tableInfo: { rows: number; cols: number },
    rowIndex: number,
    colIndex: number,
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === 'Enter') {
      event.preventDefault();

      // 현재 테이블 필드의 인덱스 찾기
      const currentFieldIndex = coordinateFields.findIndex(field => field.id === fieldId);

      if (currentFieldIndex !== -1) {
        // 다음 입력 가능한 필드 찾기 (테이블이나 서명 필드가 아닌 일반 입력 필드)
        let nextIndex = currentFieldIndex + 1;
        let nextField = null;

        while (nextIndex < coordinateFields.length) {
          const field = coordinateFields[nextIndex];
          // 일반 텍스트나 날짜 필드만 포커스 이동 대상
          if (field.type !== 'editor_signature' && !field.tableData &&
              (!field.value || !field.value.includes('rows'))) {
            nextField = field;
            break;
          }
          nextIndex++;
        }

        if (nextField) {
          // 다음 필드로 포커스 이동
          setTimeout(() => {
            const nextInput = document.querySelector(`input[data-field-id="${nextField.id}"]`) as HTMLInputElement;
            if (nextInput) {
              nextInput.focus();
              nextInput.select();
            }
          }, 0);
        } else {
          // 마지막 필드인 경우 첫 번째 필드로 이동
          const firstField = coordinateFields.find(field =>
            field.type !== 'editor_signature' && !field.tableData &&
            (!field.value || !field.value.includes('rows'))
          );

          if (firstField) {
            setTimeout(() => {
              const firstInput = document.querySelector(`input[data-field-id="${firstField.id}"]`) as HTMLInputElement;
              if (firstInput) {
                firstInput.focus();
                firstInput.select();
              }
            }, 0);
          }
        }
      }
    }
  }, [coordinateFields]);

  // 키보드 단축키 (Ctrl+S / Cmd+S로 저장, 좌우 화살표로 페이지 이동)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 입력 필드에 포커스가 있으면 단축키 무시
      const target = event.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true';

      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleManualSave();
      }

      // 페이지 네비게이션 단축키 (입력 필드에 포커스가 없을 때만)
      if (!isInputFocused && totalPages > 1) {
        if (event.key === 'ArrowLeft' && currentPageNumber > 1) {
          event.preventDefault();
          setCurrentPageNumber(prev => Math.max(1, prev - 1));
        } else if (event.key === 'ArrowRight' && currentPageNumber < totalPages) {
          event.preventDefault();
          setCurrentPageNumber(prev => Math.min(totalPages, prev + 1));
        } else if (event.key === 'Home') {
          event.preventDefault();
          setCurrentPageNumber(1);
        } else if (event.key === 'End') {
          event.preventDefault();
          setCurrentPageNumber(totalPages);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleManualSave, totalPages, currentPageNumber]);

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
    if (pdfPages.length === 0) return null;

    const currentPageUrl = pdfPages[currentPageNumber - 1];
    if (!currentPageUrl) {
      console.warn(`페이지 ${currentPageNumber}의 이미지 URL이 없습니다. 사용 가능한 페이지: ${pdfPages.length}`);
      return (
        <div className="flex items-center justify-center h-full">
          <p className="text-gray-500">페이지 {currentPageNumber}의 이미지를 찾을 수 없습니다.</p>
        </div>
      );
    }

    return (
      <div
        ref={pdfContainerRef}
        className="relative bg-gray-100 h-full overflow-auto flex flex-col p-4"
      >
        {/* 스케일 정보 표시 */}
        {scale !== 1 && (
          <div className="text-center mb-2">
            <p className="text-xs text-blue-600">
              화면에 맞춰 {Math.round(scale * 100)}%로 {scale < 1 ? '축소' : '확대'}됨
            </p>
          </div>
        )}

        {/* PDF 컨테이너 - 반응형 크기 */}
        <div className="flex justify-center items-start">
          <div
            className="relative bg-white shadow-lg border rounded-lg overflow-hidden"
            style={{
              width: PDF_WIDTH * scale,
              height: PDF_HEIGHT * scale,
              minWidth: PDF_WIDTH * scale,
              minHeight: PDF_HEIGHT * scale,
              flexShrink: 0
            }}
          >
            {/* PDF 배경 이미지 */}
            <img
              src={currentPageUrl}
              alt={`PDF Document Page ${currentPageNumber}`}
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
              draggable={false}
              onError={() => {
                console.error('PDF 이미지 로드 실패:', currentPageUrl);
              }}
            />

            {/* 필드 컨테이너 - 현재 페이지의 필드만 표시 */}
            <div className="absolute inset-0">
              {/* 필드 오버레이 - 현재 페이지 필드만 필터링 */}
              {coordinateFields
                .filter(field => (field.page || 1) === currentPageNumber)
                .map((field) => {

                // 스케일링된 위치와 크기 계산
                const leftPercent = field.x * scale;
                const topPercent = field.y * scale;
                const widthPercent = field.width * scale;
                const heightPercent = field.height * scale;

              // 필드 타입 확인
              let isTableField = false;
              let isEditorSignature = false;
              let tableInfo = null;

              // 작성자 서명 필드 확인
              if (field.type === 'editor_signature') {
                isEditorSignature = true;
              }

              // 테이블 필드 확인
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

              return (
                <div
                  key={field.id}
                  className={`absolute border-2 bg-opacity-30 hover:bg-opacity-50 transition-colors flex flex-col justify-center cursor-pointer ${
                    isEditorSignature ? 'bg-green-100 border-green-500' :
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
                  {isEditorSignature ? (
                    // 작성자 서명 필드 렌더링
                    <div className="w-full h-full flex flex-col">
                      {!field.value && (
                        <div
                          className="font-medium text-green-700 truncate px-2 py-1"
                          style={{
                            fontSize: `${12 * scale}px`
                          }}
                        >
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </div>
                      )}
                      {field.value && (
                        <div className="w-full h-full flex items-center justify-center p-1">
                          {field.value.startsWith('data:image') ? (
                            <img
                              src={field.value}
                              alt="작성자 서명"
                              className="w-full h-full object-contain"
                              style={{
                                maxWidth: '100%',
                                maxHeight: '100%'
                              }}
                            />
                          ) : (
                            <div
                              className="text-gray-600"
                              style={{
                                fontSize: `${12 * scale}px`
                              }}
                            >
                              서명됨: {new Date().toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isTableField && tableInfo ? (
                    // 테이블 렌더링
                    <div className="w-full h-full p-1 flex flex-col">
                      <div
                        className="font-medium mb-1 text-purple-700 truncate"
                        style={{
                          fontSize: `${16 * scale}px`
                        }}
                      >
                        {field.label} ({tableInfo.rows}×{tableInfo.cols})
                      </div>
                      
                      {/* 열 헤더 행 */}
                      {tableInfo.columnHeaders && tableInfo.columnHeaders.some((h: string) => h) && (
                        <div
                          className="flex bg-purple-200 border-b border-purple-400"
                          style={{
                            minHeight: `${20 * scale}px`
                          }}
                        >
                          {Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                            const headerText = tableInfo.columnHeaders?.[colIndex] || '';
                            return (
                              <div
                                key={`header-${colIndex}`}
                                className="flex items-center justify-center text-purple-800 font-semibold border-r border-purple-300 last:border-r-0 px-1"
                                style={{
                                  width: tableInfo.columnWidths
                                    ? `${tableInfo.columnWidths[colIndex] * 100}%`
                                    : `${100 / tableInfo.cols}%`,
                                  fontSize: `${(field.fontSize || 14) * scale * 0.85}px`,
                                  fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`
                                }}
                                title={headerText}
                              >
                                <span className="truncate">{headerText || (colIndex + 1)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      
                      {/* 데이터 셀 */}
                      <div
                        className="grid gap-px bg-purple-300 flex-1"
                        style={{
                          gridTemplateColumns: tableInfo.columnWidths
                            ? tableInfo.columnWidths.map((width: number) => `${width * 100}%`).join(' ')
                            : `repeat(${tableInfo.cols}, 1fr)`
                        }}
                      >
                        {Array(tableInfo.rows).fill(null).map((_, rowIndex) =>
                          Array(tableInfo.cols).fill(null).map((_, colIndex) => {
                            let cellText = '';

                            try {
                              // 1. 먼저 coordinateFields에서 현재 편집 중인 데이터 확인
                              const currentField = coordinateFields.find(f => f.id === field.id);
                              if (currentField && currentField.value) {
                                try {
                                  const currentTableData = JSON.parse(currentField.value);
                                  if (currentTableData.cells &&
                                      Array.isArray(currentTableData.cells) &&
                                      currentTableData.cells[rowIndex] &&
                                      Array.isArray(currentTableData.cells[rowIndex])) {
                                    cellText = currentTableData.cells[rowIndex][colIndex] || '';
                                  }
                                } catch (parseError) {
                                  // JSON 파싱 실패
                                }
                              }

                              // 2. coordinateFields에 없으면 field.value 확인
                              if (!cellText && field.value) {
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

                              // 3. 그래도 없으면 템플릿 기본값 확인
                              if (!cellText && field.tableData && field.tableData.cells) {
                                cellText = field.tableData.cells[rowIndex]?.[colIndex] || '';
                              }

                            } catch (error) {
                              cellText = '';
                              // 표 셀 데이터 로드 오류
                            }

                            return (
                              <div
                                key={`${rowIndex}-${colIndex}`}
                                className="bg-white bg-opacity-70 border border-purple-200 hover:bg-opacity-90 cursor-pointer flex items-center justify-center p-1 transition-colors"
                                style={{
                                  minHeight: `${20 * scale}px`,
                                  fontSize: `${(field.fontSize || 16) * scale}px !important`,
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
                                    fontSize: `${(field.fontSize || 16) * scale}px !important`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                                    fontWeight: '500 !important',
                                    color: cellText ? '#6b21a8 !important' : '#9CA3AF !important'
                                  }}
                                >
                                  {cellText || ''}
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
                        fontSize: `${(field.fontSize || 16) * scale}px !important`,
                        fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif !important`,
                        fontWeight: '500 !important'
                      }}
                    >
                      {field.value}
                    </div>
                  ) : (
                    // 일반 필드 - 값이 없는 경우 (제목만 표시, 고정 스타일)
                    <div
                      className="text-blue-700 font-medium p-1 truncate text-center"
                      style={{
                        fontSize: `${16 * scale}px`
                      }}
                    >
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
      </div>
    );
  }, [pdfPages, currentPageNumber, totalPages, coordinateFields, templateFields, scale, PDF_WIDTH, PDF_HEIGHT]);

  if (loading) {
    return <div className="flex items-center justify-center h-64">문서를 불러오는 중...</div>;
  }

  if (!currentDocument) {
    return <div className="flex items-center justify-center h-64">문서를 찾을 수 없습니다.</div>;
  }

  // 문서 상태별 접근 제한 (렌더링 전 체크)
  const status = currentDocument.status;
  if (status === 'REVIEWING' || status === 'SIGNING' || status === 'COMPLETED' || status === 'READY_FOR_REVIEW') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">편집 불가</h3>
              <p className="text-yellow-700 mb-4">
                {status === 'REVIEWING' && '현재 문서는 검토 중입니다. 검토가 완료될 때까지 편집할 수 없습니다.'}
                {status === 'SIGNING' && '현재 문서는 서명 중입니다. 서명이 완료될 때까지 편집할 수 없습니다.'}
                {status === 'COMPLETED' && '이미 완료된 문서입니다. 편집할 수 없습니다.'}
                {status === 'READY_FOR_REVIEW' && '현재 문서는 서명자 지정 단계입니다. 편집할 수 없습니다.'}
              </p>
              <button
                onClick={() => navigate('/documents')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                문서 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 작성자 권한 확인 (렌더링 전 체크)
  if (!isEditor) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-600 text-2xl mr-3">🚫</div>
            <div>
              <h3 className="font-bold text-red-800 mb-2">접근 권한 없음</h3>
              <p className="text-red-700 mb-4">이 문서를 편집할 권한이 없습니다.</p>
              <button
                onClick={() => navigate('/documents')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                문서 목록으로 돌아가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
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
      {/* 액션 바 - Layout 헤더 아래 고정 위치 */}
      <div className="fixed top-[88px] left-0 right-0 z-40 bg-white border-b px-6 py-4 flex justify-between items-center w-full shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{currentDocument.title || '문서 편집'}</h1>
            <StatusBadge
              status={currentDocument.status || DOCUMENT_STATUS.EDITING}
              size="md"
              isRejected={currentDocument.isRejected}
              rejectComment={
                currentDocument.statusLogs && (currentDocument.status === 'REJECTED' || currentDocument.isRejected)
                  ? currentDocument.statusLogs
                      .filter(log => 
                        // rejectLog가 true인 로그를 우선적으로 찾고, 없으면 REJECTED 상태의 로그를 찾음
                        log.rejectLog === true || log.status === 'REJECTED'
                      )
                      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]?.comment
                  : undefined
              }
            />
          </div>
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
                작성완료
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
            onClick={() => navigate(-1)}
            className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            돌아가기
          </button>
        </div>
      </div>

      {/* 메인 컨텐츠 - Layout 헤더 + 액션 바 아래 고정 레이아웃 */}
      <div className="fixed top-[160px] left-0 right-0 bottom-0 flex w-full no-print">
        {/* 왼쪽 패널 - PDF 뷰어 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex flex-col">

          {/* PDF 뷰어 컨테이너 */}
          <div className="flex-1 overflow-hidden">
            {renderPdfViewer || (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">PDF 파일이 없습니다.</p>
              </div>
            )}
          </div>
        </div>
        
        {/* 인쇄 전용 컨테이너 (화면에서는 숨김) */}
        <div className="hidden print-only print-container">
          {(currentDocument?.template?.pdfImagePaths || currentDocument?.template?.pdfImagePath) && (
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
                const responsiveFontSize = getResponsiveFontSize(field.fontSize, {
                  height: field.height,
                });
                const placeholderFontSize = Math.max(8, responsiveFontSize * 0.75);

                // 필드 타입 확인
                let isTableField = false;
                let isEditorSignature = false;
                let tableInfo = null;
                let tableData = null;

                // 작성자 서명 필드 확인
                if (field.type === 'editor_signature') {
                  isEditorSignature = true;
                }
                
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
                      fontSize: `${responsiveFontSize}px`,
                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                    }}
                  >
                    {isEditorSignature ? (
                      // 작성자 서명 필드 인쇄
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: `${getResponsiveFontSize(field.fontSize ?? 16, {
                          height: field.height,
                        })}px`,
                        fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                        fontWeight: '600',
                        color: 'black',
                        border: '1px solid #ccc',
                        padding: '2px'
                      }}>
                        {!field.value && (
                          <div style={{ fontSize: `${placeholderFontSize}px`, marginBottom: '2px' }}>
                            {field.label}
                          </div>
                        )}
                        {field.value ? (
                          field.value.startsWith('data:image') ? (
                            <img
                              src={field.value}
                              alt="작성자 서명"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                maxWidth: '100%',
                                maxHeight: '100%'
                              }}
                            />
                          ) : (
                            <div style={{ fontSize: `${Math.max(8, placeholderFontSize)}px`, textAlign: 'center' }}>
                              서명됨: {new Date().toLocaleDateString()}
                            </div>
                          )
                        ) : (
                          <div style={{ fontSize: `${Math.max(8, placeholderFontSize)}px`, color: '#666' }}>
                            미서명
                          </div>
                        )}
                      </div>
                    ) : isTableField && tableData ? (
                      // 테이블 인쇄
                      <table className="print-table" style={{ width: '100%', height: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                          {Array(tableInfo!.rows).fill(null).map((_, rowIndex) => (
                            <tr key={rowIndex}>
                              {Array(tableInfo!.cols).fill(null).map((_, colIndex) => {
                                const cellContent = tableData.cells?.[rowIndex]?.[colIndex] || '';
                                const cellFontSize = getResponsiveFontSizeForTableCell(field.fontSize, {
                                  totalHeight: field.height,
                                  rowCount: tableInfo!.rows,
                                });
                                return (
                                  <td
                                    key={colIndex}
                                    style={{
                                      width: tableInfo!.columnWidths ? `${tableInfo!.columnWidths[colIndex] * 100}%` : `${100 / tableInfo!.cols}%`,
                                      fontSize: `${cellFontSize}px`,
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
                        fontSize: `${responsiveFontSize}px`,
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

        {/* 오른쪽 패널 - 필드 목록 (리사이저블 너비) */}
        <div
          className="bg-white border-l flex-shrink-0 h-full no-print relative flex flex-col"
          style={{ width: `${rightPanelWidth}px` }}
        >
          {/* 리사이저 핸들 */}
          <div
            className={`absolute left-0 top-0 w-2.5 h-full cursor-col-resize hover:bg-blue-500 transition-colors ${
              isResizing ? 'bg-blue-500' : 'bg-gray-300'
            }`}
            onMouseDown={handleMouseDown}
            style={{
              transform: 'translateX(-50%)',
              zIndex: 10
            }}
          >
            <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1 h-8 bg-gray-400 rounded-full opacity-60" />
          </div>

          {/* 고정 헤더 */}
          <div className="p-4 border-b bg-gray-50 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-gray-900">문서 필드</h2>
              <div className="flex items-center gap-2">
                {/* 문서 내용 불러오기/지우기 버튼 */}
                <button
                  onClick={() => setShowLoadDataModal(true)}
                  className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                  title="이전 문서에서 내용 불러오기"
                >
                  내용 불러오기
                </button>
                {hasLoadedExternalData && (
                  <button
                    onClick={handleClearLoadedData}
                    className="px-2 py-1 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 transition-colors"
                    title="불러온 내용 지우기"
                  >
                    내용 지우기
                  </button>
                )}
              </div>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 bg-white px-3 py-1.5 rounded-lg border shadow-sm mb-3">
                <button
                  onClick={() => setCurrentPageNumber(prev => Math.max(1, prev - 1))}
                  disabled={currentPageNumber <= 1}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="이전 페이지 (←)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                  {currentPageNumber} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPageNumber(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPageNumber >= totalPages}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="다음 페이지 (→)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">
                {coordinateFields.filter(field => ((field as any).page || 1) === currentPageNumber).length}개 필드
              </p>
              {totalPages > 1 && (
                <p className="text-xs text-gray-400">
                  키보드: ← → 로 페이지 이동
                </p>
              )}
            </div>
          </div>

          {/* 스크롤 가능한 필드 목록 */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-4">
            {coordinateFields
              .filter(field => (field.page || 1) === currentPageNumber)
              .sort((a, b) => {
                // 필수 필드를 상단으로 정렬
                if (a.required && !b.required) return -1;
                if (!a.required && b.required) return 1;
                return 0;
              })
              .map((field) => {
              // 필드 타입 확인
              let isTableField = false;
              let isEditorSignature = false;
              let tableInfo = null;
              let tableData = null;

              // 작성자 서명 필드 확인
              if (field.type === 'editor_signature') {
                isEditorSignature = true;
              }
              
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
              }

              return (
                <div key={field.id} className="border rounded-lg p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                    {isTableField && <span className="text-purple-600 text-xs ml-1">(표)</span>}
                    {isEditorSignature && <span className="text-green-600 text-xs ml-1">(작성자 서명)</span>}
                  </label>

                  {isEditorSignature ? (
                    // 작성자 서명 필드 UI
                    <div className="space-y-3">
                      {isEditor ? (
                        // 작성자인 경우 - 서명 가능
                        <div>
                          {field.value ? (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm text-green-700 font-medium">서명 완료</p>
                                  <p className="text-xs text-green-600 mt-1">
                                    서명일: {new Date().toLocaleString()}
                                  </p>
                                  {/* 서명 이미지 미리보기 */}
                                  {field.value.startsWith('data:image') && (
                                    <div className="mt-2">
                                      <img
                                        src={field.value}
                                        alt="서명 미리보기"
                                        className="max-w-full h-12 border border-transparent rounded bg-transparent"
                                      />
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => {
                                    handleCoordinateFieldChange(field.id, '');
                                  }}
                                  className="text-xs text-red-500 hover:text-red-700 underline"
                                >
                                  서명 취소
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleEditorSignature(field.id)}
                              className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                            >
                              서명하기
                            </button>
                          )}
                        </div>
                      ) : (
                        // 작성자가 아닌 경우 - 서명 불가
                        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                          <p className="text-sm text-gray-600">
                            작성자만 서명할 수 있습니다
                          </p>
                          {field.value && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500">
                                서명됨: {new Date().toLocaleString()}
                              </p>
                              {/* 서명 이미지 미리보기 */}
                              {field.value.startsWith('data:image') && (
                                <div className="mt-2">
                                  <img
                                    src={field.value}
                                    alt="서명 미리보기"
                                    className="max-w-full h-12 border border-transparent rounded bg-transparent"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : isTableField && tableInfo ? (
                    // 테이블 편집 UI
                    <TableEditComponent
                      tableInfo={tableInfo}
                      tableData={tableData}
                      fieldId={field.id}
                      onBulkInput={() => handleTableBulkInputOpen(field.id)}
                      onCellKeyDown={(rowIndex, colIndex, event) => handleTableCellKeyDown(field.id, tableInfo, rowIndex, colIndex, event)}
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
                      onKeyDown={(e) => handleFieldKeyDown(e, field.id)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  ) : (
                    <input
                      type="text"
                      value={field.value || ''}
                      data-field-id={field.id}
                      onChange={(e) => handleCoordinateFieldChange(field.id, e.target.value)}
                      onKeyDown={(e) => handleFieldKeyDown(e, field.id)}
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
          pdfImageUrls={pdfPages}
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
                문서 작성을 완료하시겠습니까?
              </p>
              <p className="text-sm text-amber-600">
                ⚠️ 작성 완료 후에는 문서를 수정할 수 없으며, 서명자 지정 단계로 이동합니다.
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

      {/* 작성자 서명 모달 */}
      <SignatureModal
        isOpen={showEditorSignatureModal}
        onClose={handleSignatureModalClose}
        onSave={handleSignatureSave}
        reviewerName={user?.name || '작성자'}
      />

      {/* 테이블 벌크 입력 모달 */}
      {currentTableInfo && (
        <TableBulkInput
          isOpen={showTableBulkInput}
          onClose={handleTableBulkInputClose}
          onApply={handleTableBulkInputApply}
          tableInfo={currentTableInfo}
          fieldLabel={currentTableLabel}
          existingData={currentTableData}
          columnHeaders={currentTableColumnHeaders}
          columnWidths={currentTableColumnWidths}
        />
      )}

      {/* 문서 데이터 불러오기 모달 */}
      {currentDocument && (
        <LoadDocumentDataModal
          isOpen={showLoadDataModal}
          onClose={() => setShowLoadDataModal(false)}
          templateId={currentDocument.templateId}
          currentDocumentId={currentDocument.id}
          onLoadData={handleLoadExternalData}
        />
      )}

    </div>
    </>
  );
};

export default DocumentEditor;
