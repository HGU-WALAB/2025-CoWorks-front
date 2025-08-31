import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDocumentStore, type Document } from '../stores/documentStore';
import { useAuthStore } from '../stores/authStore';
import DocumentPreviewModal from '../components/DocumentPreviewModal';
import axios from 'axios';

interface User {
  id: number;
  email: string;
  name: string;
  position: string;
}

interface DocumentHistory {
  id: number;
  status: string;
  action: string;
  description: string;
  performedBy: string;
  performedByName: string;
  createdAt: string;
}

const DocumentList: React.FC = () => {
  const { documents, loading, fetchDocuments } = useDocumentStore();
  const { user: currentUser } = useAuthStore();
  const [showPreview, setShowPreview] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [coordinateFields, setCoordinateFields] = useState<any[]>([]);
  const [signatureFields, setSignatureFields] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null);
  const [documentHistory, setDocumentHistory] = useState<DocumentHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handlePreview = async (documentId: number) => {
    try {
      const document = documents.find(d => d.id === documentId);
      if (document) {
        console.log('🔍 DocumentList - 미리보기 문서:', document);
        setPreviewDocument(document);
        
        // 템플릿 필드와 저장된 필드를 합쳐서 설정
        let allFields: any[] = [];
        
        // 템플릿 필드 추가
        if (document.template?.coordinateFields) {
          try {
            const templateFields = JSON.parse(document.template.coordinateFields);
            allFields = [...templateFields];
          } catch (error) {
            console.error('템플릿 필드 파싱 오류:', error);
          }
        }
        
        // 저장된 추가 필드 추가
        const savedFields = document.data?.coordinateFields || [];
        allFields = [...allFields, ...savedFields];
        
        setCoordinateFields(allFields);

        // 서명 필드 처리
        const docSignatureFields = document.data?.signatureFields || [];
        const docSignatures = document.data?.signatures || {};
        
        const processedSignatureFields = docSignatureFields.map((field: any) => ({
          ...field,
          signatureData: docSignatures[field.reviewerEmail]
        }));
        
        console.log('🖋️ DocumentList - 서명 필드 처리:', {
          originalSignatureFields: docSignatureFields,
          signatures: docSignatures,
          processedSignatureFields
        });
        
        setSignatureFields(processedSignatureFields);
        setShowPreview(true);
      }
    } catch (error) {
      console.error('문서 미리보기 실패:', error);
    }
  };

  const handleHistory = async (documentId: number) => {
    setSelectedDocumentId(documentId);
    setHistoryLoading(true);
    try {
      const { token } = useAuthStore.getState();
      const response = await axios.get(
        `http://localhost:8080/api/documents/${documentId}/history`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      setDocumentHistory(response.data);
      setShowHistory(true);
    } catch (error) {
      console.error('히스토리 조회 실패:', error);
      alert('히스토리 조회에 실패했습니다.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const getPdfImageUrl = (doc: Document) => {
    console.log('🔍 DocumentList - PDF 이미지 URL 생성:', {
      template: doc.template,
      pdfImagePath: doc.template?.pdfImagePath
    });
    
    if (!doc.template?.pdfImagePath) {
      console.warn('⚠️ DocumentList - PDF 이미지 경로가 없습니다');
      return '';
    }
    
    const filename = doc.template.pdfImagePath.split('/').pop()?.replace('.pdf', '.png') || '';
    const url = `/uploads/pdf-templates/${filename}`;
    
    console.log('📄 DocumentList - 생성된 PDF 이미지 URL:', {
      originalPath: doc.template.pdfImagePath,
      filename: filename,
      url: url
    });
    
    return url;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'REVIEWING':
        return 'bg-blue-100 text-blue-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      case 'READY_FOR_REVIEW':
        return 'bg-yellow-100 text-yellow-800';
      case 'EDITING':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return '완료';
      case 'REVIEWING':
        return '검토중';
      case 'REJECTED':
        return '반려';
      case 'READY_FOR_REVIEW':
        return '검토준비';
      case 'EDITING':
        return '편집중';
      case 'DRAFT':
        return '초안';
      default:
        return status;
    }
  };

  const getUserRole = (document: Document) => {
    if (!currentUser) return '';
    
    const task = document.tasks?.find(t => t.assignedUserEmail === currentUser.email);
    return task ? task.role : '';
  };

  const canReview = (document: Document) => {
    if (!currentUser) return false;
    
    const task = document.tasks?.find(t => t.assignedUserEmail === currentUser.email);
    return task && task.role === 'REVIEWER';
  };

  const getActionText = (action: string) => {
    switch (action) {
      case 'CREATED':
        return '문서 생성';
      case 'UPDATED':
        return '문서 수정';
      case 'STATUS_CHANGED':
        return '상태 변경';
      case 'REVIEW_REQUESTED':
        return '검토 요청';
      case 'REVIEWED':
        return '검토 완료';
      case 'COMPLETED':
        return '문서 완료';
      default:
        return action;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">문서를 불러오는 중...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">📋 문서 목록</h1>
        <Link to="/templates" className="btn btn-primary">
          📄 새 문서 생성
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                문서명
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                상태
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                역할
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                생성일
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                작업
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {documents.map((document) => (
              <tr key={document.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {document.templateName}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(document.status)}`}>
                    {getStatusText(document.status)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {getUserRole(document)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(document.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {document.status === 'COMPLETED' ? (
                    // 완료된 문서는 편집 불가
                    <span className="text-gray-400 mr-4">편집 불가</span>
                  ) : (document.status === 'REVIEWING' || document.status === 'READY_FOR_REVIEW') ? (
                    // 검토 가능한 상태: REVIEWING 또는 READY_FOR_REVIEW
                    <Link
                      to={`/documents/${document.id}/review`}
                      className="text-yellow-600 hover:text-yellow-700 mr-4"
                    >
                     검토
                    </Link>
                  ) : (
                    // 일반 사용자일 때
                    <Link
                      to={`/documents/${document.id}/edit`}
                      className="text-primary-600 hover:text-primary-700 mr-4"
                    >
                      편집
                    </Link>
                  )}
                  <button
                    onClick={() => handleHistory(document.id)}
                    className="text-blue-600 hover:text-blue-700 mr-4"
                  >
                    📜 히스토리
                  </button>
                  <button
                    onClick={() => handlePreview(document.id)}
                    className="text-gray-600 hover:text-gray-700"
                  >
                    보기
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {documents.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-gray-500 mb-4">
            <svg className="mx-auto h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">문서가 없습니다</h3>
          <p className="text-gray-600 mb-4">템플릿을 선택해서 첫 번째 문서를 생성해보세요</p>
          <Link to="/templates" className="btn btn-primary">
            문서 생성하기
          </Link>
        </div>
      )}

      {/* 히스토리 모달 */}
      {showHistory && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-gray-800">📜 문서 히스토리</h2>
                <p className="text-sm text-gray-600 mt-1">
                  문서의 모든 변경 내역과 상태 변화를 확인할 수 있습니다
                </p>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="btn btn-primary text-sm"
              >
                닫기
              </button>
            </div>
            <div className="p-6">
              {historyLoading ? (
                <div className="flex justify-center items-center py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="ml-3 text-gray-600">히스토리를 불러오는 중...</span>
                </div>
              ) : documentHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📜</div>
                  <p>아직 히스토리가 없습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documentHistory.slice().reverse().map((history, index) => (
                    <div key={history.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-medium text-sm">{index + 1}</span>
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">
                              {getActionText(history.action)}
                            </div>
                            <div className="text-sm text-gray-600">
                              {history.description}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {history.performedByName} ({history.performedBy})
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(history.status)}`}>
                            {getStatusText(history.status)}
                          </span>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(history.createdAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 미리보기 모달 */}
      {showPreview && previewDocument && previewDocument.template?.pdfImagePath && (
        <DocumentPreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          pdfImageUrl={getPdfImageUrl(previewDocument)}
          coordinateFields={coordinateFields}
          signatureFields={signatureFields}
          documentTitle={previewDocument.template.name || '문서'}
        />
      )}
    </div>
  );
};

export default DocumentList; 