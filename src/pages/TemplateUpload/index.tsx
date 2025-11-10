import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTemplateFields } from '../../hooks/useTemplateFields';
import { usePdfCanvas } from '../../hooks/usePdfCanvas';
import NewFieldModal from '../../components/modals/NewFieldModal';
import FieldEditModal from '../../components/modals/FieldEditModal';
import TableCellEditModal from '../../components/modals/TableCellEditModal';
import FolderSelector from '../../components/FolderSelector';
import FolderCreateModal from '../../components/FolderCreateModal';
import FolderLocationSelector from '../../components/FolderLocationSelector';
import { folderService } from '../../services/folderService';
import FieldManagement from './components/FieldManagement';
import TemplatePreview from './components/TemplatePreview';
import MultiPageTemplatePreview from './components/MultiPageTemplatePreview';
import { TemplateField } from '../../types/field';
import { runCoordinateTests } from '../../utils/coordinateDebugger';

const TemplateUpload: React.FC = () => {
  const navigate = useNavigate();
  const { id: templateId } = useParams<{ id: string }>();
  const isEditMode = !!templateId;
  
  const {
    fields,
    selectedField,
    addField,
    updateField,
    deleteField,
    selectField,
    setFields
  } = useTemplateFields();

  const {
    clearSelection,
    ...canvasProps
  } = usePdfCanvas();

  // Upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedParentFolderId, setSelectedParentFolderId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [folderRefreshTrigger, setFolderRefreshTrigger] = useState(0); // FolderSelector 새로고침용
  
  // PDF preview states
  const [pdfImageDataUrl, setPdfImageDataUrl] = useState<string | null>(null);
  const [pdfPages, setPdfPages] = useState<Array<{
    pageNumber: number;
    imageUrl: string;
    width: number;
    height: number;
  }>>([]);
  const [isMultiPage, setIsMultiPage] = useState(false);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isNewFieldModalOpen, setIsNewFieldModalOpen] = useState(false);
  const [isTableCellEditOpen, setIsTableCellEditOpen] = useState(false);
  const [newFieldPosition, setNewFieldPosition] = useState({ x: 0, y: 0 });
  const [newFieldSelection, setNewFieldSelection] = useState<{ x: number; y: number; width: number; height: number; pageNumber?: number } | null>(null);
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  
  // Table editing
  const [editingCell, setEditingCell] = useState<{
    fieldId: string;
    row: number;
    col: number;
  } | null>(null);
  
  // Font settings
  const [defaultFontSize, setDefaultFontSize] = useState(16);
  const [defaultFontFamily, setDefaultFontFamily] = useState('Arial');
  
  const availableFonts = [
    'Arial', 'Times New Roman', 'Helvetica', 'Georgia',
    'Verdana', 'Tahoma', 'Trebuchet MS', 'Courier New',
    'Impact', 'Comic Sans MS'
  ];

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setError('PDF 파일만 업로드할 수 있습니다.');
      return;
    }
    
    setSelectedFile(file);
    setError(null);
    
    if (!templateName) {
      const nameWithoutExtension = file.name.replace(/\.pdf$/i, '');
      setTemplateName(nameWithoutExtension);
    }

    // PDF 선택 시 자동으로 이미지 변환

    setTimeout(() => {
      runCoordinateTests();
    }, 500);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // 다중 페이지 변환 시도 (우선)
      const multiPageResponse = await axios.post('/api/pdf/convert-to-images', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        }
      });

      console.log('🔍 다중 페이지 API 응답 전체:', multiPageResponse);
      console.log('🔍 응답 데이터:', multiPageResponse.data);
      console.log('🔍 응답 데이터 타입:', typeof multiPageResponse.data);

      if (multiPageResponse.data && multiPageResponse.data.pages) {
        console.log('✅ multiPageResponse.data.pages 존재:', multiPageResponse.data.pages);
        console.log('📊 pages 배열 길이:', multiPageResponse.data.pages.length);

        // 각 페이지 객체의 구조를 확인
        multiPageResponse.data.pages.forEach((page: any, index: number) => {
          console.log(`🔍 페이지 ${index + 1} 원본 데이터:`, page);
          console.log(`🔍 페이지 ${index + 1} 키들:`, Object.keys(page));
          console.log(`🔍 페이지 ${index + 1} 모든 값들:`, Object.values(page));

          // 가능한 모든 필드를 체크
          const possibleFields = ['imageUrl', 'url', 'image', 'base64', 'data', 'content', 'imageData', 'src', 'png', 'file'];
          possibleFields.forEach(field => {
            if (page[field] !== undefined) {
              console.log(`🎯 페이지 ${index + 1} ${field}:`, typeof page[field], page[field]?.toString().substring(0, 100));
            }
          });
        });

        // 다중 페이지 성공 - 서버에서 이미 완전한 data URL로 제공됨
        const pages = multiPageResponse.data.pages.map((pageData: any, index: number) => {
          let imageUrl: string | null = null;

          // pageData가 문자열(이미 완전한 data URL)인 경우
          if (typeof pageData === 'string') {
            imageUrl = pageData;
            console.log(`✅ 페이지 ${index + 1} 완전한 data URL 수신:`, imageUrl.substring(0, 50) + '...');
          }
          // pageData가 객체인 경우 (향후 확장성을 위해)
          else if (typeof pageData === 'object' && pageData !== null) {
            imageUrl = pageData.imageUrl || pageData.url || pageData.image || pageData.data || null;
            console.log(`🔍 페이지 ${index + 1} 객체 형태, 선택된 필드:`, imageUrl ? '데이터 있음' : '데이터 없음');
          }

          // imageUrl 유효성 검사
          if (!imageUrl) {
            console.error(`❌ 페이지 ${index + 1} imageUrl이 없습니다`);
            return null;
          }

          if (!imageUrl.startsWith('data:image/')) {
            console.warn(`⚠️ 페이지 ${index + 1} 예상과 다른 URL 형식:`, imageUrl.substring(0, 50));
          }

          console.log(`🔧 페이지 ${index + 1} 최종 imageUrl 길이:`, imageUrl.length);
          console.log(`🔧 페이지 ${index + 1} URL 타입: ${imageUrl.startsWith('data:image/') ? 'data URL' : 'other'}`);

          return {
            pageNumber: index + 1,
            imageUrl,
            width: 1240,
            height: 1754
          };
        }).filter((page: any): page is NonNullable<typeof page> => page !== null);

        console.log('📄 변환된 페이지들:', pages);
        setPdfPages(pages);
        setIsMultiPage(true);
        console.log('📐 다중 페이지 PDF 변환 완료:', { totalPages: pages.length });
        return;
      } else {
        console.log('❌ multiPageResponse.data.pages가 없음');
        console.log('❌ multiPageResponse.data:', multiPageResponse.data);
      }
    } catch (multiPageError: any) {
      console.log('다중 페이지 변환 실패, 다시 시도:', multiPageError);

      // 다중 페이지 변환이 실패한 경우, 다시 한 번 시도해보기
      try {
        const retryFormData = new FormData();
        retryFormData.append('file', file);

        console.log('🔄 다중 페이지 변환 재시도 중...');
        const retryResponse = await axios.post('/api/pdf/convert-to-images', retryFormData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        });

        if (retryResponse.data && retryResponse.data.pages && retryResponse.data.pages.length > 0) {
          console.log('✅ 재시도 성공! 다중 페이지 데이터:', retryResponse.data.pages);

          const pages = retryResponse.data.pages.map((pageData: any, index: number) => {
            let imageUrl: string | null = null;

            if (typeof pageData === 'string') {
              imageUrl = pageData;
            } else if (typeof pageData === 'object' && pageData !== null) {
              imageUrl = pageData.imageUrl || pageData.url || pageData.image || pageData.data || null;
            }

            if (imageUrl && !imageUrl.startsWith('data:image/') && !imageUrl.startsWith('http')) {
              try {
                const binaryString = atob(imageUrl);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                  bytes[i] = binaryString.charCodeAt(i);
                }
                const blob = new Blob([bytes], { type: 'image/png' });
                imageUrl = URL.createObjectURL(blob);
              } catch (error) {
                imageUrl = `data:image/png;base64,${imageUrl}`;
              }
            }

            return {
              pageNumber: index + 1,
              imageUrl,
              width: 1240,
              height: 1754
            };
          });

          setPdfPages(pages);
          setIsMultiPage(true);
          console.log('🎉 재시도로 다중 페이지 변환 성공:', pages.length, '페이지');
          return;
        }
      } catch (retryError) {
        console.log('재시도도 실패, 단일 페이지로 폴백:', retryError);
      }

      // 최종적으로 단일 페이지 방식으로 폴백
      try {
        const formData = new FormData();
        formData.append('file', file);

        // 단일 페이지 방식 사용 (첫 번째 페이지만)
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
        setIsMultiPage(false);

        // 단일 페이지를 pages 배열에도 추가 (첫 번째 페이지만이라는 경고 포함)
        const singlePage = {
          pageNumber: 1,
          imageUrl: imageUrl,
          width: 1240,
          height: 1754
        };
        setPdfPages([singlePage]);

        console.warn('⚠️ 다중 페이지 변환 실패로 첫 번째 페이지만 표시됩니다.');
        console.log('📐 폴백: 단일 페이지로 설정:', [singlePage]);
      } catch (singlePageError) {
        console.error('PDF 변환 완전 실패:', singlePageError);

        // 변환 실패 시에도 빈 페이지 배열 대신 기본값 설정
        setPdfPages([]);
        setPdfImageDataUrl(null);
        setIsMultiPage(false);
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('템플릿 이름을 입력해주세요.');
      return;
    }

    // 새 템플릿 생성 시에는 PDF 파일이 필수
    if (!selectedFile && !isEditMode) {
      setError('PDF 파일을 선택해주세요.');
      return;
    }

    // 편집 모드에서는 기존 PDF가 있거나 새 파일이 있어야 함
    if (isEditMode && !selectedFile && !pdfImageDataUrl && pdfPages.length === 0) {
      setError('PDF 파일이 없습니다. 새 PDF 파일을 업로드해주세요.');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // PDF 페이지 데이터 준비
      const pageData = pdfPages.length > 0 ? pdfPages.map(page => ({
        pageNumber: page.pageNumber,
        width: page.width,
        height: page.height,
        // imageUrl은 서버에서 관리하므로 제외하지만 페이지 정보는 포함
      })) : [{
        pageNumber: 1,
        width: 1240,
        height: 1754
      }];

      console.log('📄 템플릿 저장 시 PDF 페이지 정보:', {
        isMultiPage,
        totalPages: pdfPages.length > 0 ? pdfPages.length : 1,
        pdfPagesData: pageData,
        pdfPagesLength: pdfPages.length
      });

      let templateData: any = {
        name: templateName,
        description,
        coordinateFields: JSON.stringify(fields),
        defaultFolderId: selectedFolderId,
        // PDF 다중 페이지 정보 추가
        isMultiPage: isMultiPage,
        totalPages: pdfPages.length > 0 ? pdfPages.length : 1,
        pdfPagesData: JSON.stringify(pageData)
      };

      console.log('💾 최종 templateData:', {
        ...templateData,
        pdfPagesData: '(JSON 문자열)' // 로그 길이를 줄이기 위해 요약
      });

      if (selectedFile) {
        // 새 파일이 선택된 경우 (생성 모드 또는 편집 모드에서 파일 교체)
        const formData = new FormData();
        Object.keys(templateData).forEach(key => {
          formData.append(key, templateData[key]);
        });
        formData.append('file', selectedFile);

        if (isEditMode) {
          console.log('🔄 편집 모드: 새 PDF 파일로 업데이트');
          await axios.put(`/api/templates/${templateId}`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        } else {
          console.log('📄 생성 모드: 새 템플릿 생성');
          await axios.post('/api/templates/upload-pdf', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
        }
      } else if (isEditMode) {
        // 편집 모드에서 파일 변경 없이 메타데이터만 업데이트
        console.log('📝 편집 모드: 메타데이터만 업데이트');
        await axios.put(`/api/templates/${templateId}`, templateData, {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      alert(isEditMode ? '템플릿이 수정되었습니다.' : '템플릿이 생성되었습니다.');
      navigate('/templates');
    } catch (error) {
      console.error('템플릿 저장 실패:', error);
      setError('템플릿 저장에 실패했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const handleFieldEdit = (field: TemplateField) => {
    selectField(field.id);
    setIsEditModalOpen(true);
  };

  const handleFieldSave = (updatedField: TemplateField) => {
    updateField(updatedField.id, updatedField);
    setIsEditModalOpen(false);
  };

  const handleFieldDelete = () => {
    if (selectedField) {
      deleteField(selectedField.id);
      setIsEditModalOpen(false);
    }
  };

  const handleNewField = (field: TemplateField) => {
    // 현재 선택된 페이지 번호를 필드에 추가
    let fieldWithPage = {
      ...field,
      page: newFieldSelection?.pageNumber || currentPageNumber || 1
    };
    
    // 서명자 서명 필드인 경우 reviewerIndex 자동 계산 (라벨은 사용자가 입력한 값 유지)
    if (field.type === 'reviewer_signature') {
      const existingReviewerFields = fields.filter(f => f.type === 'reviewer_signature');
      const nextIndex = existingReviewerFields.length + 1;
      fieldWithPage = {
        ...fieldWithPage,
        reviewerIndex: nextIndex
        // label은 사용자가 입력한 값을 그대로 사용
      };
    }
    
    addField(fieldWithPage);
    clearSelection();
  };

  const openTableCellEdit = (fieldId: string, row: number, col: number) => {
    setEditingCell({ fieldId, row, col });
    setIsTableCellEditOpen(true);
  };

  const handleTableCellSave = (text: string) => {
    if (!editingCell) return;
    
    const field = fields.find(f => f.id === editingCell.fieldId);
    if (!field?.tableData) return;

    const updatedCells = field.tableData.cells.map((row: string[], rIdx: number) =>
      rIdx === editingCell.row 
        ? row.map((cell: string, cIdx: number) => 
            cIdx === editingCell.col ? text : cell
          )
        : row
    );

    updateField(field.id, {
      tableData: { ...field.tableData, cells: updatedCells }
    });
    
    setIsTableCellEditOpen(false);
    setEditingCell(null);
  };

  // 폴더 생성 관련 함수들
  const handleCreateFolder = async (folderName: string) => {
    try {
      const newFolder = await folderService.createFolder({
        name: folderName,
        parentId: selectedParentFolderId
      });
      
      // 새로 생성된 폴더를 자동으로 선택
      setSelectedFolderId(newFolder.id);
      
      // FolderSelector 새로고침 트리거
      setFolderRefreshTrigger(prev => prev + 1);
      
      // 모달 닫기
      setShowCreateModal(false);
      setSelectedParentFolderId(null);
      setShowLocationModal(false);
      
      // 성공 메시지 표시 (선택사항)
      console.log('폴더가 성공적으로 생성되었습니다.');
    } catch (error: any) {
      console.error('Error creating folder:', error);
      throw error; // 모달에서 에러 처리
    }
  };

  const openCreateFolderModal = () => {
    setShowLocationModal(true);
  };

  // 편집 모드일 때 기존 템플릿 데이터 로드
  useEffect(() => {
    const loadTemplateForEdit = async () => {
      if (isEditMode && templateId) {
        setLoadingTemplate(true);
        try {
          console.log('🔧 템플릿 편집 모드 - 기존 데이터 로드 시작:', templateId);
          const response = await axios.get(`/api/templates/${templateId}`);
          const template = response.data;
          
          console.log('📋 로드된 템플릿 데이터:', template);
          
          // 기본 정보 설정
          setTemplateName(template.name || '');
          setDescription(template.description || '');
          setSelectedFolderId(template.defaultFolderId || null);
          
          console.log('📁 기본 폴더 설정:', template.defaultFolderId, template.defaultFolderName);
          
          // PDF 이미지 경로 및 페이지 정보 설정
          let pdfImagePaths: string[] | null = null;

          // pdfImagePaths가 문자열인 경우 파싱
          if (template.pdfImagePaths) {
            if (Array.isArray(template.pdfImagePaths)) {
              pdfImagePaths = template.pdfImagePaths;
            } else if (typeof template.pdfImagePaths === 'string') {
              try {
                // JSON 문자열 파싱 시도
                pdfImagePaths = JSON.parse(template.pdfImagePaths);
              } catch (error) {
                console.error('❌ pdfImagePaths JSON 파싱 실패:', error);
                console.log('🔍 TemplateUpload - 원본 문자열:', template.pdfImagePaths);
                // 대괄호로 감싸진 문자열을 수동으로 파싱
                const cleanStr = template.pdfImagePaths.replace(/^\[|\]$/g, '');
                pdfImagePaths = cleanStr.split(',').map((path: string) => path.trim());
                console.log('🔍 TemplateUpload - 수동 파싱 결과:', pdfImagePaths);
              }
            }
          }

          if (pdfImagePaths && Array.isArray(pdfImagePaths) && pdfImagePaths.length > 0) {
            // 다중 페이지 PDF 처리
            const pages = pdfImagePaths.map((imagePath: string, index: number) => {
              // 경로 정리: ./ 제거하고 절대 경로로 만들기
              let cleanImagePath = imagePath.trim();
              console.log('🔍 TemplateUpload - 경로 처리 전:', imagePath);
              if (cleanImagePath.startsWith('./')) {
                cleanImagePath = cleanImagePath.substring(2);
              }
              if (!cleanImagePath.startsWith('/')) {
                cleanImagePath = '/' + cleanImagePath;
              }
              console.log('🔍 TemplateUpload - 경로 처리 후:', cleanImagePath);

              return {
                pageNumber: index + 1,
                imageUrl: cleanImagePath,
                width: 1240,
                height: 1754
              };
            });

            setPdfPages(pages);
            setIsMultiPage(true);
            console.log('🖼️ 다중 페이지 PDF 이미지 경로 설정:', pages);
            console.log('🔍 TemplateUpload - 원본 pdfImagePaths:', template.pdfImagePaths);
          } else if (template.pdfImagePath) {
            // 단일 페이지 PDF 처리 (기존 방식)
            let imageFileName = template.pdfImagePath.split('/').pop() || '';
            // 이미 .png인 경우 그대로, .pdf인 경우만 .png로 변경
            if (imageFileName.endsWith('.pdf')) {
              imageFileName = imageFileName.replace('.pdf', '.png');
            }
            const fullImagePath = `/uploads/pdf-templates/${imageFileName}`;
            setPdfImageDataUrl(fullImagePath);
            console.log('🖼️ 단일 페이지 PDF 이미지 경로 설정:', fullImagePath);

            // 단일 페이지도 pages 배열에 추가
            setPdfPages([{
              pageNumber: 1,
              imageUrl: fullImagePath,
              width: 1240,
              height: 1754
            }]);
            setIsMultiPage(false);
          }

          // 다중 페이지 정보 설정
          console.log('📄 템플릿 다중 페이지 정보:', {
            isMultiPage: template.isMultiPage,
            totalPages: template.totalPages,
            pdfPagesData: template.pdfPagesData
          });

          // template.pdfImagePaths가 있으면 이미 위에서 처리했으므로 스킵
          if (!pdfImagePaths && template.isMultiPage && template.pdfPagesData) {
            try {
              const pagesData = typeof template.pdfPagesData === 'string'
                ? JSON.parse(template.pdfPagesData)
                : template.pdfPagesData;

              if (Array.isArray(pagesData) && pagesData.length > 0) {
                // 이미지 경로가 있는 경우에만 복원 (현재는 이미지 경로 없이는 의미가 없음)
                const reconstructedPages = pagesData.map(pageData => ({
                  pageNumber: pageData.pageNumber,
                  width: pageData.width || 1240,
                  height: pageData.height || 1754,
                  imageUrl: '' // 이미지 경로가 없으므로 빈 값
                }));

                setPdfPages(reconstructedPages);
                setIsMultiPage(true);
                console.log('✅ 다중 페이지 데이터 복원 (이미지 경로 없음):', reconstructedPages);
              } else {
                // 단일 페이지로 설정
                setIsMultiPage(false);
                if (!template.pdfImagePath) {
                  setPdfPages([]);
                }
              }
            } catch (pagesParseError) {
              console.error('❌ PDF 페이지 데이터 파싱 실패:', pagesParseError);
              setIsMultiPage(false);
              if (!template.pdfImagePath) {
                setPdfPages([]);
              }
            }
          } else if (!pdfImagePaths && !template.pdfImagePath) {
            // PDF 이미지 경로가 전혀 없는 경우
            setIsMultiPage(false);
            setPdfPages([]);
            console.log('📄 PDF 이미지 경로가 없음');
          }
          
          // 필드 데이터 파싱 및 설정
          if (template.coordinateFields) {
            try {
              const parsedFields = typeof template.coordinateFields === 'string' 
                ? JSON.parse(template.coordinateFields)
                : template.coordinateFields;
              
              console.log('📐 파싱된 필드 데이터:', parsedFields);
              
              if (Array.isArray(parsedFields)) {
                setFields(parsedFields);
              }
            } catch (fieldParseError) {
              console.error('❌ 필드 데이터 파싱 실패:', fieldParseError);
            }
          }
          
        } catch (error) {
          console.error('❌ 템플릿 로드 실패:', error);
          setError('템플릿을 불러오는데 실패했습니다.');
        } finally {
          setLoadingTemplate(false);
        }
      }
    };

    loadTemplateForEdit();
  }, [isEditMode, templateId, setFields]);

  // PDF Object URL 정리를 위한 useEffect
  useEffect(() => {
    return () => {
      if (pdfImageDataUrl) {
        URL.revokeObjectURL(pdfImageDataUrl);
      }
      // 다중 페이지 Blob URL도 정리
      pdfPages.forEach(page => {
        if (page.imageUrl && page.imageUrl.startsWith('blob:')) {
          URL.revokeObjectURL(page.imageUrl);
        }
      });
    };
  }, [pdfImageDataUrl, pdfPages]);





  // 로딩 상태 표시
  if (loadingTemplate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-600">템플릿 데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-7xl mx-auto px-4 py-6 flex-1 flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">
            {isEditMode ? '템플릿 편집' : '새 템플릿 생성'}
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => navigate('/templates')}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              뒤로
            </button>
            <button
              onClick={handleSaveTemplate}
              disabled={uploading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {uploading ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>

        {/* PDF 업로드 및 기본 정보 섹션 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">기본 정보</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PDF 업로드 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PDF 파일 *
              </label>
              <div
                className="relative border-2 border-dashed rounded-lg p-6 text-center transition-colors hover:border-gray-400"
                onDragEnter={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
              >
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="space-y-2">
                  <div className="text-2xl">📄</div>
                  {isEditMode && (pdfImageDataUrl || pdfPages.length > 0) && !selectedFile ? (
                    // 편집 모드에서 기존 PDF가 있는 경우 (단일 페이지 또는 다중 페이지)
                    <div>
                      <p className="text-sm text-green-600 font-medium">
                        ✅ 기존 PDF 파일이 업로드되어 있습니다
                        {pdfPages.length > 1 && <span className="ml-2">({pdfPages.length}페이지)</span>}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        새 PDF 파일을 선택하면 기존 파일을 교체할 수 있습니다
                      </p>
                    </div>
                  ) : (
                    // 새 파일 업로드 또는 파일 선택된 경우
                    <div>
                      <p className="text-sm text-gray-600">
                        {selectedFile ? selectedFile.name : 'PDF 파일을 선택하거나 드래그하세요'}
                      </p>
                      {selectedFile && (
                        <p className="text-xs text-gray-500">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 템플릿 정보 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  템플릿 이름 *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="예: 계약서 템플릿, 신청서 양식 등"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    폴더
                  </label>
                  <button
                    type="button"
                    onClick={openCreateFolderModal}
                    className="px-2 py-1 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded transition-colors flex items-center"
                    title="새 폴더 만들기"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                    새 폴더
                  </button>
                </div>
                <FolderSelector
                  selectedFolderId={selectedFolderId}
                  onFolderSelect={setSelectedFolderId}
                  placeholder="이 템플릿으로 생성한 문서가 담길 폴더를 선택해주세요"
                  allowRoot={true}
                  hideCreateButton={true}
                  refreshTrigger={folderRefreshTrigger}
                  onFolderCreated={(folderId) => {
                    // FolderSelector 내부에서 폴더 생성 시 자동 선택되도록 처리
                    setSelectedFolderId(folderId);
                  }}
                />
                <p className="text-xs text-gray-500 mt-1">
                  이 템플릿으로 문서를 생성할 때 선택한 폴더에 자동으로 저장됩니다.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  설명
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  placeholder="이 템플릿의 용도나 특징을 간단히 설명해주세요"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-4">
            {pdfPages.length > 0 || (pdfImageDataUrl && !isMultiPage) ? (
              <MultiPageTemplatePreview
                pages={pdfPages.length > 0 ? pdfPages : (pdfImageDataUrl ? [{
                  pageNumber: 1,
                  imageUrl: pdfImageDataUrl,
                  width: 1240,
                  height: 1754
                }] : [])}
                fields={fields}
                selectedFieldId={selectedField?.id || null}
                onFieldClick={handleFieldEdit}
                onFieldMove={updateField}
                onFieldResize={updateField}
                onTableCellClick={openTableCellEdit}
                onCanvasClick={(selection) => {
                  setNewFieldPosition({ x: selection.x, y: selection.y });
                  setNewFieldSelection({
                    ...selection,
                    pageNumber: selection.pageNumber || 1
                  });
                  setCurrentPageNumber(selection.pageNumber || 1);
                  setIsNewFieldModalOpen(true);
                }}
              />
            ) : (
              <TemplatePreview
                pdfImageUrl={pdfImageDataUrl}
                fields={fields}
                selectedFieldId={selectedField?.id || null}
                onFieldClick={handleFieldEdit}
                onFieldMove={updateField}
                onFieldResize={updateField}
                onTableCellClick={openTableCellEdit}
                onCanvasClick={(selection) => {
                  setNewFieldPosition({ x: selection.x, y: selection.y });
                  setNewFieldSelection({
                    ...selection,
                    pageNumber: 1
                  });
                  setCurrentPageNumber(1);
                  setIsNewFieldModalOpen(true);
                }}
                {...canvasProps}
              />
            )}
          </div>
          
          <div className="lg:col-span-1">
            <FieldManagement
              fields={fields}
              selectedFieldId={selectedField?.id || null}
              onFieldSelect={(fieldId) => selectField(fieldId)}
              onFieldEdit={handleFieldEdit}
              onFieldDelete={(fieldId) => deleteField(fieldId)}
              defaultFontSize={defaultFontSize}
              defaultFontFamily={defaultFontFamily}
              availableFonts={availableFonts}
              onFontSizeChange={setDefaultFontSize}
              onFontFamilyChange={setDefaultFontFamily}
            />
          </div>
        </div>
      </div>

      <NewFieldModal
        isOpen={isNewFieldModalOpen}
        onClose={() => {
          setIsNewFieldModalOpen(false);
          setNewFieldSelection(null);
        }}
        onSave={handleNewField}
        initialPosition={newFieldPosition}
        selectionBox={newFieldSelection}
        defaultFontSize={defaultFontSize}
        defaultFontFamily={defaultFontFamily}
      />

      <FieldEditModal
        field={selectedField}
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleFieldSave}
        onDelete={handleFieldDelete}
        availableFonts={availableFonts}
      />

      {editingCell && (
        <TableCellEditModal
          isOpen={isTableCellEditOpen}
          onClose={() => {
            setIsTableCellEditOpen(false);
            setEditingCell(null);
          }}
          onSave={handleTableCellSave}
          currentText={
            fields.find(f => f.id === editingCell.fieldId)?.tableData?.cells[editingCell.row]?.[editingCell.col] || ''
          }
          cellPosition={{ row: editingCell.row, col: editingCell.col }}
          tableName={fields.find(f => f.id === editingCell.fieldId)?.label || ''}
        />
      )}

      {/* 위치 선택 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            {/* 배경 오버레이 */}
            <div 
              className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
              onClick={() => setShowLocationModal(false)}
            />

            {/* 모달 컨테이너 */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                      새 폴더 만들기
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          폴더를 생성할 위치 선택
                        </label>
                        <FolderLocationSelector
                          selectedFolderId={selectedParentFolderId}
                          onFolderSelect={setSelectedParentFolderId}
                          allowRoot={true}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setShowCreateModal(true);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  계속
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLocationModal(false);
                    setSelectedParentFolderId(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 폴더 생성 모달 */}
      <FolderCreateModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false);
          setSelectedParentFolderId(null);
        }}
        onSubmit={handleCreateFolder}
        parentFolderName={selectedParentFolderId ? 'Selected Folder' : null}
      />
    </div>
  );
};

export default TemplateUpload;