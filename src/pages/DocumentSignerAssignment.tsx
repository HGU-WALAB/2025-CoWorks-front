import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import UserSearchInput from '../components/UserSearchInput';
import { StatusBadge, DOCUMENT_STATUS } from '../utils/documentStatusUtils';
import axios from 'axios';

const DocumentSignerAssignment: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentDocument, loading, error, getDocument } = useDocumentStore();
  const { user, token, isAuthenticated } = useAuthStore();

  // 상태 관리
  const [selectedReviewer, setSelectedReviewer] = useState('');
  const [isAssigningReviewer, setIsAssigningReviewer] = useState(false);
  const [isCompletingAssignment, setIsCompletingAssignment] = useState(false);

  // 서명 필드 관련 상태
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeFieldId, setActiveFieldId] = useState<string | null>(null);

  // 문서별 서명 필드를 로컬 스토리지에서 로드
  useEffect(() => {
    if (id) {
      const savedFields = localStorage.getItem(`signatureFields_${id}`);
      if (savedFields) {
        try {
          setSignatureFields(JSON.parse(savedFields));
        } catch (error) {
          console.error('서명 필드 로드 실패:', error);
        }
      }
    }
  }, [id]);

  // 서명 필드 변경 시 로컬 스토리지에 저장
  useEffect(() => {
    if (id && signatureFields.length > 0) {
      localStorage.setItem(`signatureFields_${id}`, JSON.stringify(signatureFields));
    }
  }, [id, signatureFields]);

  // 인증 상태 확인
  if (!isAuthenticated || !token || !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">로그인이 필요합니다</h3>
              <p className="text-yellow-700 mb-4">
                이 페이지에 접근하려면 로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?
              </p>
              <button
                onClick={() => navigate('/login')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                로그인하러 가기
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (id) {
      getDocument(parseInt(id));
    }
  }, [id, getDocument]);

  // 서명자 지정 권한 확인
  const canAssignReviewer = () => {
    if (!currentDocument || !user) return false;
    return currentDocument.tasks?.some(task =>
      (task.role === 'CREATOR' || (task.role === 'EDITOR')) &&
      task.assignedUserEmail === user.email
    );
  };

  // 서명자 지정 핸들러
  const handleAssignReviewer = async () => {
    if (!selectedReviewer.trim()) {
      alert('서명자 이메일을 입력해주세요.');
      return;
    }

    if (!currentDocument) {
      alert('문서 정보를 찾을 수 없습니다.');
      return;
    }

    setIsAssigningReviewer(true);

    try {
      const response = await axios.post(
        `http://localhost:8080/api/documents/${currentDocument.id}/assign-reviewer`,
        { reviewerEmail: selectedReviewer },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 200) {
        const reviewerEmail = selectedReviewer;
        setSelectedReviewer('');
        
        // 문서 정보 다시 로드하고 결과를 받아서 처리
        const updatedDocument = await getDocument(parseInt(id!));
        
        // 새로 로드된 문서에서 방금 지정한 서명자의 이름을 찾기
        const assignedReviewer = updatedDocument?.tasks?.find(
          task => task.role === 'REVIEWER' && task.assignedUserEmail === reviewerEmail
        );
        const reviewerName = assignedReviewer?.assignedUserName || reviewerEmail;
        
        // 서명 필드를 서명자에게 추가
        addSignatureField(reviewerEmail, reviewerName);
        
        alert('서명자가 성공적으로 지정되었습니다.');
      }
    } catch (error: any) {
      console.error('서명자 지정 실패:', error);
      alert(`서명자 지정에 실패했습니다: ${error.response?.data?.error || error.message}`);
    } finally {
      setIsAssigningReviewer(false);
    }
  };

  // 서명 필드 추가 함수
  const addSignatureField = (reviewerEmail: string, reviewerName: string) => {
    const newField = {
      id: `signature-${Date.now()}`,
      x: 100, // 기본 위치
      y: 100,
      width: 200, // 기본 크기
      height: 80,
      reviewerEmail,
      reviewerName,
    };

    setSignatureFields(prev => [...prev, newField]);
  };

  // 드래그 시작
  const handleMouseDown = (e: React.MouseEvent, fieldId: string, action: 'drag' | 'resize') => {
    e.preventDefault();
    e.stopPropagation();

    const field = signatureFields.find(f => f.id === fieldId);
    if (!field) return;

    setActiveFieldId(fieldId);

    if (action === 'drag') {
      setIsDragging(true);
      setDragStart({
        x: e.clientX,
        y: e.clientY,
        fieldX: field.x,
        fieldY: field.y
      });
    } else {
      setIsResizing(true);
      setResizeStart({
        x: e.clientX,
        y: e.clientY,
        width: field.width,
        height: field.height
      });
    }
  };

  // 마우스 이동
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!activeFieldId) return;

    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;

      setSignatureFields(prev =>
        prev.map(field =>
          field.id === activeFieldId
            ? {
                ...field,
                x: Math.max(0, dragStart.fieldX + deltaX),
                y: Math.max(0, dragStart.fieldY + deltaY)
              }
            : field
        )
      );
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaY = e.clientY - resizeStart.y;

      setSignatureFields(prev =>
        prev.map(field =>
          field.id === activeFieldId
            ? {
                ...field,
                width: Math.max(50, resizeStart.width + deltaX),
                height: Math.max(30, resizeStart.height + deltaY)
              }
            : field
        )
      );
    }
  };

  // 마우스 업
  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setActiveFieldId(null);
  };

  // 서명 필드 삭제
  const removeSignatureField = (fieldId: string) => {
    setSignatureFields(prev => {
      const updated = prev.filter(f => f.id !== fieldId);
      // 로컬 스토리지 업데이트
      if (id) {
        if (updated.length === 0) {
          localStorage.removeItem(`signatureFields_${id}`);
        } else {
          localStorage.setItem(`signatureFields_${id}`, JSON.stringify(updated));
        }
      }
      return updated;
    });
  };

  // 서명자 지정 완료 처리
  const handleCompleteSignerAssignment = async () => {
    if (!currentDocument) return;

    // 서명자가 지정되었는지 확인
    const hasReviewer = currentDocument.tasks?.some(task => task.role === 'REVIEWER');
    if (!hasReviewer) {
      alert('먼저 서명자를 지정해주세요.');
      return;
    }

    // 서명 필드가 배치되었는지 확인
    if (signatureFields.length === 0) {
      alert('서명 필드를 배치해주세요.');
      return;
    }

    setIsCompletingAssignment(true);
    try {
      // 서명 필드를 문서 데이터에 저장
      const updatedSignatureFields = [
        ...(currentDocument.data?.signatureFields || []),
        ...signatureFields.map(field => ({
          ...field,
          id: field.id,
          x: field.x,
          y: field.y,
          width: field.width,
          height: field.height,
          reviewerEmail: field.reviewerEmail,
          reviewerName: field.reviewerName
        }))
      ];

      // 문서 데이터 업데이트
      const updatedDocumentData = {
        ...currentDocument.data,
        signatureFields: updatedSignatureFields
      };

      await axios.put(`http://localhost:8080/api/documents/${id}`, {
        data: updatedDocumentData
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // 서명자 지정 완료 API 호출
      await axios.post(`http://localhost:8080/api/documents/${id}/complete-signer-assignment`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      // 로컬 스토리지에서 서명 필드 제거
      if (id) {
        localStorage.removeItem(`signatureFields_${id}`);
      }

      alert('서명자 지정이 완료되었습니다. 이제 검토 단계로 이동합니다.');
      
      // 문서 리스트 페이지로 이동
      navigate('/documents');

    } catch (error) {
      console.error('서명자 지정 완료 실패:', error);
      if (axios.isAxiosError(error)) {
        alert(`서명자 지정 완료에 실패했습니다: ${error.response?.data?.error || error.message}`);
      } else {
        alert('네트워크 오류가 발생했습니다.');
      }
    } finally {
      setIsCompletingAssignment(false);
    }
  };

  // PDF 이미지 URL 생성
  const getPdfImageUrl = (document: Document) => {
    if (!document.template?.pdfImagePath) {
      return '';
    }

    const filename = document.template.pdfImagePath.split('/').pop();
    return `http://localhost:8080/api/files/pdf-template-images/${filename}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">로딩 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!currentDocument) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">문서를 찾을 수 없습니다.</div>
      </div>
    );
  }

  // 권한 확인
  if (!canAssignReviewer()) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-red-600 text-2xl mr-3">🚫</div>
            <div>
              <h3 className="font-bold text-red-800 mb-2">접근 권한이 없습니다</h3>
              <p className="text-red-700 mb-4">
                서명자 지정 권한이 없습니다. 문서 작성자이거나 서명자 지정 권한이 있는 편집자만 접근할 수 있습니다.
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

  // 상태 확인 (READY_FOR_REVIEW 상태가 아니면 접근 불가)
  if (currentDocument.status !== 'READY_FOR_REVIEW') {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-center">
            <div className="text-yellow-600 text-2xl mr-3">⚠️</div>
            <div>
              <h3 className="font-bold text-yellow-800 mb-2">잘못된 문서 상태</h3>
              <p className="text-yellow-700 mb-4">
                현재 문서는 서명자 지정 단계가 아닙니다. (현재 상태: {currentDocument.status})
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b px-6 py-4 flex justify-between items-center w-full">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">
              {currentDocument.title || currentDocument.templateName} - 서명자 지정
            </h1>
            <StatusBadge status={currentDocument.status || DOCUMENT_STATUS.READY_FOR_REVIEW} size="md" />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-sm text-gray-500">
              생성일: {new Date(currentDocument.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCompleteSignerAssignment}
            disabled={isCompletingAssignment}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCompletingAssignment ? '처리 중...' : '서명자 지정 완료'}
          </button>
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 text-gray-600 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>

      {/* 메인 콘텐츠 */}
      <div className="fixed top-24 left-0 right-0 bottom-0 flex w-full">
        {/* 문서 미리보기 영역 */}
        <div className="flex-1 bg-gray-100 overflow-auto flex justify-center items-start p-4">
          {/* PDF 컨테이너 - 고정 크기 */}
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
            {/* PDF 배경 이미지 */}
            {currentDocument.template?.pdfImagePath && (
              <img
                src={getPdfImageUrl(currentDocument)}
                alt="Document Preview"
                className="absolute inset-0"
                style={{
                  width: '1240px',
                  height: '1754px',
                  objectFit: 'fill'
                }}
                onError={() => {
                  console.error('PDF 이미지 로드 실패:', getPdfImageUrl(currentDocument));
                }}
              />
            )}

            {/* 필드 컨테이너 */}
            <div 
              className="absolute inset-0"
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            >
              {/* 기존 문서 필드들 (coordinateFields) */}
              {(currentDocument.data?.coordinateFields || []).map((field: any) => {
                const fieldValue = field.value || field.defaultValue || '';
                
                // 테이블 필드인지 확인
                let isTableField = false;
                let isEditorSignature = false;
                let tableInfo = null;

                // 편집자 서명 필드 확인
                if (field.type === 'editor_signature') {
                  isEditorSignature = true;
                }

                // 테이블 필드 확인
                // 1. tableData 속성으로 확인
                if (field.tableData) {
                  isTableField = true;
                  tableInfo = field.tableData;
                  console.log('🔍 테이블 필드 감지 (tableData):', field.label, tableInfo);
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
                          cells: parsedValue.cells,
                          columnWidths: parsedValue.columnWidths
                        };
                        console.log('🔍 테이블 필드 감지 (JSON 파싱):', field.label, tableInfo);
                      }
                    }
                  } catch (e) {
                    // JSON 파싱 실패 시 일반 필드로 처리
                    console.log('⚠️ JSON 파싱 실패:', field.label, field.value);
                  }
                }
                
                return (
                  <div
                    key={`coord-${field.id}`}
                    className={`absolute bg-opacity-50 border flex flex-col justify-center pointer-events-none ${
                      isEditorSignature ? 'bg-green-100 border-green-500' :
                      isTableField ? 'bg-purple-100 border-purple-300' : 
                      'bg-green-100 border-green-300'
                    }`}
                    style={{
                      left: `${field.x}px`,
                      top: `${field.y}px`,
                      width: `${field.width}px`,
                      height: `${field.height}px`,
                    }}
                    title={`${field.label}: ${fieldValue}`}
                  >
                    {isEditorSignature ? (
                      // 편집자 서명 필드 렌더링
                      <div className="w-full h-full p-2 flex flex-col items-center justify-center">
                        <div className="text-xs font-medium mb-1 text-green-700 truncate">
                          {field.label}
                          {field.required && <span className="text-red-500">*</span>}
                        </div>
                        {field.value && (
                          <div className="text-xs text-gray-600 mt-1 text-center">
                            {field.value.startsWith('data:image') ? (
                              <div className="flex items-center justify-center">
                                <img
                                  src={field.value}
                                  alt="편집자 서명"
                                  className="max-w-full h-8 border border-transparent rounded bg-transparent"
                                />
                              </div>
                            ) : (
                              <div>서명됨: {new Date().toLocaleDateString()}</div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : isTableField && tableInfo ? (
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
                                
                                // 3. tableInfo.cells에서도 확인 (파싱된 데이터)
                                if (!cellText && tableInfo.cells && 
                                    Array.isArray(tableInfo.cells) && 
                                    tableInfo.cells[rowIndex] && 
                                    Array.isArray(tableInfo.cells[rowIndex])) {
                                  cellText = tableInfo.cells[rowIndex][colIndex] || '';
                                }
                                
                              } catch (error) {
                                console.error('테이블 셀 데이터 파싱 오류:', error);
                                cellText = '';
                              }

                              return (
                                <div 
                                  key={`${rowIndex}-${colIndex}`}
                                  className="bg-white bg-opacity-70 border border-purple-200 flex items-center justify-center p-1"
                                  style={{ 
                                    minHeight: '20px',
                                    fontSize: `${field.fontSize || 12}px`,
                                    fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                    color: '#6b21a8',
                                    fontWeight: '500'
                                  }}
                                  title={cellText || '빈 셀'}
                                >
                                  <span 
                                    className="text-center truncate leading-tight"
                                    style={{
                                      display: 'block',
                                      width: '100%',
                                      fontSize: `${field.fontSize || 12}px`,
                                      fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                                      fontWeight: '500',
                                      color: '#6b21a8'
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
                    ) : fieldValue ? (
                      // 일반 필드 - 값이 있는 경우
                      <div 
                        className="text-gray-900 p-1 truncate text-center"
                        style={{
                          fontSize: `${field.fontSize || 14}px`,
                          fontFamily: `"${field.fontFamily || 'Arial'}", sans-serif`,
                          fontWeight: '500'
                        }}
                      >
                        {fieldValue}
                      </div>
                    ) : (
                      // 일반 필드 - 값이 없는 경우 (제목만 표시)
                      <div className="text-xs text-green-700 font-medium p-1 truncate text-center">
                        {field.label}
                        {field.required && <span className="text-red-500">*</span>}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 서명 필드 */}
              {signatureFields.map(field => (
                <div
                  key={field.id}
                  className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-50 cursor-move select-none"
                  style={{
                    left: `${field.x}px`,
                    top: `${field.y}px`,
                    width: `${field.width}px`,
                    height: `${field.height}px`
                  }}
                  onMouseDown={(e) => handleMouseDown(e, field.id, 'drag')}
                >
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-blue-700 font-medium">
                    서명: {field.reviewerName || field.reviewerEmail}
                  </div>
                  {/* 리사이즈 핸들 */}
                  <div
                    className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 cursor-se-resize"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      handleMouseDown(e, field.id, 'resize');
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="w-80 bg-white border-l overflow-y-auto">
          <div className="p-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">서명자 지정</h2>
            
            {/* 서명자 지정 폼 */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  서명자 이메일
                </label>
                <UserSearchInput
                  value={selectedReviewer}
                  onChange={setSelectedReviewer}
                  placeholder="서명자 이메일을 입력하세요"
                />
              </div>
              <button
                onClick={handleAssignReviewer}
                disabled={isAssigningReviewer || !selectedReviewer.trim()}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAssigningReviewer ? '지정 중...' : '서명자 지정'}
              </button>
            </div>

            {/* 지정된 서명자 목록 */}
            {currentDocument.tasks && currentDocument.tasks.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-3">지정된 서명자</h3>
                <div className="space-y-2">
                  {currentDocument.tasks
                    .filter(task => task.role === 'REVIEWER')
                    .map(task => (
                      <div key={task.id} className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-sm text-gray-900">
                              {task.assignedUserName || 'Unknown'}
                            </div>
                            <div className="text-sm text-gray-500">{task.assignedUserEmail}</div>
                          </div>
                          <button
                            onClick={() => addSignatureField(task.assignedUserEmail, task.assignedUserName || task.assignedUserEmail)}
                            className="ml-3 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            title="이 서명자의 서명 필드 추가"
                          >
                            서명 추가
                          </button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              </div>
            )}

            {/* 서명 필드 목록 */}
            {signatureFields.length > 0 && (
              <div className="mt-6">
                <h3 className="text-md font-medium text-gray-900 mb-3">서명 필드</h3>
                <div className="space-y-2">
                  {signatureFields.map(field => (
                    <div key={field.id} className="p-3 bg-blue-50 rounded-lg">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium text-sm text-blue-900">
                            {field.reviewerEmail}
                          </div>
                          <div className="text-xs text-blue-600">
                            위치: ({field.x}, {field.y}) 크기: {field.width}x{field.height}
                          </div>
                        </div>
                        <button
                          onClick={() => removeSignatureField(field.id)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentSignerAssignment;