import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { TemplateField } from '../types/field';
import { API_BASE_URL } from '../config/api';
import { logger } from '../utils/logger';
import { runCoordinateTests } from '../utils/coordinateDebugger';
import NewFieldModal from '../components/modals/NewFieldModal';
import FieldEditModal from '../components/modals/FieldEditModal';
import TableCellEditModal from '../components/modals/TableCellEditModal';


const TemplateUploadPdf: React.FC = () => {
  const navigate = useNavigate();
  const { id: templateId } = useParams<{ id: string }>();
  const isEditMode = !!templateId;
  
  // 기본 업로드 상태
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // PDF 미리보기 및 필드 관리
  const [pdfImageUrl, setPdfImageUrl] = useState<string | null>(null);
  const [pdfImageDataUrl, setPdfImageDataUrl] = useState<string | null>(null); // 변환된 이미지 데이터
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [selectedField, setSelectedField] = useState<TemplateField | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState(false);
  const [newFieldPosition, setNewFieldPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [step, setStep] = useState<'upload' | 'edit'>('upload');

  // 테이블 셀 편집 상태
  const [isTableCellEditOpen, setIsTableCellEditOpen] = useState(false);
  const [editingCell, setEditingCell] = useState<{
    fieldId: string;
    row: number;
    col: number;
  } | null>(null);

  // 필드 드래그 앤 드롭 상태
  const [draggingField, setDraggingField] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  
  // 전역 폰트 설정 상태
  const [defaultFontSize, setDefaultFontSize] = useState<number>(12);
  const [defaultFontFamily, setDefaultFontFamily] = useState<string>('Arial');

  // 사용 가능한 폰트 목록
  const availableFonts = [
    'Arial',
    'Times New Roman', 
    'Helvetica',
    'Georgia',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Courier New',
    'Impact',
    'Comic Sans MS'
  ];
  const [resizingField, setResizingField] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preventClick, setPreventClick] = useState(false);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

  // 테이블 컬럼 너비 조절 상태
  const [resizingColumn, setResizingColumn] = useState<{
    fieldId: string;
    columnIndex: number;
    startX: number;
    startWidths: number[];
  } | null>(null);

  // 새 필드 생성을 위한 드래그 영역 선택 상태
  const [isCreatingField, setIsCreatingField] = useState(false);
  const [creationStart, setCreationStart] = useState<{ x: number; y: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    setSelectedFile(file);
    setError(null);
    
    // 파일명에서 템플릿 이름 자동 설정
    if (!templateName) {
      const nameWithoutExtension = file.name.replace(/\.pdf$/i, '');
      setTemplateName(nameWithoutExtension);
    }

    // 편집 단계로 이동
    setStep('edit');
    
    // 좌표 변환 시스템 테스트 실행
    setTimeout(() => {
      runCoordinateTests();
    }, 500);
    
    try {
      // PDF를 FormData로 백엔드에 전송하여 이미지로 변환
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await axios.post('/api/pdf/convert-to-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob'
      });
      
      // 변환된 이미지를 URL로 생성
      const imageBlob = new Blob([response.data], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(imageBlob);
      setPdfImageDataUrl(imageUrl);
      
      console.log('📐 PDF 이미지 변환 완료:', { imageUrl });
    } catch (error) {
      console.error('PDF 이미지 변환 실패:', error);
      // 실패 시 기존 방식 사용
      const objectUrl = URL.createObjectURL(file);
      setPdfImageUrl(objectUrl);
    }
  };

  const handlePdfClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'edit') return;
    
    // preventClick이 true이거나 드래그 관련 상태가 있으면 완전히 차단
    if (preventClick || draggingField || resizingField || isDragging) {
      event.stopPropagation();
      event.preventDefault();
      return;
    }
    
    // 새 필드 생성 드래그가 끝났을 때만 모달 열기
    if (isCreatingField && selectionBox) {
      const { x, y, width, height } = selectionBox;
      
      logger.debug('📦 Selection completed:', {
        selectionBox,
        size: `${width} × ${height}`,
        position: `(${x}, ${y})`
      });
      
      // 최소 크기 체크 (10x10 픽셀 이상)
      if (width >= 10 && height >= 10) {
        setNewFieldPosition({ x, y });
        setIsNewFieldModalOpen(true);
        // 드래그 상태만 초기화하고 selectionBox는 모달에서 사용하므로 유지
        setIsCreatingField(false);
        setCreationStart(null);
      } else {
        logger.debug('❌ Selection too small, canceling');
        // 너무 작으면 모든 상태 초기화
        setIsCreatingField(false);
        setCreationStart(null);
        setSelectionBox(null);
      }
    }
  };

  // PDF 마우스 다운 핸들러 (새 필드 생성 드래그 시작)
  const handlePdfMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (step !== 'edit') return;
    
    // 기존 필드나 드래그 상태가 있으면 차단
    if (draggingField || resizingField || resizingColumn || isDragging) {
      return;
    }
    
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 새 필드 생성 드래그 시작
    setIsCreatingField(true);
    setCreationStart({ x: Math.round(x), y: Math.round(y) });
    setSelectionBox(null);
  };

  const handleNewFieldSave = (field: TemplateField) => {
    // 디버깅: 필드 생성 정보 출력
    console.log('🔧 New field created:', {
      field,
      selectionBox,
      message: selectionBox ? 'Using selection box size' : 'Using default size'
    });
    
    // 새 필드 추가
    setFields(prev => [...prev, field]);
    
    // 선택 영역 초기화
    setSelectionBox(null);
  };

  const handleFieldEdit = (field: TemplateField) => {
    // 기존 필드 업데이트
    setFields(prev => {
      const existingIndex = prev.findIndex(f => f.id === field.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = field;
        return updated;
      }
      return prev;
    });
  };

  const handleFieldDelete = () => {
    if (selectedField) {
      setFields(prev => prev.filter(f => f.id !== selectedField.id));
    }
  };

  // 테이블 셀 편집 핸들러
  const handleTableCellClick = (fieldId: string, row: number, col: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    // 드래그 중이거나 preventClick 상태면 편집 안함
    if (preventClick || isDragging) {
      return;
    }
    
    setEditingCell({ fieldId, row, col });
    setIsTableCellEditOpen(true);
  };

  const handleTableCellSave = (text: string) => {
    if (!editingCell) return;
    
    setFields(prev => prev.map(field => {
      if (field.id === editingCell.fieldId && field.type === 'table' && field.tableData) {
        const newCells = [...field.tableData.cells];
        newCells[editingCell.row][editingCell.col] = text;
        
        return {
          ...field,
          tableData: {
            ...field.tableData,
            cells: newCells
          }
        };
      }
      return field;
    }));
  };

  // 필드 클릭 처리 (편집 모달 열기)
  const handleFieldClick = (field: TemplateField, event: React.MouseEvent) => {
    event.stopPropagation(); // 이벤트 전파 방지
    event.preventDefault();
    
    // 드래그 중이거나 preventClick 상태면 모달 열지 않음
    if (preventClick || isDragging) {
      return;
    }
    
    setSelectedField(field);
    setIsEditModalOpen(true);
  };

  // 필드 드래그 시작
  const handleFieldMouseDown = (field: TemplateField, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();

    // 마우스 다운 위치 저장
    setMouseDownPos({ x: event.clientX, y: event.clientY });
    
    setDraggingField(field.id);
    setDragStart({
      x: event.clientX - field.x,
      y: event.clientY - field.y
    });
    setIsDragging(false); // 드래그 시작 시점에는 false로 설정
    setPreventClick(false); // 초기에는 false로 설정
  };

  // 필드 리사이즈 시작
  const handleResizeMouseDown = (field: TemplateField, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    // 마우스 다운 위치 저장 (리사이즈용)
    setMouseDownPos({ x: event.clientX, y: event.clientY });
    
    setResizingField(field.id);
    setResizeStart({
      x: event.clientX,
      y: event.clientY,
      width: field.width,
      height: field.height
    });
    setPreventClick(false); // 초기에는 false로 설정
  };

  // 테이블 컬럼 너비 조절 시작
  const handleColumnResizeMouseDown = (field: TemplateField, columnIndex: number, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    if (!field.tableData?.columnWidths) return;
    
    setResizingColumn({
      fieldId: field.id,
      columnIndex,
      startX: event.clientX,
      startWidths: [...field.tableData.columnWidths]
    });
    setPreventClick(true); // 컬럼 리사이즈 중에는 클릭 방지
  };

  // 마우스 이동 처리
  const handleMouseMove = (event: React.MouseEvent) => {
    // 새 필드 생성 드래그 처리
    if (isCreatingField && creationStart) {
      const rect = event.currentTarget.getBoundingClientRect();
      const currentX = event.clientX - rect.left;
      const currentY = event.clientY - rect.top;
      
      // 선택 영역 계산
      const minX = Math.min(creationStart.x, currentX);
      const minY = Math.min(creationStart.y, currentY);
      const maxX = Math.max(creationStart.x, currentX);
      const maxY = Math.max(creationStart.y, currentY);
      
      setSelectionBox({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
      });
      
      return; // 새 필드 생성 중에는 다른 드래그 로직 실행 안함
    }

    if (draggingField && dragStart && mouseDownPos) {
      const newX = event.clientX - dragStart.x;
      const newY = event.clientY - dragStart.y;
      
      // 마우스가 5픽셀 이상 움직였으면 드래그로 인식
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );
      
      if (moveDistance > 5) {
        setIsDragging(true);
        setPreventClick(true);
      }
      
      setFields(prev => prev.map(field => 
        field.id === draggingField 
          ? { ...field, x: Math.max(0, newX), y: Math.max(0, newY) }
          : field
      ));
    }
    
    if (resizingField && resizeStart && mouseDownPos) {
      const deltaX = event.clientX - resizeStart.x;
      const deltaY = event.clientY - resizeStart.y;
      
      // 리사이즈도 마우스가 5픽셀 이상 움직였으면 드래그로 인식
      const moveDistance = Math.sqrt(
        Math.pow(event.clientX - mouseDownPos.x, 2) + 
        Math.pow(event.clientY - mouseDownPos.y, 2)
      );
      
      if (moveDistance > 5) {
        setIsDragging(true);
        setPreventClick(true);
      }
      
      setFields(prev => prev.map(field => 
        field.id === resizingField 
          ? { 
              ...field, 
              width: Math.max(50, resizeStart.width + deltaX),
              height: Math.max(20, resizeStart.height + deltaY)
            }
          : field
      ));
    }

    // 테이블 컬럼 너비 조절 처리
    if (resizingColumn) {
      const deltaX = event.clientX - resizingColumn.startX;
      const field = fields.find(f => f.id === resizingColumn.fieldId);
      
      if (field?.tableData?.columnWidths) {
        const containerWidth = field.width - 8; // 패딩 제외
        const pixelPerRatio = containerWidth;
        const deltaRatio = deltaX / pixelPerRatio;
        
        const newWidths = [...resizingColumn.startWidths];
        const currentCol = resizingColumn.columnIndex;
        const nextCol = currentCol + 1;
        
        // 현재 컬럼과 다음 컬럼 사이에서 너비 조절
        if (nextCol < newWidths.length) {
          const minWidth = 0.05; // 최소 5%
          const maxCurrentWidth = newWidths[currentCol] + newWidths[nextCol] - minWidth;
          const maxNextWidth = newWidths[currentCol] + newWidths[nextCol] - minWidth;
          
          newWidths[currentCol] = Math.max(minWidth, Math.min(maxCurrentWidth, newWidths[currentCol] + deltaRatio));
          newWidths[nextCol] = Math.max(minWidth, Math.min(maxNextWidth, newWidths[nextCol] - deltaRatio));
          
          setFields(prev => prev.map(f => 
            f.id === resizingColumn.fieldId && f.tableData
              ? { 
                  ...f, 
                  tableData: { 
                    ...f.tableData, 
                    columnWidths: newWidths 
                  } 
                }
              : f
          ));
        }
      }
    }
  };

  // 마우스 업 처리
  const handleMouseUp = (event?: React.MouseEvent) => {
    // 새 필드 생성 드래그가 끝났을 때
    if (isCreatingField && selectionBox) {
      const { width, height } = selectionBox;
      
      // 최소 크기 체크 (10x10 픽셀 이상)
      if (width >= 10 && height >= 10) {
        // 클릭 이벤트가 발생하도록 놔둠 (handlePdfClick에서 모달 열기)
      } else {
        // 너무 작으면 생성 취소
        setIsCreatingField(false);
        setCreationStart(null);
        setSelectionBox(null);
      }
      return;
    }
    
    // 드래그 또는 리사이즈 중이었다면 이벤트 차단
    if (draggingField || resizingField || resizingColumn) {
      if (event) {
        event.stopPropagation();
        event.preventDefault();
      }
    }
    
    // 상태 초기화
    setDraggingField(null);
    setDragStart(null);
    setResizingField(null);
    setResizeStart(null);
    setResizingColumn(null);
    setMouseDownPos(null);
    
    // 드래그가 있었다면 잠시 후 상태 초기화
    if (isDragging || preventClick) {
      setTimeout(() => {
        setIsDragging(false);
        setPreventClick(false);
      }, 300);
    } else {
      setIsDragging(false);
      setPreventClick(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !templateName.trim()) {
      setError('PDF 파일과 템플릿 이름을 입력해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('name', templateName.trim());
      if (description.trim()) {
        formData.append('description', description.trim());
      }
      
      // 전역 폰트 설정 추가
      formData.append('defaultFontSize', defaultFontSize.toString());
      formData.append('defaultFontFamily', defaultFontFamily);

      // coordinateFields를 JSON 문자열로 변환하여 전송 (픽셀값 그대로)
      if (fields.length > 0) {
        const coordinateFields = fields.map(field => {

          const baseField = {
            id: field.id,
            label: field.label,
            x: Math.round(field.x), // 정수로 전송
            y: Math.round(field.y), 
            width: Math.round(field.width),
            height: Math.round(field.height),
            page: field.page,
            required: field.required,
            type: field.type || 'field',
            fontSize: field.fontSize || 12,
            fontFamily: field.fontFamily || 'Arial'
          };

          // 테이블 데이터가 있으면 포함
          if (field.type === 'table' && field.tableData) {
            return {
              ...baseField,
              tableData: field.tableData
            };
          }

          return baseField;
        });

        formData.append('coordinateFields', JSON.stringify(coordinateFields));
      }

      const response = await axios.post(
        'http://localhost:8080/api/templates/upload-pdf',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      console.log('PDF 템플릿 업로드 성공:', response.data);
      // 성공 시 템플릿 목록으로 이동
      navigate('/templates');
    } catch (error: any) {
      console.error('PDF 템플릿 업로드 실패:', error);
      setError(error.response?.data?.error || 'PDF 템플릿 업로드에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const goBackToUpload = () => {
    setStep('upload');
    setFields([]);
    if (pdfImageUrl) {
      URL.revokeObjectURL(pdfImageUrl);
    }
    setPdfImageUrl(null);
  };

  // 템플릿 업데이트 함수
  const updateTemplate = async () => {
    console.log('🔄 템플릿 업데이트 시작:', {
      templateId,
      templateName: templateName.trim(),
      description: description.trim(),
      fieldsCount: fields.length
    });

    if (!templateName.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // coordinateFields를 JSON 문자열로 변환
      const coordinateFields = fields.map(field => {
        const baseField = {
          id: field.id,
          label: field.label,
          x: Math.round(field.x),
          y: Math.round(field.y), 
          width: Math.round(field.width),
          height: Math.round(field.height),
          page: field.page,
          required: field.required,
          type: field.type || 'field'
        };

        // 테이블 데이터가 있으면 포함
        if (field.type === 'table' && field.tableData) {
          return {
            ...baseField,
            tableData: field.tableData
          };
        }

        return baseField;
      });

      const updateData = {
        name: templateName.trim(),
        description: description.trim(),
        coordinateFields: JSON.stringify(coordinateFields),
        defaultFontSize: defaultFontSize,
        defaultFontFamily: defaultFontFamily
      };

      console.log('📤 업데이트 데이터:', updateData);

      const response = await axios.put(
        `http://localhost:8080/api/templates/${templateId}`,
        updateData,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('✅ 템플릿 업데이트 성공:', response.data);
      navigate('/templates');
    } catch (error: any) {
      console.error('❌ 템플릿 업데이트 실패:', error);
      setError(error.response?.data?.error || '템플릿 업데이트에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  // PDF Object URL 정리를 위한 useEffect
  useEffect(() => {
    return () => {
      if (pdfImageUrl) {
        URL.revokeObjectURL(pdfImageUrl);
      }
    };
  }, [pdfImageUrl]);

  // 편집 모드일 때 기존 템플릿 데이터 로드
  useEffect(() => {
    if (isEditMode && templateId) {
      console.log('🚀 편집 모드 감지, 템플릿 로드 시작:', { isEditMode, templateId });
      setStep('edit'); // 편집 모드에서는 즉시 edit 단계로 설정
      loadExistingTemplate(templateId);
    }
  }, [isEditMode, templateId]);

  // 기존 템플릿 로드 함수
  const loadExistingTemplate = async (id: string) => {
    try {
      setLoading(true);
      console.log('🔍 템플릿 로드 시작:', id);
      const response = await axios.get(`/api/templates/${id}`);
      const template = response.data;
      
      console.log('📄 로드된 템플릿 데이터:', template);
      
      // 템플릿 기본 정보 설정
      setTemplateName(template.name || '');
      setDescription(template.description || '');
      
      // 기본 폰트 설정 로드 (템플릿에 저장된 값이 있으면 사용, 없으면 기본값 유지)
      if (template.defaultFontSize) {
        setDefaultFontSize(template.defaultFontSize);
      }
      if (template.defaultFontFamily) {
        setDefaultFontFamily(template.defaultFontFamily);
      }
      
      // PDF 이미지 설정
      if (template.pdfImagePath) {
        // "./" 제거하고 절대 경로로 변환
        const cleanPath = template.pdfImagePath.startsWith('./') 
          ? template.pdfImagePath.substring(2) 
          : template.pdfImagePath;
        const imageUrl = `http://localhost:8080/${cleanPath}`;
        console.log('🖼️ PDF 이미지 URL 설정:', imageUrl);
        setPdfImageUrl(imageUrl);
        setStep('edit');
      } else {
        console.warn('⚠️ PDF 이미지 경로가 없습니다:', template);
      }
      
      // 필드 데이터 로드
      if (template.coordinateFields) {
        try {
          const fieldsData = typeof template.coordinateFields === 'string' 
            ? JSON.parse(template.coordinateFields) 
            : template.coordinateFields;
          
          if (Array.isArray(fieldsData)) {
            // 기존 필드들에 type 속성이 없으면 기본값 설정
            const normalizedFields = fieldsData.map(field => {
              const normalizedField = {
                ...field,
                type: field.type || 'field', // 기본값 설정
                fontSize: field.fontSize || 12, // 폰트 크기 기본값
                fontFamily: field.fontFamily || 'Arial' // 폰트 패밀리 기본값
              };
              
              // 테이블 타입이고 columnWidths가 없으면 기본값 설정
              if (normalizedField.type === 'table' && normalizedField.tableData && !normalizedField.tableData.columnWidths) {
                normalizedField.tableData.columnWidths = Array(normalizedField.tableData.cols).fill(1 / normalizedField.tableData.cols);
              }
              
              return normalizedField;
            });
            setFields(normalizedFields);
          }
      } catch (error) {
        console.error('필드 데이터 파싱 실패:', error);
      }
    }
    
    console.log('✅ 템플릿 로드 완료:', {
      name: templateName,
      description,
      pdfImageUrl,
      fieldsCount: fields.length
    });
    
  } catch (error) {
    console.error('❌ 템플릿 로드 실패:', error);
    setError('템플릿을 불러오는데 실패했습니다.');
  } finally {
    setLoading(false);
  }
};  // 전역 마우스 이벤트 등록
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (draggingField || resizingField) {
        handleMouseUp();
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [draggingField, resizingField]);

  // 로딩 상태 표시
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-lg">템플릿을 불러오는 중...</div>
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          {/* 헤더 */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              📄 PDF 템플릿 업로드
            </h1>
            <p className="text-gray-600">
              PDF 파일을 업로드하여 새로운 템플릿을 만들어보세요.
            </p>
          </div>

          <div className="space-y-6">
            {/* PDF 파일 업로드 영역 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                PDF 파일 *
              </label>
              <div
                className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-blue-400 bg-blue-50'
                    : selectedFile
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInput}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="text-green-600 text-4xl">✅</div>
                    <div className="text-sm font-medium text-green-700">
                      {selectedFile.name}
                    </div>
                    <div className="text-xs text-green-600">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFile(null);
                        setStep('upload');
                      }}
                      className="mt-2 text-xs text-red-600 hover:text-red-800"
                    >
                      제거
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-gray-400 text-4xl">📄</div>
                    <div className="text-sm text-gray-600">
                      PDF 파일을 드래그 앤 드롭하거나 클릭하여 선택하세요
                    </div>
                    <div className="text-xs text-gray-500">
                      최대 10MB까지 업로드 가능
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 안내 사항 */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="text-sm font-medium text-blue-900 mb-2">📋 안내사항</h3>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• PDF 파일은 최대 10MB까지 업로드할 수 있습니다.</li>
                <li>• 업로드 후 PDF 위를 드래그하여 원하는 크기의 입력 필드를 생성할 수 있습니다.</li>
                <li>• 템플릿은 문서 생성 시 기본 양식으로 사용됩니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 편집 단계 UI
  return (
    <div className="min-h-screen flex flex-col">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              {isEditMode ? '템플릿 수정' : '템플릿 필드 편집'}
            </h1>
            <p className="text-sm text-gray-600">
              {isEditMode 
                ? '기존 템플릿의 필드를 수정하고 저장하세요'
                : 'PDF 위를 드래그하여 영역 선택 후 필드 생성 | 기존 필드 클릭으로 편집 | 테이블 셀 클릭으로 내용 편집 | 드래그로 이동 | 모서리 드래그로 크기 조절'
              }
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => isEditMode ? navigate('/templates') : goBackToUpload()}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
            >
              {isEditMode ? '← 템플릿 목록' : '← 뒤로가기'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* PDF 미리보기 영역 */}
        <div className="flex-1 p-4 bg-gray-50">
          <div className="relative bg-gray-100 h-full overflow-auto flex justify-center items-start p-4">
            {/* PDF 컨테이너 - DocumentEditor와 동일한 구조 */}
            <div 
              className="relative bg-white shadow-sm border"
              onMouseDown={handlePdfMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onClick={handlePdfClick}
              style={{
                width: '1240px',
                height: '1754px',
                minWidth: '1240px', // 최소 크기를 원본 크기로 고정
                minHeight: '1754px', // 최소 높이도 원본 크기로 고정
                flexShrink: 0, // 컨테이너가 줄어들지 않도록 설정
                cursor: isCreatingField ? 'crosshair' : 'crosshair'
              }}
            >
              {/* PDF 배경 이미지 - DocumentEditor와 동일한 방식 */}
              {(pdfImageDataUrl || pdfImageUrl) ? (
                <img 
                  src={pdfImageDataUrl || pdfImageUrl || ''}
                  alt="PDF Preview"
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: '1240px',
                    height: '1754px',
                    objectFit: 'fill'
                  }}
                  onLoad={() => {
                    console.log('✅ PDF 이미지 로드 성공:', pdfImageDataUrl || pdfImageUrl);
                  }}
                  onError={(e) => {
                    console.error('❌ PDF 이미지 로드 실패:', {
                      src: pdfImageDataUrl || pdfImageUrl,
                      error: e
                    });
                  }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <div>PDF 미리보기</div>
                    <div className="text-sm mt-2">드래그하여 필드 영역 선택</div>
                  </div>
                </div>
              )}
                
              {/* 필드 오버레이 */}
              {fields.map((field) => (
                <div
                  key={field.id}
                  className={`absolute border-2 group select-none ${
                    draggingField === field.id 
                      ? 'border-red-500 bg-red-100' 
                      : resizingField === field.id
                      ? 'border-green-500 bg-green-100'
                      : field.type === 'table'
                      ? 'border-purple-500 bg-purple-100'
                      : 'border-blue-500 bg-blue-100'
                  } bg-opacity-30 hover:bg-opacity-50 transition-colors`}
                  style={{
                    left: field.x,
                    top: field.y,
                    width: field.width,
                    height: field.height,
                    cursor: draggingField === field.id ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={(e) => handleFieldMouseDown(field, e)}
                  onClick={(e) => handleFieldClick(field, e)}
                >
                  {field.type === 'table' && field.tableData ? (
                    // 테이블 렌더링
                    <div className="w-full h-full p-1 relative">
                      <div className="text-xs font-medium mb-1 text-purple-700 truncate">
                        {field.label} ({field.tableData.rows}×{field.tableData.cols})
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                      <div className="relative" style={{ height: 'calc(100% - 20px)' }}>
                        {/* 테이블 헤더 (컬럼 리사이저 포함) */}
                        <div 
                          className="flex bg-purple-300 h-6 border-b border-purple-400"
                          style={{
                            gridTemplateColumns: field.tableData.columnWidths 
                              ? field.tableData.columnWidths.map(width => `${width * 100}%`).join(' ')
                              : `repeat(${field.tableData.cols}, 1fr)`,
                          }}
                        >
                          {Array(field.tableData.cols).fill(null).map((_, colIndex) => (
                            <div 
                              key={`header-${colIndex}`}
                              className="relative flex items-center justify-center text-xs font-medium text-purple-800 bg-purple-200 border-r border-purple-300 last:border-r-0"
                              style={{
                                width: field.tableData?.columnWidths 
                                  ? `${field.tableData.columnWidths[colIndex] * 100}%`
                                  : `${100 / field.tableData!.cols}%`
                              }}
                            >
                              {colIndex + 1}
                              {/* 컬럼 리사이저 (마지막 컬럼 제외) */}
                              {colIndex < field.tableData!.cols - 1 && (
                                <div
                                  className="absolute right-0 top-0 w-2 h-full cursor-col-resize bg-purple-500 bg-opacity-0 hover:bg-opacity-30 transition-colors z-10"
                                  onMouseDown={(e) => handleColumnResizeMouseDown(field, colIndex, e)}
                                  title="드래그하여 컬럼 너비 조절"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* 테이블 셀들 */}
                        <div className="flex flex-col" style={{ height: 'calc(100% - 24px)' }}>
                          {Array(field.tableData.rows).fill(null).map((_, rowIndex) => (
                            <div 
                              key={`row-${rowIndex}`}
                              className="flex flex-1 border-b border-purple-200 last:border-b-0"
                              style={{
                                minHeight: `${Math.max(20, (field.height - 45) / field.tableData!.rows)}px`
                              }}
                            >
                              {Array(field.tableData!.cols).fill(null).map((_, colIndex) => {
                                const cellText = field.tableData!.cells[rowIndex]?.[colIndex] || '';
                                return (
                                  <div 
                                    key={`${rowIndex}-${colIndex}`}
                                    className="bg-white bg-opacity-70 border-r border-purple-200 hover:bg-opacity-90 cursor-pointer flex items-center justify-center text-xs p-1 transition-colors last:border-r-0"
                                    style={{
                                      width: field.tableData?.columnWidths 
                                        ? `${field.tableData.columnWidths[colIndex] * 100}%`
                                        : `${100 / field.tableData!.cols}%`
                                    }}
                                    onClick={(e) => handleTableCellClick(field.id, rowIndex, colIndex, e)}
                                    title={cellText || '클릭하여 편집'}
                                  >
                                    <span className="text-center text-purple-700 font-medium truncate leading-tight"
                                      style={{
                                        fontSize: `${field.fontSize || 12}px`,
                                        fontFamily: field.fontFamily || 'Arial'
                                      }}
                                    >
                                      {cellText}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    // 일반 필드 렌더링 - 제목은 고정 스타일 사용
                    <div className="text-xs text-blue-700 font-medium p-1 truncate pointer-events-none">
                      {field.label}
                      {field.required && <span className="text-red-500">*</span>}
                    </div>
                  )}
                  
                  {/* 리사이즈 핸들 */}
                  <div
                    className={`absolute bottom-0 right-0 w-3 h-3 cursor-se-resize opacity-0 group-hover:opacity-100 transition-opacity ${
                      field.type === 'table' ? 'bg-purple-500' : 'bg-blue-500'
                    }`}
                    onMouseDown={(e) => handleResizeMouseDown(field, e)}
                    style={{
                      background: `linear-gradient(-45deg, transparent 30%, ${field.type === 'table' ? '#a855f7' : '#3b82f6'} 30%, ${field.type === 'table' ? '#a855f7' : '#3b82f6'} 70%, transparent 70%)`
                    }}
                  />
                </div>
              ))}

              {/* 새 필드 생성을 위한 선택 영역 표시 */}
              {isCreatingField && selectionBox && (
                <div
                  className="absolute border-2 border-dashed border-purple-500 bg-purple-200 bg-opacity-20 pointer-events-none"
                  style={{
                    left: selectionBox.x,
                    top: selectionBox.y,
                    width: selectionBox.width,
                    height: selectionBox.height,
                  }}
                >
                  <div className="text-xs text-purple-700 font-medium p-1">
                    {Math.round(selectionBox.width)} × {Math.round(selectionBox.height)} px
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 우측 필드 관리 패널 */}
        <div className="w-80 bg-white border-l">
          <div className="p-6 space-y-6">
            {/* 템플릿 정보 */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900">템플릿 정보</h3>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="예: 근무일지 템플릿"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                  placeholder="템플릿 설명"
                />
              </div>

              {/* 폰트 설정 */}
              <div className="p-3 bg-blue-50 rounded-md">
                <div className="text-sm font-medium text-blue-900 mb-3">기본 폰트 설정</div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      폰트 패밀리
                    </label>
                    <select
                      value={defaultFontFamily}
                      onChange={(e) => setDefaultFontFamily(e.target.value)}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    >
                      {availableFonts.map(font => (
                        <option key={font} value={font} style={{ fontFamily: font }}>
                          {font}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      폰트 크기 (px)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="72"
                      value={defaultFontSize}
                      onChange={(e) => setDefaultFontSize(Math.max(1, parseInt(e.target.value) || 12))}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="text-xs text-blue-600 mt-2">
                  새로 추가되는 필드의 입력값에 적용됩니다 (필드 제목 제외)
                </div>
              </div>
            </div>

            {/* 필드 목록 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">필드 목록</h3>
                <span className="text-sm text-gray-500">
                  {fields.length}개
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {fields.length === 0 ? (
                  <div className="text-sm text-gray-500 text-center py-4">
                    PDF를 클릭하여 필드를 추가하세요
                  </div>
                ) : (
                  fields.map((field) => (
                    <div
                      key={field.id}
                      className={`p-3 border rounded-md cursor-pointer transition-colors ${
                        selectedField?.id === field.id
                          ? field.type === 'table' 
                            ? 'border-purple-300 bg-purple-50' 
                            : 'border-blue-300 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedField(field);
                        setIsEditModalOpen(true);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm flex items-center">
                          {field.type === 'table' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 mr-2">
                              📊 테이블
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-2">
                              📝 필드
                            </span>
                          )}
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                        </div>
                        <div className="text-xs text-gray-500">
                          ({field.x}, {field.y})
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-1 flex justify-between">
                        <span>{field.id}</span>
                        {field.type === 'table' && field.tableData && (
                          <span className="text-purple-600">
                            {field.tableData.rows}×{field.tableData.cols}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* 에러 메시지 */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* 저장/업데이트 버튼 */}
            <button
              onClick={isEditMode ? updateTemplate : handleSubmit}
              disabled={uploading || !templateName.trim()}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>{isEditMode ? '업데이트 중...' : '업로드 중...'}</span>
                </div>
              ) : (
                isEditMode ? '템플릿 업데이트' : '템플릿 생성'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 새 필드 추가 모달 */}
      <NewFieldModal
        isOpen={isNewFieldModalOpen}
        onClose={() => {
          setIsNewFieldModalOpen(false);
          // 모달 닫을 때 선택 영역도 초기화
          setIsCreatingField(false);
          setCreationStart(null);
          setSelectionBox(null);
        }}
        onSave={handleNewFieldSave}
        initialPosition={newFieldPosition}
        selectionBox={selectionBox}
        defaultFontSize={defaultFontSize}
        defaultFontFamily={defaultFontFamily}
      />

      {/* 필드 편집 모달 */}
      <FieldEditModal
        field={selectedField}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedField(null);
        }}
        onSave={handleFieldEdit}
        onDelete={handleFieldDelete}
        availableFonts={availableFonts}
      />

      {/* 테이블 셀 편집 모달 */}
      <TableCellEditModal
        isOpen={isTableCellEditOpen}
        onClose={() => {
          setIsTableCellEditOpen(false);
          setEditingCell(null);
        }}
        onSave={handleTableCellSave}
        currentText={
          editingCell && fields.find(f => f.id === editingCell.fieldId)?.tableData?.cells?.[editingCell.row]?.[editingCell.col] || ''
        }
        cellPosition={editingCell ? { row: editingCell.row, col: editingCell.col } : { row: 0, col: 0 }}
        tableName={
          editingCell ? fields.find(f => f.id === editingCell.fieldId)?.label || '' : ''
        }
      />
    </div>
  );
};

export default TemplateUploadPdf;
