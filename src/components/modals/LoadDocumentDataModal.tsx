import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import { Document } from '../../types/document';
import { useAuthStore } from '../../stores/authStore';

interface LoadDocumentDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateId: number;
  currentDocumentId: number;
  onLoadData: (documentData: any) => void;
}

const LoadDocumentDataModal: React.FC<LoadDocumentDataModalProps> = ({
  isOpen,
  onClose,
  templateId,
  currentDocumentId,
  onLoadData
}) => {
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);

  // 같은 템플릿의 문서들 가져오기
  useEffect(() => {
    if (isOpen && templateId) {
      fetchDocumentsByTemplate();
    }
  }, [isOpen, templateId]);

  const fetchDocumentsByTemplate = async () => {
    setLoading(true);
    setError(null);
    try {
      // 같은 템플릿 ID를 가진 문서들을 가져옴
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BY_TEMPLATE(templateId)}`);
      const allDocuments: Document[] = response.data;
      
      // 현재 사용자가 EDITOR로 지정된 문서만 필터링
      // 현재 편집 중인 문서는 제외
      const filteredDocuments = allDocuments.filter(doc => {
        // 현재 문서 제외
        if (doc.id === currentDocumentId) return false;
        
        // 현재 사용자가 EDITOR로 지정된 문서만 표시
        const isEditor = doc.tasks?.some(task => 
          task.role === 'EDITOR' && task.assignedUserEmail === user?.email
        );
        
        // DRAFT 상태가 아닌 문서 (즉, 데이터가 있는 문서)만 표시
        const hasData = doc.data?.coordinateFields && doc.data.coordinateFields.length > 0;
        
        return isEditor && hasData;
      });
      
      setDocuments(filteredDocuments);
    } catch (err) {
      console.error('문서 목록 불러오기 실패:', err);
      setError('문서 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDocument = async () => {
    if (!selectedDocumentId) {
      alert('불러올 문서를 선택해주세요.');
      return;
    }

    try {
      setLoading(true);
      // 선택된 문서의 상세 정보 가져오기
      const response = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.DOCUMENTS.BY_ID(selectedDocumentId)}`);
      const selectedDoc: Document = response.data;
      
      if (!selectedDoc.data?.coordinateFields) {
        alert('선택한 문서에 불러올 데이터가 없습니다.');
        return;
      }
      
      // 서명 관련 필드 제외하고 데이터 추출
      const filteredFields = selectedDoc.data.coordinateFields.filter(field => {
        // 서명 관련 필드 제외 (타입이 signature 또는 editor_signature인 경우)
        const fieldType = (field as any).type?.toLowerCase();
        if (fieldType === 'signature' || fieldType === 'editor_signature') {
          return false;
        }
        
        // 서명자 이름 필드도 제외 (label에 '서명자' 또는 'signer'가 포함된 경우)
        const labelLower = (field as any).label?.toLowerCase() || '';
        if (labelLower.includes('서명자') || labelLower.includes('signer')) {
          return false;
        }
        
        return true;
      });
      
      onLoadData(filteredFields);
      onClose();
    } catch (err) {
      console.error('문서 데이터 불러오기 실패:', err);
      alert('문서 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">문서 내용 불러오기</h2>
              <p className="text-sm text-gray-500 mt-1">
                이전에 작성한 문서의 내용을 불러옵니다. (서명 제외)
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-3 text-gray-600">문서 목록 불러오는 중...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-gray-600">{error}</p>
              <button
                onClick={fetchDocumentsByTemplate}
                className="mt-4 px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
              >
                다시 시도
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-600">불러올 수 있는 문서가 없습니다.</p>
              <p className="text-sm text-gray-400 mt-2">
                같은 템플릿으로 이전에 작성한 문서가 있어야 합니다.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-4">
                총 {documents.length}개의 문서를 불러올 수 있습니다.
              </p>
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocumentId(doc.id)}
                  className={`w-full p-4 border rounded-lg text-left transition-all ${
                    selectedDocumentId === doc.id
                      ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{doc.title || doc.templateName}</h3>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span>
                          상태: {
                            doc.status === 'DRAFT' ? '초안' :
                            doc.status === 'EDITING' ? '작성중' :
                            doc.status === 'READY_FOR_REVIEW' ? '검토 대기' :
                            doc.status === 'REVIEWING' ? '검토중' :
                            doc.status === 'SIGNING' ? '서명중' :
                            doc.status === 'COMPLETED' ? '완료' :
                            doc.status === 'REJECTED' ? '반려' : doc.status
                          }
                        </span>
                        <span>
                          수정일: {new Date(doc.updatedAt).toLocaleDateString('ko-KR')}
                        </span>
                      </div>
                    </div>
                    {selectedDocumentId === doc.id && (
                      <div className="flex-shrink-0 ml-4">
                        <div className="w-6 h-6 bg-primary-600 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleLoadDocument}
              disabled={!selectedDocumentId || loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '불러오는 중...' : '불러오기'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadDocumentDataModal;

